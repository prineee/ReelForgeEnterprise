/**
 * QueueTypes.ts
 *
 * The public vocabulary for the AI Job Queue: job identity, lifecycle
 * states, priority levels, and the shapes every other file in this module
 * operates on. Type-only — no business logic, no classes, no imports —
 * mirroring the same rule OrchestratorTypes.ts and
 * MovieProductionContracts.ts follow, so this stays a stable contract even
 * as the in-memory implementation underneath it is replaced later (a
 * Redis- or database-backed JobQueue, for instance).
 *
 * This module is deliberately independent of services/orchestrator/* and
 * services/ai/orchestration/*: a Job's payload is untyped (`unknown`) and
 * dispatched by a string `type` to a registered handler, so the queue has
 * no compile-time knowledge of movie production at all. Anything —
 * AIOrchestrator.planProduction(), MovieProductionService.startProduction(),
 * or something entirely unrelated — can be queued through the same
 * QueueManager without this file changing.
 */

export type JobId = string
export type ISODateTimeString = string

export enum JobStatus {
  Queued = 'QUEUED',
  Waiting = 'WAITING',
  Running = 'RUNNING',
  Completed = 'COMPLETED',
  Failed = 'FAILED',
  Cancelled = 'CANCELLED',
  Retrying = 'RETRYING',
}

export enum JobPriorityLevel {
  Emergency = 'EMERGENCY',
  Premium = 'PREMIUM',
  Normal = 'NORMAL',
  Background = 'BACKGROUND',
}

export interface JobErrorRecord {
  message: string
  occurredAt: ISODateTimeString
  attempt: number
}

/**
 * A single queued unit of work. `payload`/`result` are intentionally
 * `unknown` — the queue stores and orders jobs, it never inspects their
 * contents. A handler registered for `type` (see QueueManager.registerHandler)
 * is the only code that knows what `payload` actually is.
 */
export interface Job {
  id: JobId
  type: string
  payload: unknown
  priority: JobPriorityLevel
  status: JobStatus
  attempts: number
  maxAttempts: number
  createdAt: ISODateTimeString
  /** When this job becomes eligible to run. Equal to createdAt unless future-scheduled. */
  scheduledFor: ISODateTimeString
  startedAt?: ISODateTimeString
  completedAt?: ISODateTimeString
  /** Set while JobStatus.Retrying, cleared once the retry attempt starts. */
  nextRetryAt?: ISODateTimeString
  result?: unknown
  errors: JobErrorRecord[]
  /** Set by QueueManager.cancel() on a job that is already Running — see JobWorker's cooperative-cancellation note. */
  cancelRequested: boolean
}

export type JobHandler = (payload: unknown, job: Job) => Promise<unknown>

export interface SubmitJobOptions {
  type: string
  payload: unknown
  priority?: JobPriorityLevel
  maxAttempts?: number
  /** ISO timestamp. Omit to make the job immediately Queued; a future timestamp makes it Waiting until then. */
  scheduledFor?: ISODateTimeString
}

export interface QueueSnapshot {
  runningCount: number
  waitingCount: number
  completedTodayCount: number
  failedTodayCount: number
  averageRuntimeSeconds: number
}
