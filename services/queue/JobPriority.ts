/**
 * JobPriority.ts
 *
 * Priority ordering for the queue. Lower weight runs first. JobScheduler
 * uses compareJobs() to pick the next job to run: priority first
 * (Emergency > Premium > Normal > Background), then FIFO by createdAt
 * within the same priority — this is the "Priority Override" + "FIFO"
 * scheduling behavior in one place, so JobQueue/JobScheduler never encode
 * ordering rules themselves.
 */

import type { Job } from './QueueTypes'
import { JobPriorityLevel } from './QueueTypes'

export const PRIORITY_WEIGHT: Record<JobPriorityLevel, number> = {
  [JobPriorityLevel.Emergency]: 0,
  [JobPriorityLevel.Premium]: 1,
  [JobPriorityLevel.Normal]: 2,
  [JobPriorityLevel.Background]: 3,
}

/** Negative when `a` outranks `b`, positive when `b` outranks `a`, zero when equal. */
export function comparePriority(a: JobPriorityLevel, b: JobPriorityLevel): number {
  return PRIORITY_WEIGHT[a] - PRIORITY_WEIGHT[b]
}

/** Total order for dequeue: highest priority first, then earliest createdAt (FIFO) within a priority. */
export function compareJobs(a: Job, b: Job): number {
  const priorityDiff = comparePriority(a.priority, b.priority)
  if (priorityDiff !== 0) return priorityDiff
  return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
}
