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
 * ── In-flight generation recovery (state machine) ──────────────────────
 *
 * Moving execution to Railway removed Vercel's 60s timeout risk, but
 * introduced a different one: a Railway worker process can itself crash
 * (OOM, redeploy, manual restart) after a real Veo generation has been
 * submitted but before its result is durably recorded. BullMQ's
 * stalled-job checker (independent of `attempts` — see queue.js's
 * addVeoSmokeTestJob()) can then redeliver that job to another worker
 * attempt. Without tracking the in-flight state, that redelivery would
 * call generate() a second time — a second real, paid Veo generation.
 *
 * The fix: persist ProductionContext.veoGeneration (see
 * ProductionContextRepository.ts's doc comment for the full state
 * machine) at exactly two points — SUBMITTING immediately before
 * generate() is ever called, POLLING (with the real provider operationId,
 * exposed via RenderOrchestrator's RenderResult.metadata.providerJobId)
 * immediately after generate() confirms an operation now exists at the
 * provider, before any polling begins. On redelivery:
 *   - POLLING with an operationId -> resume polling via
 *     RenderOrchestrator.resumeJob()/pollUntilTerminal() — generate() is
 *     never called again.
 *   - SUBMITTING with no operationId -> generate() may or may not have
 *     reached the provider before the crash; this is genuinely ambiguous,
 *     so it is marked RECOVERY_REQUIRED rather than guessed at. Neither
 *     resubmitting nor releasing credits is safe here (see the Google
 *     Veo SDK investigation this design is based on: @google/genai
 *     exposes no vendor-side idempotency key, so a second generate() call
 *     cannot be deduplicated by the provider itself).
 *   - RECOVERY_REQUIRED -> already flagged; redelivery must not
 *     re-attempt classification or generation, only report the same
 *     unresolved state.
 * The same RECOVERY_REQUIRED outcome is also used mid-poll, for a
 * transport-level failure (RenderResult.metadata.errorCode present —
 * POLLING_FAILED/TIMEOUT/DOWNLOAD_FAILED/OPERATION_FAILED) where the
 * operation's true state at the provider could not be confirmed, as
 * opposed to a confirmed Veo-reported failure (operation.error, which
 * GoogleGenAIVeoClient.checkStatus() returns normally with no errorCode)
 * — only the latter is safe to release credits against.
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
 * Both entry functions take every collaborator as an injected dependency
 * and contain no construction logic of their own (no `new BillingEngine()`,
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
import type { RenderResult } from "../rendering/interfaces/RenderResult";
import type { ProviderId } from "../rendering/interfaces/RenderProvider";
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
  /** Forwarded to RenderOrchestrator.pollUntilTerminal() (see driveToCompletion() below) — overridable so this isn't hard-bound to the orchestrator's 5s/36-attempt defaults. Omit to use those defaults; tests use a short interval so the suite doesn't take minutes. */
  pollOptions?: { pollIntervalMs?: number; maxAttempts?: number };
}

export interface VeoSmokeTestResult {
  productionId: string;
  status: "COMPLETED" | "FAILED" | "RECOVERY_REQUIRED";
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
 * VeoProviderErrorCode values (see VeoProviderError.ts) that a render()
 * failure can carry which are confirmed to mean the request never reached
 * (or was definitively, synchronously rejected by) the provider — safe to
 * treat as a normal, pre-generation failure and release credits. Every
 * other code (or no code at all — a plain thrown Error) reaching a
 * render() FAILED result means we cannot rule out the request having
 * reached Veo before whatever failed, so it is treated as
 * RECOVERY_REQUIRED instead of guessed at. See this file's header for the
 * full reasoning.
 */
const CONFIRMED_PRE_GENERATION_FAILURE_CODES = new Set([
  "MISSING_API_KEY",
  "AUTHENTICATION_FAILED",
  "INVALID_REQUEST",
  "UNSUPPORTED_CAPABILITY",
  "INVALID_DURATION",
  "INVALID_RESOLUTION",
]);

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
 * production, then settles (success) or releases (confirmed failure) the
 * reservation — or, when the generation's true outcome cannot be
 * confirmed, marks it RECOVERY_REQUIRED without touching credits at all.
 *
 * The very first thing this function does — before any provider call — is
 * re-fetch the ProductionContext via getPersisted() (the durable,
 * cross-instance-safe read) and act on any in-flight veoGeneration state
 * already recorded (see this file's header for the full state machine).
 * This repository is this productionId's exclusive writer for its entire
 * lifecycle (created fresh by reserveVeoSmokeTest(), only ever mutated by
 * this function afterward), so any state found here can only have been
 * written by a previous run of this same function for this same
 * productionId — never a stale/unrelated value.
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

  if (existing?.veoGeneration) {
    const gen = existing.veoGeneration;

    if (gen.state === "POLLING" && gen.operationId) {
      // Resume — never call generate() again. Re-seed a fresh
      // RenderOrchestrator's job map from the persisted operation id and
      // continue polling exactly where the previous attempt left off.
      deps.orchestrator.resumeJob(job.productionId, job.provider as ProviderId, gen.operationId);
      const result = await deps.orchestrator.pollUntilTerminal(job.productionId, deps.pollOptions);
      return finishGeneration(job, deps, result);
    }

    if (gen.state === "RECOVERY_REQUIRED") {
      // Already flagged — redelivery must not re-attempt classification
      // or generation, only report the same unresolved state.
      return {
        productionId: job.productionId,
        status: "RECOVERY_REQUIRED",
        reservationId: job.reservationId,
        provider: job.provider,
        requestedDurationSeconds: job.durationSeconds,
        error: gen.recoveryReason,
      };
    }

    // state === "SUBMITTING" with no operationId (or POLLING with no
    // operationId, structurally shouldn't happen but treated the same
    // defensively): a previous attempt may have already reached the
    // provider before crashing. Do not resubmit, do not release.
    return recoveryRequired(
      deps,
      job,
      "A previous attempt reached SUBMITTING without recording a Veo operation id; it may have already started a real generation. Refusing to submit again."
    );
  }

  // Fresh attempt — nothing has been submitted for this productionId yet.
  await markSubmitting(deps, job);

  let submitted: RenderResult;
  try {
    submitted = await deps.orchestrator.render({
      prompt: job.prompt,
      aspectRatio: job.aspectRatio,
      durationSeconds: job.durationSeconds,
    });
  } catch (error) {
    // render() is documented to never throw for a provider-side failure —
    // but if it ever does, markSubmitting() above has already been
    // persisted, so we can no longer rule out the request having reached
    // Veo before this threw. Ambiguous, not a confirmed failure.
    const message = error instanceof Error ? error.message : String(error);
    return recoveryRequired(deps, job, `Submitting the Veo generation threw unexpectedly: ${message}`);
  }

  if (submitted.status === "FAILED") {
    const code = submitted.metadata?.errorCode as string | undefined;
    if (code && CONFIRMED_PRE_GENERATION_FAILURE_CODES.has(code)) {
      // Local validation or a definite synchronous rejection from the
      // provider (bad API key, malformed request, auth failure) — the
      // request either never left this process or was explicitly
      // rejected. No operation was created. Safe to release.
      return recordFailure(deps, job, submitted.error ?? "Veo rejected the generation request.", code);
    }
    // TIMEOUT, GENERATION_FAILED (the unclassified fallback), or no code
    // at all — we cannot be certain the request never reached Veo (e.g. a
    // network timeout waiting for the response gives no proof either
    // way). Treat as unresolved rather than guessing.
    return recoveryRequired(
      deps,
      job,
      submitted.error ?? "Submitting the Veo generation failed ambiguously; it may or may not have reached the provider."
    );
  }

  const operationId = submitted.metadata?.providerJobId as string | undefined;
  if (!operationId) {
    // Should not happen — RenderOrchestrator.render() always attaches
    // metadata.providerJobId on a non-FAILED result (see RenderOrchestrator.ts).
    // If it ever did, we're in the same ambiguous spot as a crash before
    // persistence: a real operation may exist with no id we can act on.
    return recoveryRequired(deps, job, "Veo accepted the generation but no operation id was returned to track it.");
  }

  // The critical persist: from this point on, a crash before completion
  // must resume via operationId, never resubmit. Deliberately not
  // best-effort/.catch()'d — if this specific save fails, the context is
  // left at SUBMITTING with no operationId, which the guard above
  // correctly treats as RECOVERY_REQUIRED on the next attempt, rather
  // than silently losing track of a real, already-running generation.
  await markPolling(deps, job, operationId);

  const finalResult = await driveToCompletion(deps.orchestrator, submitted, deps.pollOptions);
  return finishGeneration(job, deps, finalResult);
}

/** Mirrors RenderOrchestrator.renderAndWait()'s own post-submit logic (COMPLETED-without-videoUrl needs one more download() call; PENDING/PROCESSING needs polling), using only its public methods. */
async function driveToCompletion(
  orchestrator: RenderOrchestrator,
  submitted: RenderResult,
  pollOptions: VeoSmokeTestExecuteDependencies["pollOptions"]
): Promise<RenderResult> {
  if (submitted.status === "COMPLETED") {
    return submitted.videoUrl ? submitted : orchestrator.download(submitted.jobId);
  }
  return orchestrator.pollUntilTerminal(submitted.jobId, pollOptions);
}

/** Common landing point for both the fresh-submit and resume paths once a terminal (or ambiguous) RenderResult is in hand. */
async function finishGeneration(
  job: VeoSmokeTestReservation,
  deps: VeoSmokeTestExecuteDependencies,
  result: RenderResult
): Promise<VeoSmokeTestResult> {
  if (result.status !== "COMPLETED" || !result.videoUrl) {
    const code = result.metadata?.errorCode as string | undefined;
    if (!code) {
      // No errorCode means checkStatus()/download() returned normally
      // with a confirmed operation.error from Veo itself (see
      // GoogleGenAIVeoClient.checkStatus()) — the provider has
      // definitively told us this generation failed, not that we merely
      // failed to ask. Safe to release.
      return recordFailure(deps, job, result.error ?? "Veo reported the generation failed.", undefined);
    }
    // POLLING_FAILED / TIMEOUT / DOWNLOAD_FAILED / OPERATION_FAILED: a
    // transport-level failure talking to Veo, not a confirmed answer from
    // Veo about the operation itself. The operation may already have
    // completed, or may still be running — we simply failed to observe
    // it. Do not release, do not consume, do not retry.
    return recoveryRequired(deps, job, result.error ?? "Could not confirm the Veo operation's outcome.");
  }

  try {
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
    // The generation itself is confirmed complete at this point (a real
    // videoUrl is in hand) — an upload/charge/persist failure here is not
    // an "unknown provider state," it's a known-successful generation we
    // failed to deliver. Safe to release, exactly as before.
    const message = error instanceof Error ? error.message : String(error);
    return recordFailure(deps, job, message, undefined);
  }
}

async function markSubmitting(deps: VeoSmokeTestExecuteDependencies, job: VeoSmokeTestReservation): Promise<void> {
  const context = await deps.contextRepository.getOrCreate(job.productionId);
  context.veoGeneration = { state: "SUBMITTING", startedAt: new Date().toISOString() };
  await deps.contextRepository.save(context);
}

async function markPolling(
  deps: VeoSmokeTestExecuteDependencies,
  job: VeoSmokeTestReservation,
  operationId: string
): Promise<void> {
  const context = await deps.contextRepository.getOrCreate(job.productionId);
  context.veoGeneration = {
    state: "POLLING",
    operationId,
    startedAt: context.veoGeneration?.startedAt ?? new Date().toISOString(),
  };
  await deps.contextRepository.save(context);
}

/**
 * Marks a production RECOVERY_REQUIRED: the external generation's true
 * outcome could not be confirmed, so credits are neither consumed nor
 * released, and generation is never retried automatically. A human
 * operator must resolve this by checking the Veo/Cloud console directly
 * against veoGeneration.operationId (if present), then manually settling
 * or releasing the reservation — this file does not invent a second
 * billing system to do that automatically.
 */
async function recoveryRequired(
  deps: VeoSmokeTestExecuteDependencies,
  job: VeoSmokeTestReservation,
  reason: string
): Promise<VeoSmokeTestResult> {
  const context = await deps.contextRepository.getOrCreate(job.productionId);
  context.veoGeneration = {
    state: "RECOVERY_REQUIRED",
    operationId: context.veoGeneration?.operationId,
    startedAt: context.veoGeneration?.startedAt ?? new Date().toISOString(),
    recoveryReason: reason,
  };
  await deps.contextRepository.save(context).catch(() => {});

  return {
    productionId: job.productionId,
    status: "RECOVERY_REQUIRED",
    reservationId: job.reservationId,
    provider: job.provider,
    requestedDurationSeconds: job.durationSeconds,
    error: reason,
  };
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
