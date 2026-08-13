/**
 * VeoSmokeTestHarness.ts
 *
 * Internal/developer-only single-shot Veo generation, exercised through
 * app/api/internal/veo-smoke-test/route.ts (admin-only — see that file).
 * Exists specifically because Movie Studio's MovieProductionService is
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
 *     table/persistence MovieProductionService uses.
 *   - RenderOrchestrator — the same submit/poll/download sequence Movie
 *     Studio's real Stage 4 uses, calling GoogleVeoProvider unmodified.
 *   - A caller-supplied uploadVideo function — expected to be backed by
 *     the same CloudinaryStorageClient MovieProductionFactory.ts uses
 *     (see the route file), not a new upload implementation.
 *
 * This module takes every collaborator as an injected dependency and
 * contains no construction logic of its own (no `new BillingEngine()`,
 * no `new RenderOrchestrator()`, no env var reads) — that's the route
 * file's job. This keeps the orchestration logic here fully unit-testable
 * with fakes, and keeps "which provider," "which credentials," "force
 * GOOGLE, no LTX fallback" as the route's concern, not this file's.
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

export interface VeoSmokeTestDependencies {
  billingEngine: BillingEngine;
  contextRepository: ProductionContextRepository;
  /** Pre-configured to force provider selection (e.g. always "GOOGLE") — this file never chooses a provider itself. */
  orchestrator: RenderOrchestrator;
  /** Expected to be backed by the same CloudinaryStorageClient MovieProductionFactory.ts constructs — see the route file. */
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
/** GOOGLE is the only provider this harness ever reserves credits against — matches whichever provider `deps.orchestrator` is configured to force (see the route file's ForceProviderSelector). Kept as a constant here, not derived from the orchestrator, so the reservation's providerId can never silently drift from what the route intends. */
const PROVIDER_ID = "GOOGLE";

/**
 * Runs exactly one Veo generation end to end: create ProductionContext,
 * reserve credits, render (single renderAndWait() call — no loop, no
 * retry, no fallback to a different provider), then either settle the
 * reservation and upload to Cloudinary (success) or release the
 * reservation and record the failure (any failure path, including an
 * unexpected throw from the upload step).
 */
export async function runVeoSmokeTest(
  params: VeoSmokeTestParams,
  deps: VeoSmokeTestDependencies
): Promise<VeoSmokeTestResult> {
  const productionId = randomUUID();
  const durationSeconds = params.durationSeconds ?? DEFAULT_DURATION_SECONDS;
  const aspectRatio = params.aspectRatio ?? DEFAULT_ASPECT_RATIO;

  const initialContext = await deps.contextRepository.getOrCreate(productionId);
  initialContext.userId = params.userId;
  await deps.contextRepository.save(initialContext);

  const reservation = await deps.billingEngine.reserveForProduction(params.userId, productionId, [
    { category: UsageCategory.Videos, providerId: PROVIDER_ID, videoLengthSeconds: durationSeconds },
  ]);

  try {
    // Exactly one call — no loop, no retry, no re-invocation on failure.
    const result = await deps.orchestrator.renderAndWait({
      prompt: params.prompt,
      aspectRatio,
      durationSeconds,
    });

    if (result.status !== "COMPLETED" || !result.videoUrl) {
      return await recordFailure(deps, productionId, reservation.id, result.error ?? "Veo did not return a video URL.", result.metadata?.errorCode as string | undefined, durationSeconds);
    }

    const upload = await deps.uploadVideo(result.videoUrl, `veo-smoke-test-${productionId}`);

    await deps.billingEngine.chargeUsage(reservation.id, params.userId, productionId, {
      category: UsageCategory.Videos,
      providerId: PROVIDER_ID,
      videoLengthSeconds: result.duration ?? durationSeconds,
    });

    const finalVideoMetadata = {
      durationSeconds: result.duration ?? durationSeconds,
      resolution: result.resolution ?? "",
      format: upload.format ?? "mp4",
      bytes: upload.bytes ?? 0,
    };

    const successContext = await deps.contextRepository.getOrCreate(productionId);
    successContext.finalVideoUrl = upload.secureUrl;
    successContext.finalVideoMetadata = finalVideoMetadata;
    await deps.contextRepository.save(successContext);

    return {
      productionId,
      status: "COMPLETED",
      reservationId: reservation.id,
      provider: PROVIDER_ID,
      requestedDurationSeconds: durationSeconds,
      finalVideoUrl: upload.secureUrl,
      finalVideoMetadata,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return recordFailure(deps, productionId, reservation.id, message, undefined, durationSeconds);
  }
}

async function recordFailure(
  deps: VeoSmokeTestDependencies,
  productionId: string,
  reservationId: string,
  message: string,
  errorCode: string | undefined,
  durationSeconds: number
): Promise<VeoSmokeTestResult> {
  // Best-effort: a release/save failure here must not mask the original
  // failure being reported, and must not trigger any retry of the
  // generation itself.
  await deps.billingEngine.releaseReservation(reservationId, `Veo smoke test failed: ${message}`).catch(() => {});

  const failedContext = await deps.contextRepository.getOrCreate(productionId);
  failedContext.failure = { stage: ProductionStage.VideoGeneration, message };
  await deps.contextRepository.save(failedContext).catch(() => {});

  return {
    productionId,
    status: "FAILED",
    reservationId,
    provider: PROVIDER_ID,
    requestedDurationSeconds: durationSeconds,
    error: message,
    errorCode,
  };
}
