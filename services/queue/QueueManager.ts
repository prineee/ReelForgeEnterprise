/**
 * QueueManager.ts
 *
 * The Job Queue's single entry point: register handlers by job type,
 * submit/cancel jobs, read metrics, and drive the run loop that ties
 * JobQueue (storage) + JobScheduler (ordering/readiness) + JobWorker
 * (execution) + JobRetryPolicy (failure handling) together.
 *
 * In-memory only — no database, no Redis, no network calls anywhere in
 * this file. Every collaborator is constructor-injected behind an
 * interface (JobQueue), so a persistent backend can replace
 * InMemoryJobQueue later without this class changing.
 *
 * Not wired into anything yet: no route, no service, no provider imports
 * this. It's a standalone module a future caller (e.g. an
 * app/api/movie/create route wanting to queue productions instead of
 * running them inline) can adopt without any change to
 * MovieProductionService, DirectorEngine, providers, or AIOrchestrator.
 */

import { randomUUID } from 'crypto'
import type { Job, JobHandler, JobId, QueueSnapshot, SubmitJobOptions } from './QueueTypes'
import { JobPriorityLevel, JobStatus } from './QueueTypes'
import type { JobQueue } from './JobQueue'
import { InMemoryJobQueue } from './JobQueue'
import { JobScheduler } from './JobScheduler'
import { JobWorker } from './JobWorker'
import { JobRetryPolicy } from './JobRetryPolicy'
import { QueueMetrics } from './QueueMetrics'

export class QueueManagerError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'QueueManagerError'
  }
}

export interface QueueManagerOptions {
  /** Maximum jobs running at once. */
  concurrency: number
  /** How often start()'s run loop ticks, in milliseconds. */
  tickIntervalMs: number
}

const DEFAULT_OPTIONS: QueueManagerOptions = {
  concurrency: 3,
  tickIntervalMs: 1000,
}

export class QueueManager {
  private readonly queue: JobQueue
  private readonly scheduler: JobScheduler
  private readonly worker: JobWorker
  private readonly metrics: QueueMetrics
  private readonly options: QueueManagerOptions

  private readonly handlers = new Map<string, JobHandler>()
  private readonly inFlight = new Map<JobId, Promise<Job>>()
  private timer: ReturnType<typeof setInterval> | null = null
  private stopping = false

  constructor(queue: JobQueue = new InMemoryJobQueue(), options: Partial<QueueManagerOptions> = {}) {
    this.queue = queue
    this.scheduler = new JobScheduler(queue)
    this.worker = new JobWorker(queue, new JobRetryPolicy())
    this.metrics = new QueueMetrics(queue)
    this.options = { ...DEFAULT_OPTIONS, ...options }
  }

  /** Registers the function that will run every job submitted with this `type`. */
  registerHandler(type: string, handler: JobHandler): void {
    this.handlers.set(type, handler)
  }

  /** Adds a job to the queue. Status is Waiting if scheduledFor is in the future, Queued otherwise. */
  submit(options: SubmitJobOptions): Job {
    if (!this.handlers.has(options.type)) {
      throw new QueueManagerError(`No handler registered for job type "${options.type}". Call registerHandler() first.`)
    }

    const now = new Date()
    const scheduledFor = options.scheduledFor ?? now.toISOString()
    const isFuture = new Date(scheduledFor).getTime() > now.getTime()

    const job: Job = {
      id: randomUUID(),
      type: options.type,
      payload: options.payload,
      priority: options.priority ?? JobPriorityLevel.Normal,
      status: isFuture ? JobStatus.Waiting : JobStatus.Queued,
      attempts: 0,
      maxAttempts: options.maxAttempts ?? 0,
      createdAt: now.toISOString(),
      scheduledFor,
      errors: [],
      cancelRequested: false,
    }

    this.queue.add(job)
    return job
  }

  /**
   * Cancels a job. Queued/Waiting/Retrying jobs are cancelled immediately.
   * A Running job is flagged for cooperative cancellation — see
   * JobWorker's file header for what that means in practice.
   */
  cancel(jobId: JobId): Job {
    const job = this.queue.get(jobId)
    if (!job) {
      throw new QueueManagerError(`No job found for id "${jobId}".`)
    }

    if (job.status === JobStatus.Running) {
      const flagged: Job = { ...job, cancelRequested: true }
      this.queue.update(flagged)
      return flagged
    }

    if (
      job.status === JobStatus.Queued ||
      job.status === JobStatus.Waiting ||
      job.status === JobStatus.Retrying
    ) {
      const cancelled: Job = { ...job, status: JobStatus.Cancelled, completedAt: new Date().toISOString() }
      this.queue.update(cancelled)
      return cancelled
    }

    throw new QueueManagerError(`Cannot cancel job "${jobId}": it is already ${job.status.toLowerCase()}.`)
  }

  getJob(jobId: JobId): Job | undefined {
    return this.queue.get(jobId)
  }

  listJobs(): Job[] {
    return this.queue.listAll()
  }

  getSnapshot(now?: Date): QueueSnapshot {
    return this.metrics.snapshot(now)
  }

  /**
   * Runs one scheduling round: promotes due Waiting/Retrying jobs, then
   * fills any free worker slots (up to `concurrency`) with the
   * highest-ranked ready jobs. Safe to call directly (e.g. in tests)
   * without start()'s interval.
   */
  async tick(now: Date = new Date()): Promise<void> {
    if (this.stopping) return

    this.scheduler.promoteDueJobs(now)

    const freeSlots = this.options.concurrency - this.inFlight.size
    if (freeSlots <= 0) return

    const next = this.scheduler.pickNextBatch(freeSlots)
    for (const job of next) {
      this.startRun(job)
    }
  }

  private startRun(job: Job): void {
    const handler = this.handlers.get(job.type)
    if (!handler) {
      throw new QueueManagerError(`No handler registered for job type "${job.type}".`)
    }

    const run = this.worker.run(job, handler).finally(() => {
      this.inFlight.delete(job.id)
    })
    this.inFlight.set(job.id, run)
  }

  /** Starts the background run loop, ticking every `tickIntervalMs`. */
  start(): void {
    if (this.timer) return
    this.stopping = false
    this.timer = setInterval(() => {
      void this.tick()
    }, this.options.tickIntervalMs)
  }

  /**
   * Graceful shutdown: stops picking up new jobs and waits for every
   * currently in-flight job to finish (or be cooperatively cancelled)
   * before resolving.
   */
  async stop(): Promise<void> {
    this.stopping = true
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = null
    }
    await Promise.all(Array.from(this.inFlight.values()))
    this.stopping = false
  }
}
