/**
 * VeoSmokeTestHarness.ts
 *
 * Internal/developer-only single-shot Veo generation. Split into two halves
 * across the Vercel -> Railway boundary (see app/api/internal/veo-smoke-test/route.ts
 * and worker/src/services/veoSmokeTestWorker.js):
 *
 *   - reserveVeoSmokeTest() runs on Vercel: creates the ProductionContext and
 *     reserves credits, then returns immediately. It never calls the
 *     RenderOrchestrator and never uploads anything.
 *   - executeVeoSmokeTest() runs on the Railway worker: performs the single
 *     Veo generation, the Cloudinary upload, and the billing
 *     settlement/release, with no execution-time ceiling.
 *
 * This split exists because Vercel's Hobby plan hard-kills any function
 * after 60 seconds regardless of `maxDuration` — a real Veo generation
 * (submit, poll, download) routinely takes minutes, so running it
 * synchronously in a Vercel request handler risks the function being
 * killed mid-flight with credits already reserved and no path to release
 * them (the same incident class as commit 8ec36f43). Railway is a plain
 * long-running process with no such ceiling.
 *
 * Still exists specifically because Movie Studio's MovieProductionService is
 * atomic (Story Analysis through Movie Assembly in one call, an unknown
 * number of scenes, one Veo call per scene) and has no way to guarantee
 * "exactly one Veo generation" — the one hard requirement this harness
 * exists to satisfy.
 *
 * Deliberately reuses, not reimplements, every real subsystem:
 *   - BillingEngine.reserveForProduction()/chargeUsage()/releaseReservation()
 *     — the same Supabase reserve_credits/consume_credits/release_credits
 *     RPCs every other production uses. No direct users.credits write
 *     anywhere in this file.
 *   - ProductionContextRepository — the same movie_production_contexts
 *     table/persistence MovieProductionService uses. executeVeoSmokeTest()
 *     reads via getPersisted() specifically because that's the
 *     cross-instance-safe read (see that method's doc comment) — the
 *     Railway worker that executes a job is not necessarily the same
 *     process that reserved it.
 *   - RenderOrchestrator — the same submit/poll/download sequence Movie
 *     Studio's real Stage 4 uses, calling GoogleVeoProvider unmodified.
 *   - A caller-supplied uploadVideo function — expected to be backed by
 *     the same CloudinaryStorageClient MovieProductionFactory.ts uses
 *     (see the worker file), not a new upload implementation.
 *
 * Both functions take every collaborator as an injected dependency and
 * contain no construction logic of their own (no `new BillingEngine()`,
 * no `new RenderOrchestrator()`, no env var reads) — that's the route/worker
 * files' job. This keeps the orchestration logic here fully unit-testable
 * with fakes, and keeps "which provider," "which credentials," "force
 * GOOGLE, no LTX fallback" as their concern, not this file's.
 */

import { randomUUID } from "crypto";
import type { BillingEngine } from "../billing/BillingEngine";
import { UsageCategory } from "../billing/BillingTypes";
import type { ProductionContextRepository, ProductionContext } from "../infrastructure/ProductionContextRepository";
import type { RenderOrchestrator } from "../rendering/RenderOrchestrator";
import { ProductionStage } from "../ai/orchestration/MovieProductionContracts";

export interface VeoSmokeTestParams {
  userId: string;
  prompt: string;
  aspectRatio?: string;
  durationSeconds?: number;
}

export interface VeoSmokeTestUploadResult {
  secureUrl: string;
  bytes?: number;
  format?: string;
}

/**
 * The full description of a reserved-but-not-yet-executed smoke test — this
 * is the shape that crosses the Vercel -> Railway boundary as a BullMQ job
 * payload (see worker/src/services/queue.js's addVeoSmokeTestJob()).
 */
export interface VeoSmokeTestReservation {
  productionId: string;
  userId: string;
  reservationId: string;
  provider: string;
  prompt: string;
  aspectRatio: string;
  durationSeconds: number;
}

export interface VeoSmokeTestReserveDependencies {
  billingEngine: BillingEngine;
  contextRepository: ProductionContextRepository;
}

export interface VeoSmokeTestExecuteDependencies {
  billingEngine: BillingEngine;
  contextRepository: ProductionContextRepository;
  /** Pre-configured to force provider selection (e.g. always "GOOGLE") — this file never chooses a provider itself. */
  orchestrator: RenderOrchestrator;
  /** Expected to be backed by the same CloudinaryStorageClient MovieProductionFactory.ts constructs — see the worker file. */
  uploadVideo: (sourceUrl: string, publicId: string) => Promise<VeoSmokeTestUploadResult>;
}

export interface VeoSmokeTestResult {
  productionId: string;
  status: "COMPLETED" | "FAILED";
  reservationId: string;
  provider: string;
  requestedDurationSeconds: number;
  finalVideoUrl?: string;
  finalVideoMetadata?: NonNullable<ProductionContext["finalVideoMetadata"]>;
  error?: string;
  errorCode?: string;
}

const DEFAULT_ASPECT_RATIO = "9:16";
const DEFAULT_DURATION_SECONDS = 8;
/** GOOGLE is the only provider this harness ever reserves credits against — matches whichever provider the worker's orchestrator is configured to force. Kept as a constant here, not derived from the orchestrator, so the reservation's providerId can never silently drift from what the route/worker intends. */
const PROVIDER_ID = "GOOGLE";

/**
 * Vercel side: creates the ProductionContext and reserves credits, then
 * returns immediately. Does not call the orchestrator, does not upload
 * anything, and makes no network call whose duration depends on Veo.
 */
export async function reserveVeoSmokeTest(
  params: VeoSmokeTestParams,
  deps: VeoSmokeTestReserveDependencies
): Promise<VeoSmokeTestReservation> {
  const productionId = randomUUID();
  const durationSeconds = params.durationSeconds ?? DEFAULT_DURATION_SECONDS;
  const aspectRatio = params.aspectRatio ?? DEFAULT_ASPECT_RATIO;

  const initialContext = await deps.contextRepository.getOrCreate(productionId);
  initialContext.userId = params.userId;
  await deps.contextRepository.save(initialContext);

  const reservation = await deps.billingEngine.reserveForProduction(params.userId, productionId, [
    { category: UsageCategory.Videos, providerId: PROVIDER_ID, videoLengthSeconds: durationSeconds },
  ]);

  return {
    productionId,
    userId: params.userId,
    reservationId: reservation.id,
    provider: PROVIDER_ID,
    prompt: params.prompt,
    aspectRatio,
    durationSeconds,
  };
}

/**
 * Railway side: runs the single Veo generation against an already-reserved
 * production, then settles (success) or releases (failure) the reservation.
 *
 * The very first thing this function does — before any render call — is
 * re-fetch the ProductionContext via getPersisted() and return early if
 * this productionId is already terminal (has a finalVideoUrl or a recorded
 * failure). This is a deliberate CODE-level idempotency guard, distinct
 * from DB-level reservation idempotency: BullMQ can redeliver a job to a
 * second worker if the first worker's lock stalls (a mechanism entirely
 * separate from its `attempts` retry count — see queue.js's
 * addVeoSmokeTestJob()), and that redelivery happens before this function
 * ever touches billing. DB-level idempotency on reserve/consume/release
 * protects the ledger from being double-counted; it does nothing to stop a
 * second real, paid Veo API call from being made in the first place. Only a
 * check made before renderAndWait() can do that.
 *
 * This repository is this productionId's exclusive writer for its entire
 * lifecycle (created fresh by reserveVeoSmokeTest(), only ever mutated by
 * this function afterward), so a `failure` or `finalVideoUrl` found here
 * can only have been written by a previous run of this same function for
 * this same productionId — never a stale/unrelated value.
 */
export async function executeVeoSmokeTest(
  job: VeoSmokeTestReservation,
  deps: VeoSmokeTestExecuteDependencies
): Promise<VeoSmokeTestResult> {
  const existing = await deps.contextRepository.getPersisted(job.productionId);

  if (existing?.finalVideoUrl) {
    return {
      productionId: job.productionId,
      status: "COMPLETED",
      reservationId: job.reservationId,
      provider: job.provider,
      requestedDurationSeconds: job.durationSeconds,
      finalVideoUrl: existing.finalVideoUrl,
      finalVideoMetadata: existing.finalVideoMetadata,
    };
  }

  if (existing?.failure) {
    return {
      productionId: job.productionId,
      status: "FAILED",
      reservationId: job.reservationId,
      provider: job.provider,
      requestedDurationSeconds: job.durationSeconds,
      error: existing.failure.message,
    };
  }

  try {
    // Exactly one call — no loop, no retry, no re-invocation on failure.
    const result = await deps.orchestrator.renderAndWait({
      prompt: job.prompt,
      aspectRatio: job.aspectRatio,
      durationSeconds: job.durationSeconds,
    });

    if (result.status !== "COMPLETED" || !result.videoUrl) {
      return await recordFailure(deps, job, result.error ?? "Veo did not return a video URL.", result.metadata?.errorCode as string | undefined);
    }

    const upload = await deps.uploadVideo(result.videoUrl, `veo-smoke-test-${job.productionId}`);

    await deps.billingEngine.chargeUsage(job.reservationId, job.userId, job.productionId, {
      category: UsageCategory.Videos,
      providerId: job.provider,
      videoLengthSeconds: result.duration ?? job.durationSeconds,
    });

    const finalVideoMetadata = {
      durationSeconds: result.duration ?? job.durationSeconds,
      resolution: result.resolution ?? "",
      format: upload.format ?? "mp4",
      bytes: upload.bytes ?? 0,
    };

    const successContext = await deps.contextRepository.getOrCreate(job.productionId);
    successContext.finalVideoUrl = upload.secureUrl;
    successContext.finalVideoMetadata = finalVideoMetadata;
    await deps.contextRepository.save(successContext);

    return {
      productionId: job.productionId,
      status: "COMPLETED",
      reservationId: job.reservationId,
      provider: job.provider,
      requestedDurationSeconds: job.durationSeconds,
      finalVideoUrl: upload.secureUrl,
      finalVideoMetadata,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return recordFailure(deps, job, message, undefined);
  }
}

async function recordFailure(
  deps: VeoSmokeTestExecuteDependencies,
  job: VeoSmokeTestReservation,
  message: string,
  errorCode: string | undefined
): Promise<VeoSmokeTestResult> {
  // Best-effort: a release/save failure here must not mask the original
  // failure being reported, and must not trigger any retry of the
  // generation itself.
  await deps.billingEngine.releaseReservation(job.reservationId, `Veo smoke test failed: ${message}`).catch(() => {});

  const failedContext = await deps.contextRepository.getOrCreate(job.productionId);
  failedContext.failure = { stage: ProductionStage.VideoGeneration, message };
  await deps.contextRepository.save(failedContext).catch(() => {});

  return {
    productionId: job.productionId,
    status: "FAILED",
    reservationId: job.reservationId,
    provider: job.provider,
    requestedDurationSeconds: job.durationSeconds,
    error: message,
    errorCode,
  };
}
