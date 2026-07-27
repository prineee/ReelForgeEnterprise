/**
 * RenderOrchestrator.ts
 *
 * The single entry point for the render pipeline described in
 * docs/architecture/render-orchestrator.md:
 *
 *   Movie Studio -> MovieProductionService -> RenderOrchestrator ->
 *   ProviderSelector -> ProviderRegistry -> (Cloud API | GPU | GPU
 *   Cluster) -> unified RenderResult
 *
 * RenderOrchestrator itself owns no provider-specific logic — it only
 * sequences ProviderSelector (choose a ProviderId) -> ProviderRegistry
 * (resolve that id to a RenderProvider instance) -> the provider's own
 * generate()/checkStatus()/download(), and unifies whatever comes back
 * into RenderResult so every caller above it sees one shape regardless of
 * which provider actually ran.
 *
 * Sprint 2: MovieProductionService's Stage 4 (Scene Video Generation) now
 * calls renderAndWait() below instead of constructing/calling a provider
 * client directly — see that class's generateSceneVideo(). VeoService
 * itself is untouched and still constructed/injected by
 * MovieProductionFactory.ts; it is simply no longer what drives real
 * generation.
 *
 * generateJobId() mints an orchestrator-level id independent of whatever
 * id the underlying provider issues (LTX's task_id, Google's operation
 * name, ...) and tracks the (providerId, providerJobId) pair for that
 * job's lifetime. This is what lets checkStatus()/download() below take
 * only the orchestrator's jobId — callers never need to know which
 * provider handled a job or what that provider calls its own operations.
 */

import type {
  ProviderId,
  RenderRequest,
} from "./interfaces/RenderProvider";
import type { RenderResult } from "./interfaces/RenderResult";
import { ProviderRegistry, createDefaultProviderRegistry } from "./ProviderRegistry";
import { ProviderSelector, type ProviderSelectionContext } from "./ProviderSelector";
import type { RenderMetrics } from "./RenderMetrics";

interface TrackedJob {
  providerId: ProviderId;
  providerJobId: string;
}

export interface RenderAndWaitOptions {
  pollIntervalMs?: number;
  maxAttempts?: number;
}

export class RenderOrchestrator {
  private readonly jobs = new Map<string, TrackedJob>();

  constructor(
    private readonly registry: ProviderRegistry = createDefaultProviderRegistry(),
    private readonly selector: ProviderSelector = new ProviderSelector(),
    private readonly metrics?: RenderMetrics
  ) {}

  /**
   * Accepts a render request, selects a provider, executes it, and
   * returns a unified RenderResult. Never throws for a provider-side
   * failure — a failed generate() call is reported as a RenderResult with
   * status "FAILED" and `error` set, exactly like a provider that
   * completes but reports failure would be.
   */
  async render(request: RenderRequest, context?: ProviderSelectionContext): Promise<RenderResult> {
    const jobId = this.generateJobId();
    const providerId = this.selector.select(context);
    const startedAt = Date.now();

    let result: RenderResult;
    try {
      const provider = this.registry.resolve(providerId);
      result = await provider.generate(request);
    } catch (error) {
      const failed = this.toFailedResult(jobId, providerId, error);
      this.recordMetric(failed, providerId, startedAt, request);
      return failed;
    }

    this.jobs.set(jobId, { providerId, providerJobId: result.jobId });
    const unified = this.unify(result, jobId, providerId);
    this.recordMetric(unified, providerId, startedAt, request);
    return unified;
  }

  /** Polls a previously started job. `jobId` is RenderOrchestrator's own id, from render()'s result. */
  async checkStatus(jobId: string): Promise<RenderResult> {
    const job = this.requireJob(jobId);
    const provider = this.registry.resolve(job.providerId);
    const result = await provider.checkStatus(job.providerJobId);
    return this.unify(result, jobId, job.providerId);
  }

  /** Downloads a completed job's video. `jobId` is RenderOrchestrator's own id, from render()'s result. */
  async download(jobId: string): Promise<RenderResult> {
    const job = this.requireJob(jobId);
    const provider = this.registry.resolve(job.providerId);
    const result = await provider.download(job.providerJobId);
    return this.unify(result, jobId, job.providerId);
  }

  /**
   * Submits a render and drives it to a terminal RenderResult
   * (COMPLETED-with-videoUrl, or FAILED), polling checkStatus() and
   * calling download() as needed — the submit -> poll -> download
   * sequence every real provider requires (see BaseVeoClientProvider;
   * providers never complete synchronously from generate() alone). This
   * is composed entirely from render()/checkStatus()/download() above —
   * no provider-specific logic lives here.
   *
   * Returns (never throws) a FAILED RenderResult if the provider reports
   * failure or if maxAttempts is exhausted before completion.
   */
  async renderAndWait(
    request: RenderRequest,
    context?: ProviderSelectionContext,
    options?: RenderAndWaitOptions
  ): Promise<RenderResult> {
    const pollIntervalMs = options?.pollIntervalMs ?? 5000;
    const maxAttempts = options?.maxAttempts ?? 36; // 3 minutes at the default interval

    let result = await this.render(request, context);
    if (result.status === "FAILED") return result;
    if (result.status === "COMPLETED") return this.ensureDownloaded(result);

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      await this.sleep(pollIntervalMs);
      result = await this.checkStatus(result.jobId);
      if (result.status === "FAILED") return result;
      if (result.status === "COMPLETED") return this.ensureDownloaded(result);
    }

    return {
      jobId: result.jobId,
      status: "FAILED",
      provider: result.provider,
      error: `Render did not complete within ${maxAttempts} poll attempts (${pollIntervalMs}ms interval).`,
    };
  }

  /** A COMPLETED status doesn't always carry videoUrl yet (submit/poll responses don't include it) — download() is what actually resolves it. */
  private async ensureDownloaded(result: RenderResult): Promise<RenderResult> {
    return result.videoUrl ? result : this.download(result.jobId);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private unify(result: RenderResult, jobId: string, providerId: ProviderId): RenderResult {
    return { ...result, jobId, provider: providerId };
  }

  private toFailedResult(jobId: string, providerId: ProviderId, error: unknown): RenderResult {
    return {
      jobId,
      status: "FAILED",
      provider: providerId,
      error: error instanceof Error ? error.message : String(error),
    };
  }

  private recordMetric(
    result: RenderResult,
    providerId: ProviderId,
    startedAt: number,
    request: RenderRequest
  ): void {
    this.metrics?.record({
      provider: providerId,
      durationSeconds: result.duration ?? request.durationSeconds,
      resolution: result.resolution ?? request.quality,
      renderTimeMs: Date.now() - startedAt,
      success: result.status !== "FAILED",
      error: result.error,
      timestamp: new Date().toISOString(),
    });
  }

  private requireJob(jobId: string): TrackedJob {
    const job = this.jobs.get(jobId);
    if (!job) {
      throw new Error(`No tracked render job for jobId "${jobId}". render() must be called first.`);
    }
    return job;
  }

  private generateJobId(): string {
    return `render-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  }
}
