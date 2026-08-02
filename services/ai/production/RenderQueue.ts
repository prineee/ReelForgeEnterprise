/**
 * RenderQueue.ts
 *
 * A FIFO job queue over VeoGenerator: enqueue batches of scene generation
 * requests, drain them with configurable concurrency, retry whole jobs
 * that fail, and track queued/active/completed/failed state with
 * timestamps. Contains no rendering implementation and no provider code of
 * its own — every actual generation call goes through the injected
 * VeoGenerator.
 *
 * Design notes:
 *   - RenderJob's request payload is typed via
 *     `Parameters<VeoGenerator["generateBatch"]>[0]` rather than importing
 *     SceneGenerationRequest, since only VeoGenerator, BatchGenerationResult,
 *     and GenerationOptions are permitted imports. This stays fully
 *     type-safe without importing anything beyond that list.
 *   - RenderQueueOptions (concurrency, maxRetries) is supplied via an
 *     optional second constructor parameter. The specified constructor is
 *     `constructor(generator: VeoGenerator)`; adding an optional param
 *     doesn't change that call shape, and it's the only place queue-wide
 *     configuration can be supplied, since neither enqueue() nor
 *     processNext() takes queue-level options.
 *   - getStatistics() is added as a public accessor so RenderQueueStatistics
 *     (required to exist) is actually reachable by callers.
 *   - cancel() on an ACTIVE job throws rather than pretending to succeed:
 *     RenderQueue only holds a VeoGenerator reference, which exposes no way
 *     to interrupt an in-flight generateBatch() call. Cancelling a QUEUED
 *     job works normally.
 */

import type { VeoGenerator, BatchGenerationResult, GenerationOptions } from "./VeoGenerator";

type SceneRequests = Parameters<VeoGenerator["generateBatch"]>[0];

const DEFAULT_CONCURRENCY = 1;
const DEFAULT_MAX_RETRIES = 1;

/**
 * Queue-wide configuration.
 */
export interface RenderQueueOptions {
  /** Maximum number of jobs processed concurrently. Defaults to 1. */
  concurrency?: number;
  /** Additional whole-job attempts after the first, on failure. Defaults to 1. */
  maxRetries?: number;
}

/**
 * A batch of scene generation requests submitted to the queue as one job.
 */
export interface RenderJob {
  requests: SceneRequests;
  options?: GenerationOptions;
}

/**
 * The lifecycle status of a queued job.
 */
export type RenderJobStatus = "QUEUED" | "ACTIVE" | "COMPLETED" | "FAILED" | "CANCELLED";

/**
 * The full internal record for a queued job, including its timestamps and
 * (once finished) its result or error.
 */
export interface RenderQueueEntry {
  jobId: string;
  job: RenderJob;
  status: RenderJobStatus;
  queuedAt: string;
  startedAt?: string;
  completedAt?: string;
  attempts: number;
  result?: BatchGenerationResult;
  error?: string;
}

/**
 * Aggregate counts across every job the queue has ever held.
 */
export interface RenderQueueStatistics {
  queued: number;
  active: number;
  completed: number;
  failed: number;
  cancelled: number;
  total: number;
}

/**
 * Thrown for invalid queue operations: bad configuration, an empty job, an
 * unknown jobId, or an unsupported cancellation.
 */
export class RenderQueueError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = "RenderQueueError";
  }
}

/**
 * FIFO render job queue over an injected VeoGenerator. Pure orchestration
 * — no rendering implementation, no provider SDK, no network calls of its
 * own.
 */
export class RenderQueue {
  private readonly entries = new Map<string, RenderQueueEntry>();
  private readonly pendingOrder: string[] = [];
  private readonly concurrency: number;
  private readonly maxRetries: number;
  private activeCount = 0;
  private nextJobNumber = 1;

  constructor(private readonly generator: VeoGenerator, options?: RenderQueueOptions) {
    this.concurrency = options?.concurrency ?? DEFAULT_CONCURRENCY;
    this.maxRetries = options?.maxRetries ?? DEFAULT_MAX_RETRIES;

    if (!Number.isInteger(this.concurrency) || this.concurrency < 1) {
      throw new RenderQueueError("concurrency must be an integer of at least 1.");
    }
    if (!Number.isInteger(this.maxRetries) || this.maxRetries < 0) {
      throw new RenderQueueError("maxRetries must be a non-negative integer.");
    }
  }

  /**
   * Adds a job to the back of the FIFO queue and returns its jobId.
   */
  async enqueue(job: RenderJob): Promise<string> {
    if (!job.requests || job.requests.length === 0) {
      throw new RenderQueueError("Cannot enqueue a job with no requests.");
    }

    const jobId = this.generateJobId();
    const entry: RenderQueueEntry = {
      jobId,
      job,
      status: "QUEUED",
      queuedAt: new Date().toISOString(),
      attempts: 0,
    };

    this.entries.set(jobId, entry);
    this.pendingOrder.push(jobId);

    return jobId;
  }

  /**
   * Processes the next queued job, if the configured concurrency limit
   * allows it. A no-op if the queue is empty or already at capacity.
   */
  async processNext(): Promise<void> {
    if (this.activeCount >= this.concurrency) {
      return;
    }

    const jobId = this.pendingOrder.shift();
    if (!jobId) {
      return;
    }

    const entry = this.entries.get(jobId);
    if (!entry) {
      throw new RenderQueueError(`Internal error: queued jobId "${jobId}" has no entry.`);
    }

    entry.status = "ACTIVE";
    entry.startedAt = new Date().toISOString();
    this.activeCount += 1;

    try {
      entry.result = await this.runWithRetries(entry);
      entry.status = "COMPLETED";
    } catch (error) {
      entry.status = "FAILED";
      entry.error = error instanceof Error ? error.message : String(error);
    } finally {
      entry.completedAt = new Date().toISOString();
      this.activeCount -= 1;
    }
  }

  /**
   * Returns the current status of a job.
   */
  getStatus(jobId: string): RenderJobStatus {
    return this.getEntry(jobId).status;
  }

  /**
   * Cancels a job. A QUEUED job is removed from the queue immediately. An
   * already-terminal job (COMPLETED/FAILED/CANCELLED) or an ACTIVE job
   * cannot be cancelled — RenderQueue has no mechanism to interrupt an
   * in-flight generateBatch() call.
   */
  async cancel(jobId: string): Promise<void> {
    const entry = this.getEntry(jobId);

    if (entry.status === "ACTIVE") {
      throw new RenderQueueError(
        `Cannot cancel job "${jobId}": it is currently active, and RenderQueue has no way to interrupt an in-flight VeoGenerator.generateBatch() call.`
      );
    }
    if (entry.status !== "QUEUED") {
      throw new RenderQueueError(
        `Cannot cancel job "${jobId}": it is already ${entry.status.toLowerCase()}.`
      );
    }

    const index = this.pendingOrder.indexOf(jobId);
    if (index !== -1) {
      this.pendingOrder.splice(index, 1);
    }

    entry.status = "CANCELLED";
    entry.completedAt = new Date().toISOString();
  }

  /**
   * Returns aggregate counts across every job the queue has ever held.
   */
  getStatistics(): RenderQueueStatistics {
    let queued = 0;
    let active = 0;
    let completed = 0;
    let failed = 0;
    let cancelled = 0;

    for (const entry of this.entries.values()) {
      switch (entry.status) {
        case "QUEUED":
          queued += 1;
          break;
        case "ACTIVE":
          active += 1;
          break;
        case "COMPLETED":
          completed += 1;
          break;
        case "FAILED":
          failed += 1;
          break;
        case "CANCELLED":
          cancelled += 1;
          break;
      }
    }

    return { queued, active, completed, failed, cancelled, total: this.entries.size };
  }

  // ── Internal helpers ────────────────────────────────────────────────────

  private async runWithRetries(entry: RenderQueueEntry): Promise<BatchGenerationResult> {
    let lastError: unknown;
    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      entry.attempts += 1;
      try {
        return await this.generator.generateBatch(entry.job.requests, entry.job.options);
      } catch (error) {
        lastError = error;
      }
    }
    throw lastError;
  }

  private getEntry(jobId: string): RenderQueueEntry {
    const entry = this.entries.get(jobId);
    if (!entry) {
      throw new RenderQueueError(`Unknown jobId: ${jobId}`);
    }
    return entry;
  }

  private generateJobId(): string {
    const id = `job-${this.nextJobNumber}`;
    this.nextJobNumber += 1;
    return id;
  }
}
