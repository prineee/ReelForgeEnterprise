/**
 * VeoSmokeTestHarness.test.ts
 *
 * Run with: npx tsx --test services/internal/VeoSmokeTestHarness.test.ts
 * (no test framework is configured in this repo — see CameraDirector.test.ts's
 * file header for the established convention this follows.)
 *
 * Every dependency is faked — no real Supabase call, no real Veo call, no
 * real Cloudinary upload anywhere in this suite.
 *
 * Covers both halves of the Vercel -> Railway split (see
 * VeoSmokeTestHarness.ts's header):
 *   - reserveVeoSmokeTest() — runs on Vercel, never touches the orchestrator.
 *   - executeVeoSmokeTest() — runs on the Railway worker, including the
 *     idempotency guard that protects against BullMQ stalled-job
 *     redelivery invoking a second real, paid Veo call.
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { reserveVeoSmokeTest, executeVeoSmokeTest } from "./VeoSmokeTestHarness";
import type {
  VeoSmokeTestReserveDependencies,
  VeoSmokeTestExecuteDependencies,
  VeoSmokeTestReservation,
  VeoSmokeTestUploadResult,
} from "./VeoSmokeTestHarness";
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

function buildReserveDeps(overrides: {
  billingEngine?: FakeBillingEngine;
  contextRepository?: InMemoryProductionContextRepository;
}): { deps: VeoSmokeTestReserveDependencies; billingEngine: FakeBillingEngine; contextRepository: InMemoryProductionContextRepository } {
  const billingEngine = overrides.billingEngine ?? new FakeBillingEngine();
  const contextRepository = overrides.contextRepository ?? new InMemoryProductionContextRepository();
  const deps: VeoSmokeTestReserveDependencies = {
    billingEngine: billingEngine as unknown as VeoSmokeTestReserveDependencies["billingEngine"],
    contextRepository,
  };
  return { deps, billingEngine, contextRepository };
}

function buildExecuteDeps(overrides: {
  orchestrator: FakeOrchestrator;
  billingEngine?: FakeBillingEngine;
  contextRepository?: InMemoryProductionContextRepository;
  uploadVideo?: (sourceUrl: string, publicId: string) => Promise<VeoSmokeTestUploadResult>;
}): { deps: VeoSmokeTestExecuteDependencies; billingEngine: FakeBillingEngine; contextRepository: InMemoryProductionContextRepository } {
  const billingEngine = overrides.billingEngine ?? new FakeBillingEngine();
  const contextRepository = overrides.contextRepository ?? new InMemoryProductionContextRepository();
  const deps: VeoSmokeTestExecuteDependencies = {
    billingEngine: billingEngine as unknown as VeoSmokeTestExecuteDependencies["billingEngine"],
    contextRepository,
    orchestrator: overrides.orchestrator as unknown as VeoSmokeTestExecuteDependencies["orchestrator"],
    uploadVideo: overrides.uploadVideo ?? (async (sourceUrl) => ({ secureUrl: sourceUrl.replace("veo-raw", "cloudinary") })),
  };
  return { deps, billingEngine, contextRepository };
}

async function reserveAndSeed(
  overrides: Parameters<typeof buildReserveDeps>[0] & { params?: { prompt?: string; aspectRatio?: string; durationSeconds?: number } } = {}
): Promise<{ reservation: VeoSmokeTestReservation; billingEngine: FakeBillingEngine; contextRepository: InMemoryProductionContextRepository }> {
  const { deps, billingEngine, contextRepository } = buildReserveDeps(overrides);
  const reservation = await reserveVeoSmokeTest(
    {
      userId: USER_ID,
      prompt: overrides.params?.prompt ?? "a".repeat(20),
      aspectRatio: overrides.params?.aspectRatio,
      durationSeconds: overrides.params?.durationSeconds,
    },
    deps
  );
  return { reservation, billingEngine, contextRepository };
}

describe("reserveVeoSmokeTest — Vercel side", () => {
  test("reserves credits for exactly the Videos category, GOOGLE provider, requested duration", async () => {
    const { reservation, billingEngine } = await reserveAndSeed({ params: { durationSeconds: 8 } });

    assert.equal(billingEngine.reserveCalls.length, 1);
    const call = billingEngine.reserveCalls[0] as { userId: string; inputs: { category: string; providerId: string; videoLengthSeconds: number }[] };
    assert.equal(call.userId, USER_ID);
    assert.equal(call.inputs.length, 1);
    assert.equal(call.inputs[0].category, UsageCategory.Videos);
    assert.equal(call.inputs[0].providerId, "GOOGLE");
    assert.equal(call.inputs[0].videoLengthSeconds, 8);
    assert.equal(reservation.reservationId, "reservation-1");
  });

  test("creates a ProductionContext with the requesting user's id", async () => {
    const { reservation, contextRepository } = await reserveAndSeed();

    const context = contextRepository.get(reservation.productionId);
    assert.ok(context);
    assert.equal(context?.userId, USER_ID);
  });

  test("passes the exact prompt/aspectRatio/durationSeconds through, untouched", async () => {
    const prompt = "Create a premium cinematic advertisement for running shoes.".padEnd(70, ".");
    const { reservation } = await reserveAndSeed({ params: { prompt, aspectRatio: "16:9", durationSeconds: 6 } });

    assert.equal(reservation.prompt, prompt);
    assert.equal(reservation.aspectRatio, "16:9");
    assert.equal(reservation.durationSeconds, 6);
  });

  test("defaults duration to 8s and aspect ratio to 9:16 when not specified", async () => {
    const { reservation } = await reserveAndSeed();

    assert.equal(reservation.aspectRatio, "9:16");
    assert.equal(reservation.durationSeconds, 8);
  });

  test("never reserves against any provider id other than GOOGLE — no LTX fallback anywhere in this harness", async () => {
    const { billingEngine } = await reserveAndSeed();

    const providerIds = billingEngine.reserveCalls.map((c) => (c as { inputs: { providerId: string }[] }).inputs[0].providerId);
    assert.ok(providerIds.every((id) => id === "GOOGLE"));
  });

  test("does not construct or call any orchestrator — Vercel never runs Veo", async () => {
    // reserveVeoSmokeTest's dependency type has no orchestrator field at
    // all, so this is enforced at compile time too; this test documents
    // that the runtime behavior matches — reservation completes with only
    // billing + context calls, nothing render-related.
    const { deps } = buildReserveDeps({});
    const reservation = await reserveVeoSmokeTest({ userId: USER_ID, prompt: "a".repeat(20) }, deps);
    assert.ok(reservation.productionId);
    assert.ok(reservation.reservationId);
  });
});

describe("executeVeoSmokeTest — billing", () => {
  test("settles (charges) the reservation on success", async () => {
    const { reservation, contextRepository } = await reserveAndSeed();
    const orchestrator = new FakeOrchestrator({ jobId: "j1", status: "COMPLETED", provider: "GOOGLE", videoUrl: "https://veo-raw/v.mp4", duration: 8 });
    const { deps, billingEngine } = buildExecuteDeps({ orchestrator, contextRepository });

    const result = await executeVeoSmokeTest(reservation, deps);

    assert.equal(billingEngine.chargeCalls.length, 1);
    assert.equal(billingEngine.releaseCalls.length, 0);
    const charge = billingEngine.chargeCalls[0] as { reservationId: string };
    assert.equal(charge.reservationId, result.reservationId);
  });

  test("releases (does not charge) the reservation on failure", async () => {
    const { reservation, contextRepository } = await reserveAndSeed();
    const orchestrator = new FakeOrchestrator({ jobId: "j1", status: "FAILED", provider: "GOOGLE", error: "quota exceeded" });
    const { deps, billingEngine } = buildExecuteDeps({ orchestrator, contextRepository });

    await executeVeoSmokeTest(reservation, deps);

    assert.equal(billingEngine.releaseCalls.length, 1);
    assert.equal(billingEngine.chargeCalls.length, 0);
    assert.match((billingEngine.releaseCalls[0] as { reason: string }).reason, /quota exceeded/);
  });

  test("releases the reservation when the upload step itself throws", async () => {
    const { reservation, contextRepository } = await reserveAndSeed();
    const orchestrator = new FakeOrchestrator({ jobId: "j1", status: "COMPLETED", provider: "GOOGLE", videoUrl: "https://veo-raw/v.mp4" });
    const { deps, billingEngine } = buildExecuteDeps({
      orchestrator,
      contextRepository,
      uploadVideo: async () => {
        throw new Error("Cloudinary upload failed");
      },
    });

    const result = await executeVeoSmokeTest(reservation, deps);

    assert.equal(result.status, "FAILED");
    assert.equal(billingEngine.releaseCalls.length, 1);
    assert.equal(billingEngine.chargeCalls.length, 0);
    assert.match(result.error ?? "", /Cloudinary upload failed/);
  });
});

describe("executeVeoSmokeTest — production context", () => {
  test("on success, writes finalVideoUrl and finalVideoMetadata onto the context", async () => {
    const { reservation, contextRepository } = await reserveAndSeed();
    const orchestrator = new FakeOrchestrator({ jobId: "j1", status: "COMPLETED", provider: "GOOGLE", videoUrl: "https://veo-raw/v.mp4", duration: 8, resolution: "720p" });
    const { deps } = buildExecuteDeps({ orchestrator, contextRepository });

    const result = await executeVeoSmokeTest(reservation, deps);

    const context = contextRepository.get(reservation.productionId);
    assert.equal(context?.finalVideoUrl, result.finalVideoUrl);
    assert.equal(context?.finalVideoMetadata?.durationSeconds, 8);
    assert.equal(context?.finalVideoMetadata?.resolution, "720p");
  });

  test("on failure, writes context.failure with the VideoGeneration stage and a message", async () => {
    const { reservation, contextRepository } = await reserveAndSeed();
    const orchestrator = new FakeOrchestrator({ jobId: "j1", status: "FAILED", provider: "GOOGLE", error: "operation failed" });
    const { deps } = buildExecuteDeps({ orchestrator, contextRepository });

    await executeVeoSmokeTest(reservation, deps);

    const context = contextRepository.get(reservation.productionId);
    assert.equal(context?.failure?.stage, "VIDEO_GENERATION");
    assert.match(context?.failure?.message ?? "", /operation failed/);
  });
});

describe("executeVeoSmokeTest — provider invocation, no-retry, no-fallback", () => {
  test("calls the orchestrator's renderAndWait exactly once on success", async () => {
    const { reservation, contextRepository } = await reserveAndSeed();
    const orchestrator = new FakeOrchestrator({ jobId: "j1", status: "COMPLETED", provider: "GOOGLE", videoUrl: "https://veo-raw/v.mp4" });
    const { deps } = buildExecuteDeps({ orchestrator, contextRepository });

    await executeVeoSmokeTest(reservation, deps);

    assert.equal(orchestrator.renderAndWaitCalls.length, 1);
  });

  test("calls the orchestrator's renderAndWait exactly once on failure — no automatic retry", async () => {
    const { reservation, contextRepository } = await reserveAndSeed();
    const orchestrator = new FakeOrchestrator({ jobId: "j1", status: "FAILED", provider: "GOOGLE", error: "boom" });
    const { deps } = buildExecuteDeps({ orchestrator, contextRepository });

    await executeVeoSmokeTest(reservation, deps);

    assert.equal(orchestrator.renderAndWaitCalls.length, 1);
  });

  test("passes the exact prompt/aspectRatio/durationSeconds from the reservation through to the render request", async () => {
    const prompt = "Create a premium cinematic advertisement for running shoes.".padEnd(70, ".");
    const { reservation, contextRepository } = await reserveAndSeed({ params: { prompt, aspectRatio: "16:9", durationSeconds: 6 } });
    const orchestrator = new FakeOrchestrator({ jobId: "j1", status: "COMPLETED", provider: "GOOGLE", videoUrl: "https://veo-raw/v.mp4" });
    const { deps } = buildExecuteDeps({ orchestrator, contextRepository });

    await executeVeoSmokeTest(reservation, deps);

    assert.equal(orchestrator.renderAndWaitCalls[0].prompt, prompt);
    assert.equal(orchestrator.renderAndWaitCalls[0].aspectRatio, "16:9");
    assert.equal(orchestrator.renderAndWaitCalls[0].durationSeconds, 6);
  });

  test("never charges or releases against any provider id other than GOOGLE", async () => {
    const { reservation, contextRepository } = await reserveAndSeed();
    const orchestrator = new FakeOrchestrator({ jobId: "j1", status: "COMPLETED", provider: "GOOGLE", videoUrl: "https://veo-raw/v.mp4" });
    const { deps, billingEngine } = buildExecuteDeps({ orchestrator, contextRepository });

    await executeVeoSmokeTest(reservation, deps);

    const providerIds = billingEngine.chargeCalls.map((c) => (c as { input: { providerId: string } }).input.providerId);
    assert.ok(providerIds.every((id) => id === "GOOGLE"));
  });
});

describe("executeVeoSmokeTest — idempotency guard (BullMQ stalled-job redelivery)", () => {
  test("a second execution of an already-COMPLETED production does not call renderAndWait or charge again", async () => {
    const { reservation, contextRepository, billingEngine } = await reserveAndSeed();
    const orchestrator = new FakeOrchestrator({ jobId: "j1", status: "COMPLETED", provider: "GOOGLE", videoUrl: "https://veo-raw/v.mp4", duration: 8 });
    const { deps } = buildExecuteDeps({ orchestrator, billingEngine, contextRepository });

    const first = await executeVeoSmokeTest(reservation, deps);
    // Simulates BullMQ redelivering the same job (e.g. after a lock stall)
    // to another worker — same productionId, same reservation, invoked a
    // second time.
    const second = await executeVeoSmokeTest(reservation, deps);

    assert.equal(orchestrator.renderAndWaitCalls.length, 1, "renderAndWait must not be called a second time");
    assert.equal(billingEngine.chargeCalls.length, 1, "the reservation must not be charged a second time");
    assert.equal(second.status, "COMPLETED");
    assert.equal(second.finalVideoUrl, first.finalVideoUrl);
  });

  test("a second execution of an already-FAILED production does not call renderAndWait or release again", async () => {
    const { reservation, contextRepository, billingEngine } = await reserveAndSeed();
    const orchestrator = new FakeOrchestrator({ jobId: "j1", status: "FAILED", provider: "GOOGLE", error: "quota exceeded" });
    const { deps } = buildExecuteDeps({ orchestrator, billingEngine, contextRepository });

    const first = await executeVeoSmokeTest(reservation, deps);
    const second = await executeVeoSmokeTest(reservation, deps);

    assert.equal(orchestrator.renderAndWaitCalls.length, 1, "renderAndWait must not be called a second time");
    assert.equal(billingEngine.releaseCalls.length, 1, "the reservation must not be released a second time");
    assert.equal(second.status, "FAILED");
    assert.equal(second.error, first.error);
  });

  test("checks getPersisted() (a durable, cross-instance-safe read) before invoking renderAndWait — not an in-process cache", async () => {
    const { reservation, contextRepository, billingEngine } = await reserveAndSeed();
    const orchestrator = new FakeOrchestrator({ jobId: "j1", status: "COMPLETED", provider: "GOOGLE", videoUrl: "https://veo-raw/v.mp4" });
    await executeVeoSmokeTest(reservation, buildExecuteDeps({ orchestrator, billingEngine, contextRepository }).deps);

    // A brand-new orchestrator/dependency set standing in for a second,
    // independent worker process that shares only the durable context
    // repository — proves the guard reads from shared/durable state, not
    // from anything held in the first execution's closures.
    const secondOrchestrator = new FakeOrchestrator({ jobId: "j2", status: "COMPLETED", provider: "GOOGLE", videoUrl: "https://veo-raw/other.mp4" });
    const { deps: secondDeps } = buildExecuteDeps({ orchestrator: secondOrchestrator, billingEngine, contextRepository });

    const result = await executeVeoSmokeTest(reservation, secondDeps);

    assert.equal(secondOrchestrator.renderAndWaitCalls.length, 0);
    assert.equal(result.status, "COMPLETED");
  });
});

describe("executeVeoSmokeTest — crash/redelivery cannot permanently strand HELD credits", () => {
  test("a redelivered job for a production that already failed still resolves to FAILED without leaving it unresolved", async () => {
    const { reservation, contextRepository, billingEngine } = await reserveAndSeed();
    const orchestrator = new FakeOrchestrator({ jobId: "j1", status: "FAILED", provider: "GOOGLE", error: "internal error" });
    const { deps } = buildExecuteDeps({ orchestrator, billingEngine, contextRepository });

    await executeVeoSmokeTest(reservation, deps);
    assert.equal(billingEngine.releaseCalls.length, 1);

    // Redelivery: a second worker picks up the same job after the first's
    // lock stalled. The reservation is already released; the guard must
    // return the recorded failure rather than attempting to release an
    // already-released reservation again or re-running Veo.
    const redelivered = await executeVeoSmokeTest(reservation, deps);
    assert.equal(redelivered.status, "FAILED");
    assert.equal(billingEngine.releaseCalls.length, 1);
    assert.equal(orchestrator.renderAndWaitCalls.length, 1);
  });

  test("an unexpected throw from the render call itself still releases the reservation rather than leaving it HELD", async () => {
    const { reservation, contextRepository, billingEngine } = await reserveAndSeed();
    const orchestrator = new FakeOrchestrator(async () => {
      throw new Error("network error mid-poll");
    });
    const { deps } = buildExecuteDeps({ orchestrator, billingEngine, contextRepository });

    const result = await executeVeoSmokeTest(reservation, deps);

    assert.equal(result.status, "FAILED");
    assert.equal(billingEngine.releaseCalls.length, 1);
    assert.match(result.error ?? "", /network error mid-poll/);
  });
});
