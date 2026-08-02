/**
 * JobRetryPolicy.ts
 *
 * Decides whether a failed job gets another attempt, and how long to wait
 * before it. Pure math, no timers — JobWorker calls evaluate() and asks
 * QueueManager to schedule the retry; nothing here starts a clock itself.
 */

import type { Job } from './QueueTypes'

export interface RetryDecision {
  shouldRetry: boolean
  /** Present only when shouldRetry is true. */
  nextRetryAt?: string
  delaySeconds?: number
}

export interface JobRetryPolicyOptions {
  /** Used when a job doesn't specify its own maxAttempts. */
  defaultMaxAttempts: number
  baseDelaySeconds: number
  maxDelaySeconds: number
}

export const DEFAULT_RETRY_POLICY_OPTIONS: JobRetryPolicyOptions = {
  defaultMaxAttempts: 3,
  baseDelaySeconds: 5,
  maxDelaySeconds: 5 * 60,
}

/** Exponential backoff with a max-attempts ceiling. */
export class JobRetryPolicy {
  constructor(private readonly options: JobRetryPolicyOptions = DEFAULT_RETRY_POLICY_OPTIONS) {}

  evaluate(job: Job): RetryDecision {
    const maxAttempts = job.maxAttempts > 0 ? job.maxAttempts : this.options.defaultMaxAttempts

    if (job.attempts >= maxAttempts) {
      return { shouldRetry: false }
    }

    const delaySeconds = this.computeBackoffSeconds(job.attempts)
    return {
      shouldRetry: true,
      delaySeconds,
      nextRetryAt: new Date(Date.now() + delaySeconds * 1000).toISOString(),
    }
  }

  /** Backoff for the Nth attempt (1-indexed): baseDelay * 2^(attempt-1), capped at maxDelaySeconds. */
  private computeBackoffSeconds(attempt: number): number {
    const exponential = this.options.baseDelaySeconds * Math.pow(2, Math.max(0, attempt - 1))
    return Math.min(exponential, this.options.maxDelaySeconds)
  }
}
