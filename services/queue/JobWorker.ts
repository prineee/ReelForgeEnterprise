/**
 * JobWorker.ts
 *
 * Executes a single job against its registered JobHandler and writes every
 * resulting state transition back through JobQueue: Queued/Retrying →
 * Running → Completed | Failed | Retrying | Cancelled.
 *
 * Cancellation here is cooperative, not preemptive: JavaScript has no way
 * to forcibly kill an in-flight Promise. QueueManager.cancel() on a
 * Running job only sets Job.cancelRequested — this worker checks that
 * flag once the handler settles (success or failure) and reclassifies the
 * outcome as Cancelled instead of Completed/Failed/Retrying. A handler
 * that wants faster cancellation can itself inspect the `job` argument it
 * receives for cancelRequested and abort early; nothing here requires
 * that, but nothing here can force it either.
 */

import type { Job, JobHandler } from './QueueTypes'
import { JobStatus } from './QueueTypes'
import type { JobQueue } from './JobQueue'
import { JobRetryPolicy } from './JobRetryPolicy'

export class JobWorker {
  constructor(
    private readonly queue: JobQueue,
    private readonly retryPolicy: JobRetryPolicy = new JobRetryPolicy()
  ) {}

  /** Runs one job to completion (or failure/retry/cancellation) and returns its final state. */
  async run(job: Job, handler: JobHandler): Promise<Job> {
    const running: Job = {
      ...job,
      status: JobStatus.Running,
      attempts: job.attempts + 1,
      startedAt: new Date().toISOString(),
    }
    this.queue.update(running)

    try {
      const result = await handler(running.payload, running)
      return this.finishRun(running.id, { result })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      return this.finishRun(running.id, { error: message })
    }
  }

  private finishRun(jobId: string, outcome: { result: unknown } | { error: string }): Job {
    const latest = this.queue.get(jobId)
    if (!latest) {
      throw new Error(`JobWorker: job "${jobId}" disappeared from the queue mid-run.`)
    }

    if (latest.cancelRequested) {
      const cancelled: Job = { ...latest, status: JobStatus.Cancelled, completedAt: new Date().toISOString() }
      this.queue.update(cancelled)
      return cancelled
    }

    if ('result' in outcome) {
      const completed: Job = {
        ...latest,
        status: JobStatus.Completed,
        completedAt: new Date().toISOString(),
        result: outcome.result,
      }
      this.queue.update(completed)
      return completed
    }

    const errors = [...latest.errors, { message: outcome.error, occurredAt: new Date().toISOString(), attempt: latest.attempts }]
    const withError: Job = { ...latest, errors }

    const decision = this.retryPolicy.evaluate(withError)
    if (decision.shouldRetry) {
      const retrying: Job = { ...withError, status: JobStatus.Retrying, nextRetryAt: decision.nextRetryAt }
      this.queue.update(retrying)
      return retrying
    }

    const failed: Job = { ...withError, status: JobStatus.Failed, completedAt: new Date().toISOString() }
    this.queue.update(failed)
    return failed
  }
}
