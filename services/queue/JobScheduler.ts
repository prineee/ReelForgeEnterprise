/**
 * JobScheduler.ts
 *
 * Decides which job runs next. Two responsibilities:
 *
 * 1. promoteDueJobs() — flips JobStatus.Waiting jobs to Queued once their
 *    scheduledFor time arrives (future scheduling), and flips
 *    JobStatus.Retrying jobs back to Queued once their nextRetryAt time
 *    arrives. This is the only place either transition happens.
 * 2. pickNext() — of everything currently Queued and due, returns the one
 *    JobPriority.compareJobs() ranks highest (priority, then FIFO).
 *
 * Holds no state of its own — it only reads/writes through the injected
 * JobQueue, so QueueManager can run one scheduler per queue or share one
 * scheduler across queues without any change here.
 */

import type { Job } from './QueueTypes'
import { JobStatus } from './QueueTypes'
import type { JobQueue } from './JobQueue'
import { compareJobs } from './JobPriority'

export class JobScheduler {
  constructor(private readonly queue: JobQueue) {}

  /**
   * Promotes Waiting jobs whose scheduledFor has arrived, and Retrying
   * jobs whose nextRetryAt has arrived, to Queued. Call this before
   * pickNext() on every scheduling tick.
   */
  promoteDueJobs(now: Date = new Date()): void {
    for (const job of this.queue.listByStatus(JobStatus.Waiting)) {
      if (new Date(job.scheduledFor).getTime() <= now.getTime()) {
        this.queue.update({ ...job, status: JobStatus.Queued })
      }
    }

    for (const job of this.queue.listByStatus(JobStatus.Retrying)) {
      if (job.nextRetryAt && new Date(job.nextRetryAt).getTime() <= now.getTime()) {
        this.queue.update({ ...job, status: JobStatus.Queued, nextRetryAt: undefined })
      }
    }
  }

  /** The single highest-ranked Queued job, or undefined if none are ready. */
  pickNext(): Job | undefined {
    const ready = this.queue.listByStatus(JobStatus.Queued)
    if (ready.length === 0) return undefined
    return [...ready].sort(compareJobs)[0]
  }

  /** Up to `limit` highest-ranked Queued jobs, in run order. */
  pickNextBatch(limit: number): Job[] {
    return [...this.queue.listByStatus(JobStatus.Queued)].sort(compareJobs).slice(0, Math.max(0, limit))
  }
}
