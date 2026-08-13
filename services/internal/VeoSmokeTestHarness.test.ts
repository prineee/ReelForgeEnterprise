/**
 * VeoSmokeTestHarness.test.ts
 *
 * Run with: npx tsx --test services/internal/VeoSmokeTestHarness.test.ts
 * (no test framework is configured in this repo — see CameraDirector.test.ts's
 * file header for the established convention this follows.)
 *
 * Every dependency is faked — no real Supabase call, no real Veo call, no
 * real Cloudinary upload anywhere in this suite. executeVeoSmokeTest() is
 * exercised against a REAL RenderOrchestrator wrapping a scripted
 * RenderProvider (mirroring RenderOrchestrator.test.ts's own
 * ScriptedProvider/buildOrchestrator convention) rather than a hand-rolled
 * fake orchestrator — this lets these tests prove the real
 * providerJobId/resumeJob()/pollUntilTerminal() integration actually
 * works, not just that the harness calls some mock correctly.
 *
 * Covers both halves of the Vercel -> Railway split (see
 * VeoSmokeTestHarness.ts's header) and the in-flight-generation recovery
 * state machine (SUBMITTING -> POLLING -> COMPLETED/FAILED/RECOVERY_REQUIRED)
 * that protects against a worker crash + BullMQ stalled-job redelivery
 * causing a second, duplicate, paid Veo generation.
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
import { RenderOrchestrator } from "../rendering/RenderOrchestrator";
import { ProviderRegistry } from "../rendering/ProviderRegistry";
import { ProviderSelector } from "../rendering/ProviderSelector";
import type { RenderProvider, RenderRequest } from "../rendering/interfaces/RenderProvider";
import type { RenderResult } from "../rendering/interfaces/RenderResult";
import { VeoProviderError } from "../rendering/providers/cloud/VeoProviderError";

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

/** Deterministically selects GOOGLE, matching this harness's own PROVIDER_ID constant. */
class FixedProviderSelector extends ProviderSelector {
  select(): "GOOGLE" {
    return "GOOGLE";
  }
}

interface ScriptedVeoBackend {
  generate?: () => Promise<RenderResult>;
  checkStatus?: () => Promise<RenderResult>;
  download?: () => Promise<RenderResult>;
}

/** Stands in for the real Veo API (via GoogleVeoProvider/GoogleGenAIVeoClient) — the one thing that must never be called more than once per real generation. */
class ScriptedProvider implements RenderProvider {
  readonly name = "GOOGLE";
  generateCalls = 0;
  checkStatusCalls = 0;
  downloadCalls = 0;
  constructor(private readonly script: ScriptedVeoBackend) {}

  async generate(_request: RenderRequest): Promise<RenderResult> {
    this.generateCalls += 1;
    return this.script.generate
      ? this.script.generate()
      : { jobId: "veo-operation-default", status: "PROCESSING", provider: "GOOGLE" };
  }
  async checkStatus(_jobId: string): Promise<RenderResult> {
    this.checkStatusCalls += 1;
    return this.script.checkStatus
      ? this.script.checkStatus()
      : { jobId: "veo-operation-default", status: "PROCESSING", provider: "GOOGLE" };
  }
  async download(_jobId: string): Promise<RenderResult> {
    this.downloadCalls += 1;
    return this.script.download
      ? this.script.download()
      : { jobId: "veo-operation-default", status: "COMPLETED", provider: "GOOGLE", videoUrl: "https://veo-raw/v.mp4" };
  }
}

function buildOrchestrator(provider: RenderProvider): RenderOrchestrator {
  const registry = new ProviderRegistry();
  registry.register("GOOGLE", () => provider);
  return new RenderOrchestrator(registry, new FixedProviderSelector());
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
  orchestrator: RenderOrchestrator;
  billingEngine?: FakeBillingEngine;
  contextRepository?: InMemoryProductionContextRepository;
  uploadVideo?: (sourceUrl: string, publicId: string) => Promise<VeoSmokeTestUploadResult>;
}): { deps: VeoSmokeTestExecuteDependencies; billingEngine: FakeBillingEngine; contextRepository: InMemoryProductionContextRepository } {
  const billingEngine = overrides.billingEngine ?? new FakeBillingEngine();
  const contextRepository = overrides.contextRepository ?? new InMemoryProductionContextRepository();
  const deps: VeoSmokeTestExecuteDependencies = {
    billingEngine: billingEngine as unknown as VeoSmokeTestExecuteDependencies["billingEngine"],
    contextRepository,
    orchestrator: overrides.orchestrator,
    uploadVideo: overrides.uploadVideo ?? (async (sourceUrl) => ({ secureUrl: sourceUrl.replace("veo-raw", "cloudinary") })),
    // A 1ms interval / 5-attempt cap so any test path that falls through
    // to RenderOrchestrator.pollUntilTerminal()'s real sleep()-based loop
    // (its own defaults are 5000ms/36 attempts, meant for real Veo calls)
    // still runs near-instantly.
    pollOptions: { pollIntervalMs: 1, maxAttempts: 5 },
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
    const { deps } = buildReserveDeps({});
    const reservation = await reserveVeoSmokeTest({ userId: USER_ID, prompt: "a".repeat(20) }, deps);
    assert.ok(reservation.productionId);
    assert.ok(reservation.reservationId);
  });
});

describe("executeVeoSmokeTest — fresh submission (1: submits once, 2: operation id persisted)", () => {
  test("a fresh job calls generate() exactly once", async () => {
    const { reservation, contextRepository } = await reserveAndSeed();
    const provider = new ScriptedProvider({
      generate: async () => ({ jobId: "veo-op-1", status: "PROCESSING", provider: "GOOGLE" }),
      checkStatus: async () => ({ jobId: "veo-op-1", status: "COMPLETED", provider: "GOOGLE" }),
      download: async () => ({ jobId: "veo-op-1", status: "COMPLETED", provider: "GOOGLE", videoUrl: "https://veo-raw/v.mp4", duration: 8 }),
    });
    const { deps } = buildExecuteDeps({ orchestrator: buildOrchestrator(provider), contextRepository });

    await executeVeoSmokeTest(reservation, deps);

    assert.equal(provider.generateCalls, 1);
  });

  test("the real Veo operation id is persisted onto the context as veoGeneration.operationId in state POLLING, before polling starts", async () => {
    const { reservation, contextRepository } = await reserveAndSeed();
    let checkStatusCallsAtPersistTime = -1;
    const provider = new ScriptedProvider({
      generate: async () => ({ jobId: "veo-op-persisted", status: "PROCESSING", provider: "GOOGLE" }),
      checkStatus: async () => {
        // Inspect persisted state from inside the poll callback — proves
        // the operationId write happened strictly before any polling.
        const mid = contextRepository.get(reservation.productionId);
        checkStatusCallsAtPersistTime = mid?.veoGeneration?.state === "POLLING" && mid.veoGeneration.operationId === "veo-op-persisted" ? 1 : 0;
        return { jobId: "veo-op-persisted", status: "COMPLETED", provider: "GOOGLE" };
      },
      download: async () => ({ jobId: "veo-op-persisted", status: "COMPLETED", provider: "GOOGLE", videoUrl: "https://veo-raw/v.mp4" }),
    });
    const { deps } = buildExecuteDeps({ orchestrator: buildOrchestrator(provider), contextRepository });

    await executeVeoSmokeTest(reservation, deps);

    assert.equal(checkStatusCallsAtPersistTime, 1, "operationId must already be persisted with state POLLING before the first poll");
  });
});

describe("executeVeoSmokeTest — redelivery with a persisted operation id (3, 4: resumes, never resubmits)", () => {
  test("redelivery with a persisted operationId does NOT call generate() again", async () => {
    const { reservation, contextRepository, billingEngine } = await reserveAndSeed();
    const provider = new ScriptedProvider({
      checkStatus: async () => ({ jobId: "veo-op-resume", status: "COMPLETED", provider: "GOOGLE" }),
      download: async () => ({ jobId: "veo-op-resume", status: "COMPLETED", provider: "GOOGLE", videoUrl: "https://veo-raw/resumed.mp4", duration: 8 }),
    });

    const context = await contextRepository.getOrCreate(reservation.productionId);
    context.veoGeneration = { state: "POLLING", operationId: "veo-op-resume", startedAt: new Date().toISOString() };
    await contextRepository.save(context);

    const { deps } = buildExecuteDeps({ orchestrator: buildOrchestrator(provider), billingEngine, contextRepository });
    const result = await executeVeoSmokeTest(reservation, deps);

    assert.equal(provider.generateCalls, 0, "redelivery must never call generate() when an operationId is already persisted");
    assert.ok(provider.checkStatusCalls >= 1, "redelivery must resume polling the same operation");
    assert.equal(result.status, "COMPLETED");
    assert.equal(result.finalVideoUrl, "https://cloudinary/resumed.mp4");
  });
});

describe("executeVeoSmokeTest — terminal context prevents another generation (5)", () => {
  test("an already-COMPLETED context returns the existing result without calling generate()", async () => {
    const { reservation, contextRepository, billingEngine } = await reserveAndSeed();
    const context = await contextRepository.getOrCreate(reservation.productionId);
    context.finalVideoUrl = "https://cloudinary/already-done.mp4";
    context.finalVideoMetadata = { durationSeconds: 8, resolution: "720p", format: "mp4", bytes: 123 };
    await contextRepository.save(context);

    const provider = new ScriptedProvider({});
    const { deps } = buildExecuteDeps({ orchestrator: buildOrchestrator(provider), billingEngine, contextRepository });

    const result = await executeVeoSmokeTest(reservation, deps);

    assert.equal(provider.generateCalls, 0);
    assert.equal(result.status, "COMPLETED");
    assert.equal(result.finalVideoUrl, "https://cloudinary/already-done.mp4");
    assert.equal(billingEngine.chargeCalls.length, 0, "must not re-charge an already-settled reservation");
  });

  test("an already-FAILED context returns the existing failure without calling generate()", async () => {
    const { reservation, contextRepository, billingEngine } = await reserveAndSeed();
    const context = await contextRepository.getOrCreate(reservation.productionId);
    context.failure = { stage: "VIDEO_GENERATION" as never, message: "already failed" };
    await contextRepository.save(context);

    const provider = new ScriptedProvider({});
    const { deps } = buildExecuteDeps({ orchestrator: buildOrchestrator(provider), billingEngine, contextRepository });

    const result = await executeVeoSmokeTest(reservation, deps);

    assert.equal(provider.generateCalls, 0);
    assert.equal(result.status, "FAILED");
    assert.equal(billingEngine.releaseCalls.length, 0, "must not re-release an already-released reservation");
  });
});

describe("executeVeoSmokeTest — SUBMITTING with no operation id (6: does not resubmit; 7: does not release blindly)", () => {
  test("a context stuck at SUBMITTING with no operationId is marked RECOVERY_REQUIRED, not resubmitted", async () => {
    const { reservation, contextRepository, billingEngine } = await reserveAndSeed();
    const context = await contextRepository.getOrCreate(reservation.productionId);
    context.veoGeneration = { state: "SUBMITTING", startedAt: new Date().toISOString() };
    await contextRepository.save(context);

    const provider = new ScriptedProvider({});
    const { deps } = buildExecuteDeps({ orchestrator: buildOrchestrator(provider), billingEngine, contextRepository });

    const result = await executeVeoSmokeTest(reservation, deps);

    assert.equal(provider.generateCalls, 0, "must never resubmit when a prior attempt may already have reached Veo");
    assert.equal(result.status, "RECOVERY_REQUIRED");
    assert.equal(billingEngine.releaseCalls.length, 0, "must not release credits while the generation's outcome is unknown");
    assert.equal(billingEngine.chargeCalls.length, 0, "must not charge credits while the generation's outcome is unknown");

    const persisted = contextRepository.get(reservation.productionId);
    assert.equal(persisted?.veoGeneration?.state, "RECOVERY_REQUIRED");
  });

  test("a context already marked RECOVERY_REQUIRED returns the same unresolved state on redelivery, without re-attempting anything", async () => {
    const { reservation, contextRepository, billingEngine } = await reserveAndSeed();
    const context = await contextRepository.getOrCreate(reservation.productionId);
    context.veoGeneration = {
      state: "RECOVERY_REQUIRED",
      operationId: "veo-op-unknown-fate",
      startedAt: new Date().toISOString(),
      recoveryReason: "previously flagged",
    };
    await contextRepository.save(context);

    const provider = new ScriptedProvider({});
    const { deps } = buildExecuteDeps({ orchestrator: buildOrchestrator(provider), billingEngine, contextRepository });

    const result = await executeVeoSmokeTest(reservation, deps);

    assert.equal(provider.generateCalls, 0);
    assert.equal(provider.checkStatusCalls, 0, "must not attempt to poll either — already flagged for manual review");
    assert.equal(result.status, "RECOVERY_REQUIRED");
    assert.equal(result.error, "previously flagged");
    assert.equal(billingEngine.releaseCalls.length, 0);
    assert.equal(billingEngine.chargeCalls.length, 0);
  });
});

describe("executeVeoSmokeTest — ambiguous vs confirmed failure classification", () => {
  test("a confirmed pre-generation failure (e.g. invalid request) is released normally, exactly like before", async () => {
    const { reservation, contextRepository, billingEngine } = await reserveAndSeed();
    const provider = new ScriptedProvider({
      generate: async () => {
        throw new VeoProviderError("INVALID_REQUEST", "Veo rejected the request: bad aspect ratio");
      },
    });
    const { deps } = buildExecuteDeps({ orchestrator: buildOrchestrator(provider), billingEngine, contextRepository });

    const result = await executeVeoSmokeTest(reservation, deps);

    assert.equal(result.status, "FAILED");
    assert.equal(billingEngine.releaseCalls.length, 1);
    assert.equal(provider.generateCalls, 1);
  });

  test("an ambiguous submission failure (e.g. timeout) is marked RECOVERY_REQUIRED, not released", async () => {
    const { reservation, contextRepository, billingEngine } = await reserveAndSeed();
    const provider = new ScriptedProvider({
      generate: async () => {
        throw new VeoProviderError("TIMEOUT", "Veo request timed out waiting for a response");
      },
    });
    const { deps } = buildExecuteDeps({ orchestrator: buildOrchestrator(provider), billingEngine, contextRepository });

    const result = await executeVeoSmokeTest(reservation, deps);

    assert.equal(result.status, "RECOVERY_REQUIRED");
    assert.equal(billingEngine.releaseCalls.length, 0);
    assert.equal(billingEngine.chargeCalls.length, 0);
  });

  test("a confirmed Veo-reported failure during polling (operation.error, no errorCode) is released normally", async () => {
    const { reservation, contextRepository, billingEngine } = await reserveAndSeed();
    const provider = new ScriptedProvider({
      checkStatus: async () => ({ jobId: "veo-op-2", status: "FAILED", provider: "GOOGLE", error: "content policy violation" }),
    });
    const { deps } = buildExecuteDeps({ orchestrator: buildOrchestrator(provider), billingEngine, contextRepository });

    const result = await executeVeoSmokeTest(reservation, deps);

    assert.equal(result.status, "FAILED");
    assert.equal(billingEngine.releaseCalls.length, 1);
    assert.match(result.error ?? "", /content policy violation/);
  });

  test("an ambiguous transport failure during polling (POLLING_FAILED errorCode) is marked RECOVERY_REQUIRED, not released — the unconfirmed counterpart to the confirmed-failure test above", async () => {
    const { reservation, contextRepository, billingEngine } = await reserveAndSeed();
    const provider = new ScriptedProvider({
      checkStatus: async () => {
        throw new VeoProviderError("POLLING_FAILED", "transient network error");
      },
    });
    const { deps } = buildExecuteDeps({ orchestrator: buildOrchestrator(provider), billingEngine, contextRepository });

    const result = await executeVeoSmokeTest(reservation, deps);

    assert.equal(result.status, "RECOVERY_REQUIRED");
    assert.equal(billingEngine.releaseCalls.length, 0);
    assert.equal(billingEngine.chargeCalls.length, 0);
  });

  test("resumed polling that confirms a real Veo failure releases correctly (9)", async () => {
    const { reservation, contextRepository, billingEngine } = await reserveAndSeed();
    const context = await contextRepository.getOrCreate(reservation.productionId);
    context.veoGeneration = { state: "POLLING", operationId: "veo-op-resume-fail", startedAt: new Date().toISOString() };
    await contextRepository.save(context);

    const provider = new ScriptedProvider({
      checkStatus: async () => ({ jobId: "veo-op-resume-fail", status: "FAILED", provider: "GOOGLE", error: "quota exceeded" }),
    });
    const { deps } = buildExecuteDeps({ orchestrator: buildOrchestrator(provider), billingEngine, contextRepository });

    const result = await executeVeoSmokeTest(reservation, deps);

    assert.equal(provider.generateCalls, 0);
    assert.equal(result.status, "FAILED");
    assert.equal(billingEngine.releaseCalls.length, 1);
    assert.match(result.error ?? "", /quota exceeded/);
  });
});

describe("executeVeoSmokeTest — Cloudinary failure (10: does not cause another Veo generation)", () => {
  test("an upload throw releases the reservation without ever calling generate() a second time", async () => {
    const { reservation, contextRepository, billingEngine } = await reserveAndSeed();
    const provider = new ScriptedProvider({
      checkStatus: async () => ({ jobId: "veo-op-3", status: "COMPLETED", provider: "GOOGLE" }),
      download: async () => ({ jobId: "veo-op-3", status: "COMPLETED", provider: "GOOGLE", videoUrl: "https://veo-raw/v.mp4" }),
    });
    const { deps } = buildExecuteDeps({
      orchestrator: buildOrchestrator(provider),
      billingEngine,
      contextRepository,
      uploadVideo: async () => {
        throw new Error("Cloudinary upload failed");
      },
    });

    const result = await executeVeoSmokeTest(reservation, deps);

    assert.equal(provider.generateCalls, 1);
    assert.equal(result.status, "FAILED");
    assert.equal(billingEngine.releaseCalls.length, 1);
    assert.equal(billingEngine.chargeCalls.length, 0);
    assert.match(result.error ?? "", /Cloudinary upload failed/);
  });
});

describe("executeVeoSmokeTest — normal BullMQ retry cannot duplicate generation (11)", () => {
  test("invoking executeVeoSmokeTest twice in a row for the same job (simulating BullMQ redelivery) only ever calls generate() once", async () => {
    const { reservation, contextRepository, billingEngine } = await reserveAndSeed();
    const provider = new ScriptedProvider({
      checkStatus: async () => ({ jobId: "veo-op-4", status: "COMPLETED", provider: "GOOGLE" }),
      download: async () => ({ jobId: "veo-op-4", status: "COMPLETED", provider: "GOOGLE", videoUrl: "https://veo-raw/v.mp4", duration: 8 }),
    });
    const orchestrator = buildOrchestrator(provider);
    const { deps } = buildExecuteDeps({ orchestrator, billingEngine, contextRepository });

    const first = await executeVeoSmokeTest(reservation, deps);
    const second = await executeVeoSmokeTest(reservation, deps);

    assert.equal(provider.generateCalls, 1);
    assert.equal(billingEngine.chargeCalls.length, 1);
    assert.equal(second.status, "COMPLETED");
    assert.equal(second.finalVideoUrl, first.finalVideoUrl);
  });
});

describe("executeVeoSmokeTest — Worker A crashes mid-poll, Worker B resumes (the most important test)", () => {
  test("Worker A submits Veo and persists the operation id, then 'crashes' before polling; Worker B (a separate RenderOrchestrator instance, sharing only the durable context/billing state) resumes polling the same operation to completion without calling generate() again", async () => {
    const { reservation, contextRepository, billingEngine } = await reserveAndSeed();

    // The real Veo API — same underlying service reachable from both
    // "workers," exactly as it would be in production (Veo doesn't care
    // which of our processes calls it).
    const veoBackend = new ScriptedProvider({
      generate: async () => ({ jobId: "veo-operation-xyz", status: "PROCESSING", provider: "GOOGLE" }),
      checkStatus: async () => ({ jobId: "veo-operation-xyz", status: "COMPLETED", provider: "GOOGLE" }),
      download: async () => ({
        jobId: "veo-operation-xyz",
        status: "COMPLETED",
        provider: "GOOGLE",
        videoUrl: "https://veo-raw/resumed.mp4",
        duration: 8,
        resolution: "720p",
      }),
    });

    // --- Worker A: its own RenderOrchestrator instance (own empty
    // in-memory job map), standing in for one Node process. It submits
    // Veo directly (the same call executeVeoSmokeTest's fresh-submit path
    // makes internally) and persists exactly what markPolling() would —
    // then "crashes": nothing further ever runs on this instance. A real
    // SIGKILL mid-poll leaves precisely this durable state behind (the
    // POLLING write already completed; nothing after it ever got the
    // chance to run), which is what this simulates. ---
    const workerAOrchestrator = buildOrchestrator(veoBackend);
    const submitted = await workerAOrchestrator.render({
      prompt: reservation.prompt,
      aspectRatio: reservation.aspectRatio,
      durationSeconds: reservation.durationSeconds,
    });
    assert.equal(submitted.status, "PROCESSING");
    const operationId = submitted.metadata?.providerJobId as string;
    assert.equal(operationId, "veo-operation-xyz");
    assert.equal(veoBackend.generateCalls, 1);

    const contextAfterCrash = await contextRepository.getOrCreate(reservation.productionId);
    contextAfterCrash.veoGeneration = { state: "POLLING", operationId, startedAt: new Date().toISOString() };
    await contextRepository.save(contextAfterCrash);

    // --- Worker B: a completely separate RenderOrchestrator instance
    // (simulating BullMQ redelivering the job to a different worker
    // process after the stalled-job checker notices Worker A never
    // renewed its lock), driven through the harness's real,
    // production-path executeVeoSmokeTest(). ---
    const workerBOrchestrator = buildOrchestrator(veoBackend);
    const { deps: workerBDeps } = buildExecuteDeps({ orchestrator: workerBOrchestrator, billingEngine, contextRepository });

    const result = await executeVeoSmokeTest(reservation, workerBDeps);

    assert.equal(
      veoBackend.generateCalls,
      1,
      "Worker B must NOT call generate() again — that would be a second, duplicate, paid Veo generation"
    );
    assert.ok(veoBackend.checkStatusCalls >= 1, "Worker B must actually resume polling the operation Worker A submitted");
    assert.equal(result.status, "COMPLETED");
    assert.equal(result.finalVideoUrl, "https://cloudinary/resumed.mp4");
    assert.equal(billingEngine.chargeCalls.length, 1, "the reservation must be settled exactly once, by Worker B");
    assert.equal(billingEngine.releaseCalls.length, 0);

    const finalContext = contextRepository.get(reservation.productionId);
    assert.equal(finalContext?.finalVideoUrl, "https://cloudinary/resumed.mp4");
  });
});
