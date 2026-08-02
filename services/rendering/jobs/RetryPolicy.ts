/**
 * RetryPolicy.ts
 *
 * Exponential backoff with a cap, for jobs/RenderJobManager.ts's retry
 * decisions — the same algorithm and the same defaults as
 * services/queue/JobRetryPolicy.ts, the movie-workflow subsystem's
 * existing retry policy (delaySeconds = baseDelaySeconds * 2^(attempt-1),
 * capped at maxDelaySeconds). Deliberately not imported directly: that
 * class's evaluate(job: Job) is coupled to services/queue/QueueTypes.ts's
 * Job shape (attempts/maxAttempts/errors), and render jobs
 * (types/RenderJob.ts's RenderJob) are an intentionally separate model —
 * the same RenderJob/Job split already exists throughout Sprints 1-4, and
 * services/workflow/* itself already creates a brand-new queue job per
 * retry rather than mutating one in place, the same pattern used here.
 * Kept in sync with JobRetryPolicy's formula/defaults by design.
 */

export interface RetryDecision {
  shouldRetry: boolean;
  /** Seconds to wait before the retry — only present when shouldRetry is true. */
  delaySeconds?: number;
}

export interface RetryPolicyOptions {
  maxAttempts: number;
  baseDelaySeconds: number;
  maxDelaySeconds: number;
}

export const DEFAULT_RETRY_POLICY_OPTIONS: RetryPolicyOptions = {
  maxAttempts: 3,
  baseDelaySeconds: 5,
  maxDelaySeconds: 300,
};

export class RetryPolicy {
  constructor(private readonly options: RetryPolicyOptions = DEFAULT_RETRY_POLICY_OPTIONS) {}

  /** This policy's configured max attempts, used as the fallback when a job doesn't specify its own override. */
  get defaultMaxAttempts(): number {
    return this.options.maxAttempts;
  }

  /**
   * `attempt` is 1-indexed (the attempt that just failed). `maxAttemptsOverride`
   * lets a specific job request fewer/more attempts than this policy's
   * default (see SubmitRenderJobOptions.maxAttempts in RenderJobManager.ts).
   */
  evaluate(attempt: number, maxAttemptsOverride?: number): RetryDecision {
    const maxAttempts = maxAttemptsOverride ?? this.options.maxAttempts;
    if (attempt >= maxAttempts) {
      return { shouldRetry: false };
    }

    const delaySeconds = Math.min(
      this.options.baseDelaySeconds * Math.pow(2, attempt - 1),
      this.options.maxDelaySeconds
    );
    return { shouldRetry: true, delaySeconds };
  }
}
