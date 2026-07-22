/**
 * VeoGenerator.ts
 *
 * Orchestrates generating a batch of scenes through an injected
 * VideoGenerationProvider: submit every scene, poll until each completes,
 * download finished results, retry transient failures, and aggregate
 * statistics. Contains no vendor code — VeoGenerator only knows the
 * vendor-neutral VideoGenerationProvider contract, never Veo or any other
 * backend specifically. Pure orchestration: no rendering implementation,
 * no network code of its own (all I/O goes through the injected provider).
 *
 * Per explicit instruction, SceneGenerationResult is not part of this
 * architecture and is neither imported nor defined here. VeoGenerator
 * consumes SceneGenerationRequest (input) and produces VideoGenerationResult
 * (output) only.
 *
 * Design note: BatchGenerationProgress is used internally to drive the
 * polling loop's termination condition (recomputed each poll cycle from
 * the running completed/failed/active counts) rather than being streamed
 * out through a callback — GenerationOptions was specified with exactly
 * three fields (pollIntervalMs, maxRetries, continueOnFailure), so no
 * onProgress hook was added beyond that.
 *
 * Migration note: SceneGenerationRequest no longer carries reference image
 * data (ReferenceImageGenerator was refactored into a prompt-only module).
 * toVideoGenerationRequest() sends an empty referenceImages array to the
 * provider for now — see the TODO on that method for what's missing and
 * where it will come from.
 */

import type {
  VideoGenerationProvider,
  VideoGenerationProgress,
  VideoGenerationResult,
} from "./AIVideoProvider";
import type { SceneGenerationRequest } from "./ScenePromptBuilder";

const DEFAULT_POLL_INTERVAL_MS = 5000;
const DEFAULT_MAX_RETRIES = 2;

/**
 * Tunable behavior for a generateBatch() call.
 */
export interface GenerationOptions {
  /** Milliseconds between progress polls. Defaults to 5000. */
  pollIntervalMs?: number;
  /** Additional attempts after the first, per provider call. Defaults to 2. */
  maxRetries?: number;
  /** If false, the first unrecoverable scene failure aborts the whole batch. Defaults to true. */
  continueOnFailure?: boolean;
}

/**
 * A snapshot of batch progress at a point in time.
 */
export interface BatchGenerationProgress {
  totalScenes: number;
  completedScenes: number;
  failedScenes: number;
  activeScenes: number;
  percentComplete: number;
}

/**
 * A single scene that could not be generated, after exhausting retries.
 */
export interface FailedSceneOperation {
  sceneId: string;
  operationId?: string;
  reason: string;
}

/**
 * Aggregate statistics for a completed generateBatch() call.
 */
export interface GenerationStatistics {
  totalScenes: number;
  completed: number;
  failed: number;
  elapsedMs: number;
  averageRenderTimeMs: number;
}

/**
 * The full outcome of a generateBatch() call.
 */
export interface BatchGenerationResult {
  generatedVideos: VideoGenerationResult[];
  failedOperations: FailedSceneOperation[];
  statistics: GenerationStatistics;
}

/**
 * Thrown for unrecoverable batch failures: invalid input, or (when
 * continueOnFailure is false) the first scene that exhausts its retries.
 */
export class VeoGenerationError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = "VeoGenerationError";
  }
}

interface OperationContext {
  operationId: string;
  request: SceneGenerationRequest;
  submittedAt: number;
}

/**
 * Orchestrates batch video generation over an injected
 * VideoGenerationProvider. Pure orchestration — no vendor code, no
 * rendering logic, no network implementation of its own.
 */
export class VeoGenerator {
  constructor(private readonly provider: VideoGenerationProvider) {}

  /**
   * Submits every request for generation, polls until each completes (or
   * fails), downloads finished results, and returns the aggregated batch
   * outcome.
   */
  async generateBatch(
    requests: SceneGenerationRequest[],
    options?: GenerationOptions
  ): Promise<BatchGenerationResult> {
    this.validateRequests(requests);

    const pollIntervalMs = options?.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS;
    const maxRetries = options?.maxRetries ?? DEFAULT_MAX_RETRIES;
    const continueOnFailure = options?.continueOnFailure ?? true;

    const startedAt = Date.now();
    const failedOperations: FailedSceneOperation[] = [];
    const generatedVideos: VideoGenerationResult[] = [];
    const renderTimesMs: number[] = [];

    // 2-3. Submit every scene, storing its operation ID.
    const pending = new Map<string, OperationContext>();
    for (const request of requests) {
      try {
        const operationId = await this.withRetries(
          () => this.provider.startGeneration(this.toVideoGenerationRequest(request)),
          maxRetries
        );
        pending.set(request.sceneId, { operationId, request, submittedAt: Date.now() });
      } catch (error) {
        this.recordFailure(
          failedOperations,
          { sceneId: request.sceneId, reason: this.describeError(error) },
          continueOnFailure,
          `Failed to submit scene "${request.sceneId}"`,
          error
        );
      }
    }

    // 4-6. Poll until every submitted scene reaches a terminal state,
    // downloading each as soon as it completes.
    let progress = this.summarizeProgress(requests.length, generatedVideos.length, failedOperations.length, pending.size);

    while (progress.activeScenes > 0) {
      for (const [sceneId, context] of [...pending]) {
        let statusResult: VideoGenerationProgress;
        try {
          statusResult = await this.withRetries(
            () => this.provider.checkProgress(context.operationId),
            maxRetries
          );
        } catch (error) {
          pending.delete(sceneId);
          this.recordFailure(
            failedOperations,
            { sceneId, operationId: context.operationId, reason: this.describeError(error) },
            continueOnFailure,
            `Failed to check progress for scene "${sceneId}"`,
            error
          );
          continue;
        }

        if (statusResult.status === "COMPLETED") {
          pending.delete(sceneId);
          try {
            const result = await this.withRetries(
              () => this.provider.downloadResult(context.operationId),
              maxRetries
            );
            generatedVideos.push(result);
            renderTimesMs.push(Date.now() - context.submittedAt);
          } catch (error) {
            this.recordFailure(
              failedOperations,
              { sceneId, operationId: context.operationId, reason: this.describeError(error) },
              continueOnFailure,
              `Failed to download result for scene "${sceneId}"`,
              error
            );
          }
        } else if (statusResult.status === "FAILED" || statusResult.status === "CANCELLED") {
          pending.delete(sceneId);
          const reason = `Generation ${statusResult.status.toLowerCase()} for operation "${context.operationId}".`;
          this.recordFailure(
            failedOperations,
            { sceneId, operationId: context.operationId, reason },
            continueOnFailure,
            `Scene "${sceneId}" did not complete`,
            undefined
          );
        }
        // PENDING / PROCESSING: left in `pending` to be re-checked next cycle.
      }

      progress = this.summarizeProgress(requests.length, generatedVideos.length, failedOperations.length, pending.size);

      if (progress.activeScenes > 0) {
        await this.wait(pollIntervalMs);
      }
    }

    const elapsedMs = Date.now() - startedAt;
    const averageRenderTimeMs =
      renderTimesMs.length > 0
        ? renderTimesMs.reduce((sum, ms) => sum + ms, 0) / renderTimesMs.length
        : 0;

    return {
      generatedVideos,
      failedOperations,
      statistics: {
        totalScenes: requests.length,
        completed: generatedVideos.length,
        failed: failedOperations.length,
        elapsedMs,
        averageRenderTimeMs,
      },
    };
  }

  // ── Validation ────────────────────────────────────────────────────────

  private validateRequests(requests: SceneGenerationRequest[]): void {
    if (requests.length === 0) {
      throw new VeoGenerationError("No scene generation requests provided.");
    }

    const seen = new Set<string>();
    for (const request of requests) {
      if (seen.has(request.sceneId)) {
        throw new VeoGenerationError(`Duplicate sceneId in batch: ${request.sceneId}`);
      }
      seen.add(request.sceneId);

      if (!request.positivePrompt || request.positivePrompt.trim().length === 0) {
        throw new VeoGenerationError(`Scene "${request.sceneId}" has an empty positivePrompt.`);
      }
      if (!request.negativePrompt || request.negativePrompt.trim().length === 0) {
        throw new VeoGenerationError(`Scene "${request.sceneId}" has an empty negativePrompt.`);
      }
    }
  }

  // ── Request translation ──────────────────────────────────────────────

  /**
   * TODO(reference-assets): SceneGenerationRequest no longer carries
   * uploaded reference image URLs. ReferenceImageGenerator now returns
   * only CharacterReferencePrompt (characterId + prompt text) — turning
   * those prompts into real uploaded images is MovieProductionService's
   * job (ImagenService to generate, CloudinaryService to upload), and
   * that step does not exist yet. Once it does, MovieProductionService
   * will need to supply the resulting uploaded asset URLs to this stage;
   * until then, referenceImages is sent empty and no reference-image
   * consistency data reaches the video provider.
   */
  private toVideoGenerationRequest(request: SceneGenerationRequest) {
    return {
      sceneId: request.sceneId,
      prompt: request.positivePrompt,
      negativePrompt: request.negativePrompt,
      referenceImages: [],
      duration: request.expectedDuration,
      aspectRatio: request.aspectRatio,
      quality: request.quality,
      outputFormat: request.outputFormat,
    };
  }

  // ── Retry / failure bookkeeping ───────────────────────────────────────

  /**
   * Retries a provider call up to `maxRetries` additional times after the
   * first attempt, for transient failures (thrown errors). Does not retry
   * a provider-reported terminal status such as FAILED — that is handled
   * separately as a real outcome, not a transient error.
   */
  private async withRetries<T>(operation: () => Promise<T>, maxRetries: number): Promise<T> {
    let lastError: unknown;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;
      }
    }
    throw lastError;
  }

  private recordFailure(
    failedOperations: FailedSceneOperation[],
    failure: FailedSceneOperation,
    continueOnFailure: boolean,
    errorPrefix: string,
    cause: unknown
  ): void {
    failedOperations.push(failure);
    if (!continueOnFailure) {
      throw new VeoGenerationError(`${errorPrefix}: ${failure.reason}`, cause);
    }
  }

  private summarizeProgress(
    totalScenes: number,
    completedScenes: number,
    failedScenes: number,
    activeScenes: number
  ): BatchGenerationProgress {
    const finished = completedScenes + failedScenes;
    return {
      totalScenes,
      completedScenes,
      failedScenes,
      activeScenes,
      percentComplete: totalScenes > 0 ? Math.round((finished / totalScenes) * 100) : 0,
    };
  }

  private describeError(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }

  private wait(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
