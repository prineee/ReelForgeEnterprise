/**
 * RenderMetrics.ts
 *
 * In-memory collection of one entry per render attempt (a generate() call
 * through RenderOrchestrator). No database — this is Sprint 1
 * infrastructure only; a persistent store can replace the private array
 * below later without changing this class's public shape.
 *
 * "Success"/"Failure" (per the Sprint 1 spec) is represented as a single
 * `success: boolean` plus an optional `error` populated only when
 * `success` is false — a separate boolean pair would just be two ways of
 * saying the same thing.
 */

import type { ProviderId } from "./interfaces/RenderProvider";

export interface RenderMetricEntry {
  provider: ProviderId;
  /** Seconds, when known. */
  durationSeconds?: number;
  resolution?: string;
  /** Wall-clock time RenderOrchestrator spent waiting on the provider call, in ms. */
  renderTimeMs: number;
  success: boolean;
  /** Present only when success is false. */
  error?: string;
  // TODO: populate once CostOptimizer.calculateCost() is implemented.
  estimatedCost?: number;
  // TODO: populate once billing/credits are wired to rendering (see services/billing/BillingEngine.ts).
  creditsCharged?: number;
  timestamp: string;
}

export class RenderMetrics {
  private readonly entries: RenderMetricEntry[] = [];

  record(entry: RenderMetricEntry): void {
    this.entries.push(entry);
  }

  getAll(): readonly RenderMetricEntry[] {
    return this.entries;
  }

  getByProvider(provider: ProviderId): readonly RenderMetricEntry[] {
    return this.entries.filter((entry) => entry.provider === provider);
  }

  getSuccessCount(provider?: ProviderId): number {
    return this.filterByProvider(provider).filter((entry) => entry.success).length;
  }

  getFailureCount(provider?: ProviderId): number {
    return this.filterByProvider(provider).filter((entry) => !entry.success).length;
  }

  private filterByProvider(provider?: ProviderId): readonly RenderMetricEntry[] {
    return provider ? this.getByProvider(provider) : this.entries;
  }
}
