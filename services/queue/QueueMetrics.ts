/**
 * QueueMetrics.ts
 *
 * Derives a point-in-time QueueSnapshot from a JobQueue's current
 * contents. Pure read — no state of its own, nothing here mutates a job.
 */

import type { Job, QueueSnapshot } from './QueueTypes'
import { JobStatus } from './QueueTypes'
import type { JobQueue } from './JobQueue'

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

function runtimeSeconds(job: Job): number | null {
  if (!job.startedAt || !job.completedAt) return null
  return (new Date(job.completedAt).getTime() - new Date(job.startedAt).getTime()) / 1000
}

export class QueueMetrics {
  constructor(private readonly queue: JobQueue) {}

  snapshot(now: Date = new Date()): QueueSnapshot {
    const jobs = this.queue.listAll()

    const runningCount = jobs.filter((j) => j.status === JobStatus.Running).length
    const waitingCount = jobs.filter(
      (j) => j.status === JobStatus.Queued || j.status === JobStatus.Waiting || j.status === JobStatus.Retrying
    ).length

    const completedToday = jobs.filter(
      (j) => j.status === JobStatus.Completed && j.completedAt && isSameDay(new Date(j.completedAt), now)
    )
    const failedToday = jobs.filter(
      (j) => j.status === JobStatus.Failed && j.completedAt && isSameDay(new Date(j.completedAt), now)
    )

    const runtimes = jobs.map(runtimeSeconds).filter((s): s is number => s !== null)
    const averageRuntimeSeconds = runtimes.length > 0 ? Math.round(runtimes.reduce((sum, s) => sum + s, 0) / runtimes.length) : 0

    return {
      runningCount,
      waitingCount,
      completedTodayCount: completedToday.length,
      failedTodayCount: failedToday.length,
      averageRuntimeSeconds,
    }
  }
}
