/**
 * VeoSmokeTestHarness.test.ts
 *
 * Run with: npx tsx --test services/internal/VeoSmokeTestHarness.test.ts
 * (no test framework is configured in this repo — see CameraDirector.test.ts's
 * file header for the established convention this follows.)
 *
 * Every dependency is faked — no real Supabase call, no real Veo call, no
 * real Cloudinary upload anywhere in this suite.
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { runVeoSmokeTest } from "./VeoSmokeTestHarness";
import type { VeoSmokeTestDependencies, VeoSmokeTestUploadResult } from "./VeoSmokeTestHarness";
import { InMemoryProductionContextRepository } from "../infrastructure/ProductionContextRepository";
import { UsageCategory } from "../billing/BillingTypes";
import type { RenderRequest } from "../rendering/interfaces/RenderProvider";
import type { RenderResult } from "../rendering/interfaces/RenderResult";

const USER_ID = "test-user-1";

class FakeBillingEngine {
  reserveCalls: unknown[] = [];
  chargeCalls: unknown[] = [];
  releaseCalls: unknown[] = [];
  private reservationCounter = 0;

  async reserveForProduction(userId: string, productionId: string, inputs: unknown[]) {
    this.reserveCalls.push({ userId, productionId, inputs });
    this.reservationCounter += 1;
    return {
      id: `reservation-${this.reservationCounter}`,
      userId,
      productionId,
      amount: 9,
      status: "HELD" as const,
      createdAt: new Date().toISOString(),
    };
  }

  async chargeUsage(reservationId: string, userId: string, productionId: string, input: unknown) {
    this.chargeCalls.push({ reservationId, userId, productionId, input });
    return { id: "txn-1", userId, type: "CONSUMPTION", amount: 9, createdAt: new Date().toISOString() };
  }

  async releaseReservation(reservationId: string, reason?: string) {
    this.releaseCalls.push({ reservationId, reason });
    return { id: "txn-2", userId: USER_ID, type: "RESERVATION_RELEASE", amount: 9, createdAt: new Date().toISOString() };
  }
}

class FakeOrchestrator {
  renderAndWaitCalls: RenderRequest[] = [];
  constructor(private readonly result: RenderResult | (() => Promise<RenderResult>)) {}
  async renderAndWait(request: RenderRequest): Promise<RenderResult> {
    this.renderAndWaitCalls.push(request);
    return typeof this.result === "function" ? (this.result as () => Promise<RenderResult>)() : this.result;
  }
}

function buildDeps(overrides: {
  orchestrator: FakeOrchestrator;
  billingEngine?: FakeBillingEngine;
  contextRepository?: InMemoryProductionContextRepository;
  uploadVideo?: (sourceUrl: string, publicId: string) => Promise<VeoSmokeTestUploadResult>;
}): { deps: VeoSmokeTestDependencies; billingEngine: FakeBillingEngine; contextRepository: InMemoryProductionContextRepository } {
  const billingEngine = overrides.billingEngine ?? new FakeBillingEngine();
  const contextRepository = overrides.contextRepository ?? new InMemoryProductionContextRepository();
  const deps: VeoSmokeTestDependencies = {
    billingEngine: billingEngine as unknown as VeoSmokeTestDependencies["billingEngine"],
    contextRepository,
    orchestrator: overrides.orchestrator as unknown as VeoSmokeTestDependencies["orchestrator"],
    uploadVideo: overrides.uploadVideo ?? (async (sourceUrl) => ({ secureUrl: sourceUrl.replace("veo-raw", "cloudinary") })),
  };
  return { deps, billingEngine, contextRepository };
}

describe("runVeoSmokeTest — billing", () => {
  test("reserves credits for exactly the Videos category, GOOGLE provider, requested duration", async () => {
    const orchestrator = new FakeOrchestrator({ jobId: "j1", status: "COMPLETED", provider: "GOOGLE", videoUrl: "https://veo-raw/v.mp4", duration: 8 });
    const { deps, billingEngine } = buildDeps({ orchestrator });

    await runVeoSmokeTest({ userId: USER_ID, prompt: "a".repeat(20), durationSeconds: 8 }, deps);

    assert.equal(billingEngine.reserveCalls.length, 1);
    const call = billingEngine.reserveCalls[0] as { userId: string; inputs: { category: string; providerId: string; videoLengthSeconds: number }[] };
    assert.equal(call.userId, USER_ID);
    assert.equal(call.inputs.length, 1);
    assert.equal(call.inputs[0].category, UsageCategory.Videos);
    assert.equal(call.inputs[0].providerId, "GOOGLE");
    assert.equal(call.inputs[0].videoLengthSeconds, 8);
  });

  test("settles (charges) the reservation on success", async () => {
    const orchestrator = new FakeOrchestrator({ jobId: "j1", status: "COMPLETED", provider: "GOOGLE", videoUrl: "https://veo-raw/v.mp4", duration: 8 });
    const { deps, billingEngine } = buildDeps({ orchestrator });

    const result = await runVeoSmokeTest({ userId: USER_ID, prompt: "a".repeat(20) }, deps);

    assert.equal(billingEngine.chargeCalls.length, 1);
    assert.equal(billingEngine.releaseCalls.length, 0);
    const charge = billingEngine.chargeCalls[0] as { reservationId: string };
    assert.equal(charge.reservationId, result.reservationId);
  });

  test("releases (does not charge) the reservation on failure", async () => {
    const orchestrator = new FakeOrchestrator({ jobId: "j1", status: "FAILED", provider: "GOOGLE", error: "quota exceeded" });
    const { deps, billingEngine } = buildDeps({ orchestrator });

    await runVeoSmokeTest({ userId: USER_ID, prompt: "a".repeat(20) }, deps);

    assert.equal(billingEngine.releaseCalls.length, 1);
    assert.equal(billingEngine.chargeCalls.length, 0);
    assert.match((billingEngine.releaseCalls[0] as { reason: string }).reason, /quota exceeded/);
  });

  test("releases the reservation when the upload step itself throws", async () => {
    const orchestrator = new FakeOrchestrator({ jobId: "j1", status: "COMPLETED", provider: "GOOGLE", videoUrl: "https://veo-raw/v.mp4" });
    const { deps, billingEngine } = buildDeps({
      orchestrator,
      uploadVideo: async () => {
        throw new Error("Cloudinary upload failed");
      },
    });

    const result = await runVeoSmokeTest({ userId: USER_ID, prompt: "a".repeat(20) }, deps);

    assert.equal(result.status, "FAILED");
    assert.equal(billingEngine.releaseCalls.length, 1);
    assert.equal(billingEngine.chargeCalls.length, 0);
    assert.match(result.error ?? "", /Cloudinary upload failed/);
  });
});

describe("runVeoSmokeTest — production context", () => {
  test("creates a ProductionContext with the requesting user's id", async () => {
    const orchestrator = new FakeOrchestrator({ jobId: "j1", status: "COMPLETED", provider: "GOOGLE", videoUrl: "https://veo-raw/v.mp4" });
    const { deps, contextRepository } = buildDeps({ orchestrator });

    const result = await runVeoSmokeTest({ userId: USER_ID, prompt: "a".repeat(20) }, deps);

    const context = contextRepository.get(result.productionId);
    assert.ok(context);
    assert.equal(context?.userId, USER_ID);
  });

  test("on success, writes finalVideoUrl and finalVideoMetadata onto the context", async () => {
    const orchestrator = new FakeOrchestrator({ jobId: "j1", status: "COMPLETED", provider: "GOOGLE", videoUrl: "https://veo-raw/v.mp4", duration: 8, resolution: "720p" });
    const { deps, contextRepository } = buildDeps({ orchestrator });

    const result = await runVeoSmokeTest({ userId: USER_ID, prompt: "a".repeat(20) }, deps);

    const context = contextRepository.get(result.productionId);
    assert.equal(context?.finalVideoUrl, result.finalVideoUrl);
    assert.equal(context?.finalVideoMetadata?.durationSeconds, 8);
    assert.equal(context?.finalVideoMetadata?.resolution, "720p");
  });

  test("on failure, writes context.failure with the VideoGeneration stage and a message", async () => {
    const orchestrator = new FakeOrchestrator({ jobId: "j1", status: "FAILED", provider: "GOOGLE", error: "operation failed" });
    const { deps, contextRepository } = buildDeps({ orchestrator });

    const result = await runVeoSmokeTest({ userId: USER_ID, prompt: "a".repeat(20) }, deps);

    const context = contextRepository.get(result.productionId);
    assert.equal(context?.failure?.stage, "VIDEO_GENERATION");
    assert.match(context?.failure?.message ?? "", /operation failed/);
  });
});

describe("runVeoSmokeTest — provider invocation, no-retry, no-fallback", () => {
  test("calls the orchestrator's renderAndWait exactly once on success", async () => {
    const orchestrator = new FakeOrchestrator({ jobId: "j1", status: "COMPLETED", provider: "GOOGLE", videoUrl: "https://veo-raw/v.mp4" });
    const { deps } = buildDeps({ orchestrator });

    await runVeoSmokeTest({ userId: USER_ID, prompt: "a".repeat(20) }, deps);

    assert.equal(orchestrator.renderAndWaitCalls.length, 1);
  });

  test("calls the orchestrator's renderAndWait exactly once on failure — no automatic retry", async () => {
    const orchestrator = new FakeOrchestrator({ jobId: "j1", status: "FAILED", provider: "GOOGLE", error: "boom" });
    const { deps } = buildDeps({ orchestrator });

    await runVeoSmokeTest({ userId: USER_ID, prompt: "a".repeat(20) }, deps);

    assert.equal(orchestrator.renderAndWaitCalls.length, 1);
  });

  test("passes the exact prompt/aspectRatio/durationSeconds through to the render request, untouched", async () => {
    const orchestrator = new FakeOrchestrator({ jobId: "j1", status: "COMPLETED", provider: "GOOGLE", videoUrl: "https://veo-raw/v.mp4" });
    const { deps } = buildDeps({ orchestrator });
    const prompt = "Create a premium cinematic advertisement for running shoes.".padEnd(70, ".");

    await runVeoSmokeTest({ userId: USER_ID, prompt, aspectRatio: "16:9", durationSeconds: 6 }, deps);

    assert.equal(orchestrator.renderAndWaitCalls[0].prompt, prompt);
    assert.equal(orchestrator.renderAndWaitCalls[0].aspectRatio, "16:9");
    assert.equal(orchestrator.renderAndWaitCalls[0].durationSeconds, 6);
  });

  test("defaults duration to 8s and aspect ratio to 9:16 when not specified", async () => {
    const orchestrator = new FakeOrchestrator({ jobId: "j1", status: "COMPLETED", provider: "GOOGLE", videoUrl: "https://veo-raw/v.mp4" });
    const { deps } = buildDeps({ orchestrator });

    const result = await runVeoSmokeTest({ userId: USER_ID, prompt: "a".repeat(20) }, deps);

    assert.equal(orchestrator.renderAndWaitCalls[0].aspectRatio, "9:16");
    assert.equal(orchestrator.renderAndWaitCalls[0].durationSeconds, 8);
    assert.equal(result.requestedDurationSeconds, 8);
  });

  test("never reserves or charges against any provider id other than GOOGLE — no LTX fallback anywhere in this harness", async () => {
    const orchestrator = new FakeOrchestrator({ jobId: "j1", status: "COMPLETED", provider: "GOOGLE", videoUrl: "https://veo-raw/v.mp4" });
    const { deps, billingEngine } = buildDeps({ orchestrator });

    await runVeoSmokeTest({ userId: USER_ID, prompt: "a".repeat(20) }, deps);

    const allProviderIds = [
      ...billingEngine.reserveCalls.map((c) => (c as { inputs: { providerId: string }[] }).inputs[0].providerId),
      ...billingEngine.chargeCalls.map((c) => (c as { input: { providerId: string } }).input.providerId),
    ];
    assert.ok(allProviderIds.every((id) => id === "GOOGLE"));
  });
});
