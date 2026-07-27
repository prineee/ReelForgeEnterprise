/**
 * ProviderHealthMonitor.ts
 *
 * In-memory, per-provider health tracking: render time, queue time,
 * success/failure/retry rate, average cost, and job counts. Fed by
 * record() calls (nothing calls this yet — see this sprint's "no
 * behavior change" scope); reads are real aggregation over whatever has
 * been recorded, never fabricated — with zero observations, every rate
 * is honestly 0, not a guess.
 *
 * This is the provider-health input RenderDecisionEngine's future TODOs
 * (Provider Health) will read from — a bad-performing provider becomes
 * visible here before anything acts on it.
 */

import type { ProviderId } from "../interfaces/RenderProvider";
import type { ProviderStatistics } from "../types/ProviderStatistics";

export interface ProviderHealthObservation {
  provider: ProviderId;
  /** Milliseconds spent actually rendering (provider generate->complete). */
  renderTimeMs?: number;
  /** Milliseconds spent queued before the provider started rendering. */
  queueTimeMs?: number;
  success: boolean;
  retried?: boolean;
  cost?: number;
  timestamp: string;
}

export class ProviderHealthMonitor {
  private readonly observations: ProviderHealthObservation[] = [];

  record(observation: ProviderHealthObservation): void {
    this.observations.push(observation);
  }

  getStatistics(provider: ProviderId): ProviderStatistics {
    return this.summarize(provider, this.observations.filter((o) => o.provider === provider));
  }

  getAllStatistics(): readonly ProviderStatistics[] {
    const providers = Array.from(new Set(this.observations.map((o) => o.provider)));
    return providers.map((provider) => this.getStatistics(provider));
  }

  private summarize(provider: ProviderId, observations: ProviderHealthObservation[]): ProviderStatistics {
    const total = observations.length;
    const completed = observations.filter((o) => o.success);
    const failed = observations.filter((o) => !o.success);
    const retried = observations.filter((o) => o.retried);
    const costs = observations.filter((o) => o.cost !== undefined).map((o) => o.cost as number);

    return {
      provider,
      averageRenderTimeMs: this.average(observations.map((o) => o.renderTimeMs)),
      averageQueueTimeMs: this.average(observations.map((o) => o.queueTimeMs)),
      successRate: total === 0 ? 0 : completed.length / total,
      failureRate: total === 0 ? 0 : failed.length / total,
      retryRate: total === 0 ? 0 : retried.length / total,
      averageCost: this.average(costs),
      jobsCompleted: completed.length,
      jobsFailed: failed.length,
    };
  }

  private average(values: Array<number | undefined>): number {
    const defined = values.filter((v): v is number => v !== undefined);
    if (defined.length === 0) return 0;
    return defined.reduce((sum, v) => sum + v, 0) / defined.length;
  }
}
