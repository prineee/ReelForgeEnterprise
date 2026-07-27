/**
 * RenderJobManager.ts
 *
 * Sprint 5: the async job-lifecycle layer above RenderOrchestrator.
 * Nothing here duplicates provider logic — every actual render still
 * goes through RenderOrchestrator's existing public methods
 * (render()/checkStatus()/download()), unchanged since Sprint 4. This
 * class adds what RenderOrchestrator deliberately doesn't own: a
 * persistent (in-memory, per this sprint's scope) job record, detailed
 * stage-based progress, worker-pool-gated concurrency, retry with
 * backoff, best-effort cancellation, and lifecycle notifications.
 *
 * Composes, does not reinvent:
 *   - queue/RenderQueue.ts (Sprint 3)      — the job state machine / store.
 *   - RenderOrchestrator.ts (Sprint 1-4)   — provider selection + execution,
 *     called via render()/checkStatus()/download() (not the renderAndWait()
 *     convenience wrapper) specifically so each real stage transition is
 *     observable here, not hidden inside one black-box call.
 *   - WorkerPool.ts, RetryPolicy.ts, CancellationPolicy.ts (this sprint).
 *   - ledger/RenderLedger.ts, health/ProviderHealthMonitor.ts (Sprint 3)
 *     — finally given real data to record, still fully within
 *     services/rendering/.
 *
 * Architecture-only this sprint: nothing in MovieProductionService, any
 * API route, or MovieProductionFactory.ts calls this class. It is a
 * standalone, independently-verified module — RenderOrchestrator.ts,
 * MovieProductionService.ts, and every route are untouched.
 */

import { RenderOrchestrator } from "../RenderOrchestrator";
import { RenderQueue } from "../queue/RenderQueue";
import type { RenderJob, RenderJobStatus } from "../types/RenderJob";
import type { RenderJobProgress, RenderJobStageEvent } from "../types/RenderJobProgress";
import { RENDER_JOB_STAGE_ORDER } from "../types/RenderJobProgress";
import type { ProviderId, RenderRequest } from "../interfaces/RenderProvider";
import type { RenderResult } from "../interfaces/RenderResult";
import { WorkerPool } from "./WorkerPool";
import { RetryPolicy } from "./RetryPolicy";
import { CancellationPolicy } from "./CancellationPolicy";
import type { NotificationChannel, RenderJobNotificationEvent } from "./notifications/NotificationChannel";
import { RenderLedger } from "../ledger/RenderLedger";
import { ProviderHealthMonitor } from "../health/ProviderHealthMonitor";

export interface SubmitRenderJobOptions {
  request: RenderRequest;
  userId?: string;
  projectId?: string;
  sceneId?: string;
  assetId?: string;
  priority?: "LOW" | "NORMAL" | "HIGH";
  /** Overrides this manager's default RetryPolicy max attempts for this job (and any retries spawned from it). */
  maxAttempts?: number;
}

export interface RenderJobManagerOptions {
  pollIntervalMs?: number;
}

export class RenderJobManagerError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RenderJobManagerError";
  }
}

const DEFAULT_POLL_INTERVAL_MS = 2000;

export class RenderJobManager {
  private readonly stageHistory = new Map<string, RenderJobStageEvent[]>();
  private readonly maxAttemptsByJob = new Map<string, number>();
  private readonly pollIntervalMs: number;
  private readonly cancellationPolicy = new CancellationPolicy();

  constructor(
    private readonly orchestrator: RenderOrchestrator = new RenderOrchestrator(),
    private readonly queue: RenderQueue = new RenderQueue(),
    private readonly workerPool: WorkerPool = new WorkerPool(1),
    private readonly retryPolicy: RetryPolicy = new RetryPolicy(),
    private readonly notifications: readonly NotificationChannel[] = [],
    private readonly ledger: RenderLedger = new RenderLedger(),
    private readonly healthMonitor: ProviderHealthMonitor = new ProviderHealthMonitor(),
    options: RenderJobManagerOptions = {}
  ) {
    this.pollIntervalMs = options.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS;
  }

  /** Enqueues a job and, if a worker is free, starts it immediately. Always returns right away — never awaits the render itself. */
  submit(options: SubmitRenderJobOptions): RenderJob {
    const job = this.queue.enqueue({
      jobId: this.generateJobId(),
      request: options.request,
      priority: options.priority,
      userId: options.userId,
      projectId: options.projectId,
      sceneId: options.sceneId,
      assetId: options.assetId,
    });

    this.maxAttemptsByJob.set(job.jobId, options.maxAttempts ?? this.retryPolicy.defaultMaxAttempts);
    this.recordStage(job.jobId, "QUEUED");
    this.notify({ type: "JobQueued", jobId: job.jobId, userId: job.userId, timestamp: this.now() });

    this.tryStartNext();
    return job;
  }

  getJob(jobId: string): RenderJob | undefined {
    return this.queue.get(jobId);
  }

  list(): readonly RenderJob[] {
    return this.queue.list();
  }

  listByStatus(status: RenderJobStatus): readonly RenderJob[] {
    return this.queue.listByStatus(status);
  }

  getProgress(jobId: string): RenderJobProgress {
    const job = this.requireJob(jobId);
    const history = this.stageHistory.get(jobId) ?? [];
    return {
      jobId,
      currentStage: job.status,
      percentComplete: this.computePercent(jobId, job.status),
      history,
      updatedAt: job.updatedAt,
    };
  }

  /**
   * Best-effort cancellation. Always stops RenderJobManager from tracking
   * the job further. For LOCAL_GPU this could stop real in-flight work
   * (see CancellationPolicy.ts) — not yet called through, since
   * RenderProvider has no cancel() method (out of scope this sprint). For
   * every other provider this is the same cooperative-only limitation
   * services/queue/QueueManager.ts's own cancel() already documents.
   */
  cancel(jobId: string): RenderJob {
    const job = this.requireJob(jobId);
    if (!this.cancellationPolicy.isCancellable(job.status)) {
      throw new RenderJobManagerError(`Job "${jobId}" cannot be cancelled from status "${job.status}".`);
    }

    const updated = this.queue.updateStatus(jobId, "CANCELLED");
    this.recordStage(jobId, "CANCELLED");
    this.notify({ type: "JobCancelled", jobId, userId: job.userId, timestamp: this.now() });
    return updated;
  }

  // ── Execution ────────────────────────────────────────────────────────

  private tryStartNext(): void {
    if (this.workerPool.isFull()) return;
    const next = this.queue.listByStatus("QUEUED")[0];
    if (!next) return;
    void this.runJob(next.jobId);
  }

  private async runJob(jobId: string): Promise<void> {
    const worker = this.workerPool.acquire(jobId);
    if (!worker) return; // Pool filled between the check and now — a later release() will retry.

    const job = this.requireJob(jobId);
    this.queue.updateStatus(jobId, "ASSIGNED");
    this.recordStage(jobId, "ASSIGNED");
    this.notify({ type: "JobStarted", jobId, userId: job.userId, timestamp: this.now() });

    const startedAt = Date.now();
    const attempt = job.retryCount + 1;

    try {
      const submitted = await this.orchestrator.render(job.request);
      const providerId = submitted.provider as ProviderId;

      if (submitted.status === "FAILED") {
        throw new Error(submitted.error ?? `Render submission to "${providerId}" failed.`);
      }

      this.queue.updateStatus(jobId, "RENDERING", { providerId });
      this.recordStage(jobId, "RENDERING");
      this.notify({ type: "JobProgress", jobId, userId: job.userId, stage: "RENDERING", timestamp: this.now() });

      const settled = await this.pollUntilSettled(submitted);
      if (settled.status === "FAILED") {
        throw new Error(settled.error ?? `Render via "${providerId}" failed.`);
      }

      this.queue.updateStatus(jobId, "DOWNLOADING");
      this.recordStage(jobId, "DOWNLOADING");
      const downloaded = settled.videoUrl ? settled : await this.orchestrator.download(submitted.jobId);

      this.queue.updateStatus(jobId, "VERIFYING");
      this.recordStage(jobId, "VERIFYING");
      if (!downloaded.videoUrl) {
        throw new Error("Render reported COMPLETED but no videoUrl was returned.");
      }

      const completed = this.queue.updateStatus(jobId, "COMPLETED", { result: downloaded });
      this.recordStage(jobId, "COMPLETED");
      this.recordOutcome(completed, Date.now() - startedAt, true);
      this.notify({ type: "JobCompleted", jobId, userId: job.userId, timestamp: this.now() });
    } catch (error) {
      this.onJobFailure(jobId, job, error, startedAt, attempt);
    } finally {
      this.workerPool.release(worker.id);
      this.tryStartNext();
    }
  }

  private async pollUntilSettled(initial: RenderResult): Promise<RenderResult> {
    let latest = initial;
    while (latest.status !== "COMPLETED" && latest.status !== "FAILED") {
      await this.sleep(this.pollIntervalMs);
      latest = await this.orchestrator.checkStatus(initial.jobId);
    }
    return latest;
  }

  private onJobFailure(jobId: string, job: RenderJob, error: unknown, startedAt: number, attempt: number): void {
    const message = error instanceof Error ? error.message : String(error);

    // A concurrent cancel() may already have moved this job to CANCELLED
    // (a terminal state) — don't attempt an invalid FAILED transition on
    // top of it, and don't retry a job the caller explicitly cancelled.
    const current = this.requireJob(jobId);
    if (current.status === "CANCELLED") return;

    const failed = this.queue.updateStatus(jobId, "FAILED", { error: message });
    this.recordStage(jobId, "FAILED");
    const generationTimeMs = Date.now() - startedAt;
    this.recordOutcome(failed, generationTimeMs, false, message);

    const maxAttempts = this.maxAttemptsByJob.get(jobId);
    const decision = this.retryPolicy.evaluate(attempt, maxAttempts);

    if (!decision.shouldRetry) {
      this.notify({ type: "JobFailed", jobId, userId: job.userId, message, timestamp: this.now() });
      return;
    }

    this.notify({
      type: "JobRetrying",
      jobId,
      userId: job.userId,
      message: `retrying in ${decision.delaySeconds}s (attempt ${attempt + 1})`,
      timestamp: this.now(),
    });

    // Fire-and-forget: the backoff wait must not hold the worker slot
    // (already released in runJob's finally by the time this matters),
    // and scheduleRetry catches its own errors so a failure here can
    // never become an unhandled rejection.
    void this.scheduleRetry(job, attempt, decision.delaySeconds ?? 0, maxAttempts).catch((scheduleError) => {
      console.error(`[RenderJobManager] scheduleRetry for job "${jobId}" threw:`, scheduleError);
    });
  }

  private async scheduleRetry(originalJob: RenderJob, attempt: number, delaySeconds: number, maxAttempts?: number): Promise<void> {
    await this.sleep(delaySeconds * 1000);

    const retryJob = this.queue.enqueue({
      jobId: this.generateJobId(),
      request: originalJob.request,
      priority: originalJob.priority,
      userId: originalJob.userId,
      projectId: originalJob.projectId,
      sceneId: originalJob.sceneId,
      assetId: originalJob.assetId,
      retryCount: attempt,
      retriedFromJobId: originalJob.jobId,
    });

    if (maxAttempts !== undefined) {
      this.maxAttemptsByJob.set(retryJob.jobId, maxAttempts);
    }
    this.recordStage(retryJob.jobId, "QUEUED");
    this.notify({ type: "JobQueued", jobId: retryJob.jobId, userId: retryJob.userId, timestamp: this.now() });

    this.tryStartNext();
  }

  // ── Observability ────────────────────────────────────────────────────

  private recordStage(jobId: string, stage: RenderJobStatus): void {
    const history = this.stageHistory.get(jobId) ?? [];
    history.push({ stage, enteredAt: this.now() });
    this.stageHistory.set(jobId, history);
  }

  private computePercent(jobId: string, status: RenderJobStatus): number {
    if (status === "COMPLETED") return 100;

    if (status === "FAILED" || status === "CANCELLED") {
      const history = this.stageHistory.get(jobId) ?? [];
      const lastProgressEvent = [...history].reverse().find((e) => RENDER_JOB_STAGE_ORDER.includes(e.stage));
      if (!lastProgressEvent) return 0;
      return this.percentForStage(lastProgressEvent.stage);
    }

    return this.percentForStage(status);
  }

  private percentForStage(stage: RenderJobStatus): number {
    const index = RENDER_JOB_STAGE_ORDER.indexOf(stage);
    if (index === -1) return 0;
    return Math.round((index / (RENDER_JOB_STAGE_ORDER.length - 1)) * 100);
  }

  private recordOutcome(job: RenderJob, generationTimeMs: number, success: boolean, error?: string): void {
    if (job.providerId) {
      this.healthMonitor.record({
        provider: job.providerId,
        renderTimeMs: generationTimeMs,
        success,
        retried: job.retryCount > 0,
        timestamp: this.now(),
      });
    }

    this.ledger.record({
      renderId: job.jobId,
      jobId: job.jobId,
      userId: job.userId,
      projectId: job.projectId,
      sceneId: job.sceneId,
      provider: job.providerId ?? "GOOGLE",
      requestedDurationSeconds: job.request.durationSeconds,
      actualDurationSeconds: job.result?.duration,
      requestedResolution: job.request.quality,
      actualResolution: job.result?.resolution,
      renderStartTime: job.createdAt,
      renderEndTime: this.now(),
      generationTimeMs,
      status: job.status,
      retryCount: job.retryCount,
      executionTarget: job.providerId === "LOCAL_GPU" ? "GPU" : "CLOUD",
      errorMessage: error,
      timestamp: this.now(),
    });
  }

  private notify(event: RenderJobNotificationEvent): void {
    for (const channel of this.notifications) {
      void channel.notify(event).catch((error) => {
        console.error(`[RenderJobManager] notification channel "${channel.name}" threw:`, error);
      });
    }
  }

  // ── Helpers ──────────────────────────────────────────────────────────

  private requireJob(jobId: string): RenderJob {
    const job = this.queue.get(jobId);
    if (!job) {
      throw new RenderJobManagerError(`No render job "${jobId}".`);
    }
    return job;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private now(): string {
    return new Date().toISOString();
  }

  private generateJobId(): string {
    return `job-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  }
}
