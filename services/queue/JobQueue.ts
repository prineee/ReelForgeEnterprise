/**
 * JobQueue.ts
 *
 * Pure in-memory storage for jobs — a Map keyed by JobId, with basic CRUD
 * and status-filtered listing. No ordering, no scheduling, no execution
 * logic lives here; JobScheduler decides what runs next, JobWorker runs
 * it. Keeping storage this dumb is what makes it swappable later (a
 * Redis- or database-backed JobQueue implementing the same interface)
 * without touching JobScheduler, JobWorker, or QueueManager.
 */

import type { Job, JobId, JobStatus } from './QueueTypes'

export class JobQueueError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'JobQueueError'
  }
}

export interface JobQueue {
  add(job: Job): void
  get(jobId: JobId): Job | undefined
  update(job: Job): void
  remove(jobId: JobId): void
  listAll(): Job[]
  listByStatus(status: JobStatus): Job[]
  size(): number
}

export class InMemoryJobQueue implements JobQueue {
  private readonly jobs = new Map<JobId, Job>()

  add(job: Job): void {
    if (this.jobs.has(job.id)) {
      throw new JobQueueError(`A job with id "${job.id}" is already queued.`)
    }
    this.jobs.set(job.id, job)
  }

  get(jobId: JobId): Job | undefined {
    return this.jobs.get(jobId)
  }

  update(job: Job): void {
    if (!this.jobs.has(job.id)) {
      throw new JobQueueError(`Cannot update unknown job id "${job.id}".`)
    }
    this.jobs.set(job.id, job)
  }

  remove(jobId: JobId): void {
    this.jobs.delete(jobId)
  }

  listAll(): Job[] {
    return Array.from(this.jobs.values())
  }

  listByStatus(status: JobStatus): Job[] {
    return this.listAll().filter((job) => job.status === status)
  }

  size(): number {
    return this.jobs.size
  }
}
