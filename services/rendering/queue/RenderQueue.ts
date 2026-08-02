/**
 * RenderQueue.ts (services/rendering/queue/)
 *
 * NOT the same class as services/ai/production/RenderQueue.ts. That file
 * is the pre-existing FIFO batch queue over VeoGenerator (5 states:
 * QUEUED/ACTIVE/COMPLETED/FAILED/CANCELLED), still constructed by
 * MovieProductionFactory.ts and left completely untouched by this
 * sprint. This is a new, separate, in-memory job state machine — the
 * Sprint 3 "enterprise queue architecture" — built around the fuller
 * 9-state RenderJobStatus lifecycle (types/RenderJob.ts) that a future
 * GPU scheduler needs (QUEUED -> WAITING -> ASSIGNED -> RENDERING ->
 * DOWNLOADING -> VERIFYING -> COMPLETED, with FAILED/CANCELLED reachable
 * from most states). Nothing in the existing render path (RenderOrchestrator,
 * MovieProductionService) uses this yet — architecture only, per this
 * sprint's scope.
 *
 * In-memory only. No Redis, no BullMQ, no persistence.
 */

import type { RenderJob, RenderJobStatus } from "../types/RenderJob";

export class RenderQueueError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RenderQueueError";
  }
}

/**
 * Valid next states for each RenderJobStatus. FAILED and CANCELLED are
 * terminal from every non-terminal state; COMPLETED/FAILED/CANCELLED are
 * terminal and have no valid next state.
 */
const VALID_TRANSITIONS: Readonly<Record<RenderJobStatus, readonly RenderJobStatus[]>> = {
  QUEUED: ["WAITING", "ASSIGNED", "FAILED", "CANCELLED"],
  WAITING: ["ASSIGNED", "FAILED", "CANCELLED"],
  ASSIGNED: ["RENDERING", "FAILED", "CANCELLED"],
  RENDERING: ["DOWNLOADING", "FAILED", "CANCELLED"],
  DOWNLOADING: ["VERIFYING", "FAILED", "CANCELLED"],
  VERIFYING: ["COMPLETED", "FAILED", "CANCELLED"],
  COMPLETED: [],
  FAILED: [],
  CANCELLED: [],
};

export class RenderQueue {
  private readonly jobs = new Map<string, RenderJob>();

  enqueue(job: Omit<RenderJob, "status" | "retryCount" | "createdAt" | "updatedAt"> & Partial<Pick<RenderJob, "retryCount">>): RenderJob {
    if (this.jobs.has(job.jobId)) {
      throw new RenderQueueError(`Job "${job.jobId}" is already queued.`);
    }

    const now = new Date().toISOString();
    const queued: RenderJob = {
      ...job,
      status: "QUEUED",
      retryCount: job.retryCount ?? 0,
      createdAt: now,
      updatedAt: now,
    };
    this.jobs.set(queued.jobId, queued);
    return queued;
  }

  get(jobId: string): RenderJob | undefined {
    return this.jobs.get(jobId);
  }

  /** Transitions a job to `status`, validating the transition is legal for its current status. Throws RenderQueueError if not. */
  updateStatus(jobId: string, status: RenderJobStatus, patch?: Partial<Pick<RenderJob, "result" | "error" | "providerId" | "executionTarget">>): RenderJob {
    const job = this.requireJob(jobId);
    const allowed = VALID_TRANSITIONS[job.status];
    if (!allowed.includes(status)) {
      throw new RenderQueueError(
        `Invalid transition for job "${jobId}": "${job.status}" -> "${status}" is not allowed.`
      );
    }

    const updated: RenderJob = {
      ...job,
      ...patch,
      status,
      updatedAt: new Date().toISOString(),
    };
    this.jobs.set(jobId, updated);
    return updated;
  }

  /** Increments retryCount without changing status — call before re-queuing (e.g. QUEUED -> ... again) a job that failed. */
  incrementRetryCount(jobId: string): RenderJob {
    const job = this.requireJob(jobId);
    const updated: RenderJob = { ...job, retryCount: job.retryCount + 1, updatedAt: new Date().toISOString() };
    this.jobs.set(jobId, updated);
    return updated;
  }

  list(): readonly RenderJob[] {
    return Array.from(this.jobs.values());
  }

  listByStatus(status: RenderJobStatus): readonly RenderJob[] {
    return this.list().filter((job) => job.status === status);
  }

  remove(jobId: string): void {
    this.jobs.delete(jobId);
  }

  private requireJob(jobId: string): RenderJob {
    const job = this.jobs.get(jobId);
    if (!job) {
      throw new RenderQueueError(`No queued job for jobId "${jobId}".`);
    }
    return job;
  }
}
