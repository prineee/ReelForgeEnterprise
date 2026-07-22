/**
 * RenderQueue.ts
 *
 * Delivery-layer render queue: a pure in-memory state machine tracking
 * RenderJobs from enqueue through completion, failure, or cancellation.
 * No dependencies, no timers, no polling, no FFmpeg, no provider calls, no
 * worker execution, no uploads — this class only maintains render state
 * and enforces valid state transitions.
 *
 * This is a separate implementation from the production layer's own
 * RenderQueue.ts (services/ai/production/RenderQueue.ts), which wraps
 * VeoGenerator and drives actual batch video generation. This file uses
 * only FinalMovieContracts and has no knowledge of that class or any
 * other part of the codebase.
 *
 * State machine: QUEUED → (start) → ENCODING → (complete) → COMPLETED
 *                QUEUED/ENCODING → (fail) → FAILED
 *                QUEUED → (cancel) → CANCELLED
 * A job cannot be cancelled once ENCODING — there is no worker to
 * interrupt, so pretending to cancel it would misrepresent state that
 * isn't actually tracked or controlled here.
 */

import type { RenderId, RenderJob, RenderPlan, RenderResult, RenderErrorInfo } from "./FinalMovieContracts";
import { RenderStatus } from "./FinalMovieContracts";

/**
 * Thrown for unknown jobIds or invalid state transitions.
 */
export class RenderQueueError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = "RenderQueueError";
  }
}

/**
 * Pure in-memory render job state machine. No side effects beyond
 * updating its own internal map.
 */
export class RenderQueue {
  private readonly jobs = new Map<RenderId, RenderJob>();

  /**
   * Enqueues a new job for a RenderPlan. Throws if a job with the same
   * renderId already exists.
   */
  enqueue(plan: RenderPlan): RenderJob {
    if (this.jobs.has(plan.renderId)) {
      throw new RenderQueueError(`A job with renderId "${plan.renderId}" is already queued.`);
    }

    const job: RenderJob = {
      renderId: plan.renderId,
      plan,
      status: RenderStatus.Queued,
      progressPercent: 0,
      attempts: 0,
      queuedAt: new Date().toISOString(),
    };

    this.jobs.set(job.renderId, job);
    return job;
  }

  /**
   * Transitions a QUEUED job to ENCODING. Throws if the job is not
   * currently QUEUED.
   */
  start(jobId: RenderId): RenderJob {
    const job = this.getJob(jobId);
    this.assertStatus(job, RenderStatus.Queued, "start");

    job.status = RenderStatus.Encoding;
    job.startedAt = new Date().toISOString();
    job.attempts += 1;

    return job;
  }

  /**
   * Transitions an ENCODING job to COMPLETED, attaching its result.
   * Throws if the job is not currently ENCODING.
   */
  complete(jobId: RenderId, result: RenderResult): RenderJob {
    const job = this.getJob(jobId);
    this.assertStatus(job, RenderStatus.Encoding, "complete");

    job.status = RenderStatus.Completed;
    job.completedAt = new Date().toISOString();
    job.progressPercent = 100;
    job.result = result;

    return job;
  }

  /**
   * Transitions a QUEUED or ENCODING job to FAILED, attaching error info.
   * Throws if the job is already in a terminal state.
   */
  fail(jobId: RenderId, error: RenderErrorInfo): RenderJob {
    const job = this.getJob(jobId);

    if (job.status !== RenderStatus.Queued && job.status !== RenderStatus.Encoding) {
      throw new RenderQueueError(`Cannot fail job "${jobId}": it is already ${job.status.toLowerCase()}.`);
    }

    job.status = RenderStatus.Failed;
    job.completedAt = new Date().toISOString();
    job.error = error;

    return job;
  }

  /**
   * Transitions a QUEUED job to CANCELLED. Throws if the job is ENCODING
   * (no worker exists to interrupt) or already in a terminal state.
   */
  cancel(jobId: RenderId): RenderJob {
    const job = this.getJob(jobId);

    if (job.status === RenderStatus.Encoding) {
      throw new RenderQueueError(
        `Cannot cancel job "${jobId}": it is currently encoding, and RenderQueue has no way to interrupt an in-progress render.`
      );
    }
    this.assertStatus(job, RenderStatus.Queued, "cancel");

    job.status = RenderStatus.Cancelled;
    job.completedAt = new Date().toISOString();

    return job;
  }

  /**
   * Returns a job by ID. Throws if no job with that ID exists.
   */
  getJob(jobId: RenderId): RenderJob {
    const job = this.jobs.get(jobId);
    if (!job) {
      throw new RenderQueueError(`Unknown jobId: ${jobId}`);
    }
    return job;
  }

  /**
   * Returns every job currently held, in enqueue order.
   */
  listJobs(): RenderJob[] {
    return Array.from(this.jobs.values());
  }

  private assertStatus(job: RenderJob, expected: RenderStatus, action: string): void {
    if (job.status !== expected) {
      throw new RenderQueueError(
        `Cannot ${action} job "${job.renderId}": expected status "${expected}" but found "${job.status}".`
      );
    }
  }
}
