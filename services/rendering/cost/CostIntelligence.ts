/**
 * CostIntelligence.ts
 *
 * Central business intelligence layer over rendering cost/profit —
 * provider-independent (no LTX/Google/GPU-specific logic anywhere in
 * this file; every method takes/returns ProviderId generically).
 *
 * Composes rather than duplicates: raw per-provider cost estimation and
 * recording already live in ../CostOptimizer.ts (Sprint 1) — this class
 * delegates to it instead of reimplementing the same "not implemented
 * yet" pricing logic a second time. Reporting (providerStatistics/
 * dailySummary/monthlySummary/yearlySummary) is real aggregation over an
 * injected ../ledger/RenderLedger.ts — genuine arithmetic over whatever
 * has actually been recorded, never fabricated. Cost/profit fields in
 * that aggregation are honestly 0/undefined until CostOptimizer's
 * pricing rules exist (Sprint 4+); render-time/success-rate fields are
 * real today.
 */

import type { ProviderId } from "../interfaces/RenderProvider";
import { CostOptimizer } from "../CostOptimizer";
import type { CostEstimateRequest } from "../CostOptimizer";
import { RenderLedger } from "../ledger/RenderLedger";
import type { RenderLedgerEntry } from "../ledger/RenderLedger";
import type { ProviderStatistics } from "../types/ProviderStatistics";
import type { RenderMetricsSummary } from "../types/RenderMetrics";
import type { ProfitCalculation } from "../types/RenderCost";

export class CostIntelligence {
  constructor(
    private readonly costOptimizer: CostOptimizer = new CostOptimizer(),
    private readonly ledger: RenderLedger = new RenderLedger()
  ) {}

  /** Delegates to CostOptimizer — still throws until real per-provider pricing exists (see CostOptimizer.ts). */
  estimateCost(request: CostEstimateRequest): number {
    return this.costOptimizer.estimateCost(request);
  }

  /** Records a render's actual cost/outcome into the ledger — the system of record providerStatistics()/*Summary() read from. */
  recordActualCost(entry: RenderLedgerEntry): void {
    this.ledger.record(entry);
  }

  calculateProfit(provider: ProviderId, revenue: number, cost: number): ProfitCalculation {
    const profit = revenue - cost;
    return {
      provider,
      revenue,
      cost,
      profit,
      marginPercent: this.calculateMargin(revenue, cost),
    };
  }

  calculateMargin(revenue: number, cost: number): number {
    if (revenue <= 0) return 0;
    return ((revenue - cost) / revenue) * 100;
  }

  providerStatistics(provider: ProviderId): ProviderStatistics {
    return this.summarizeAsProviderStatistics(provider, this.ledger.getByProvider(provider));
  }

  dailySummary(dateIso: string): RenderMetricsSummary {
    const start = this.startOfDayUtc(dateIso);
    const end = this.addDaysUtc(start, 1);
    return this.summarizeByRange(start, end);
  }

  monthlySummary(year: number, month: number): RenderMetricsSummary {
    const start = new Date(Date.UTC(year, month - 1, 1)).toISOString();
    const end = new Date(Date.UTC(month === 12 ? year + 1 : year, month === 12 ? 0 : month, 1)).toISOString();
    return this.summarizeByRange(start, end);
  }

  yearlySummary(year: number): RenderMetricsSummary {
    const start = new Date(Date.UTC(year, 0, 1)).toISOString();
    const end = new Date(Date.UTC(year + 1, 0, 1)).toISOString();
    return this.summarizeByRange(start, end);
  }

  // ── Aggregation ──────────────────────────────────────────────────────

  private summarizeAsProviderStatistics(provider: ProviderId, entries: readonly RenderLedgerEntry[]): ProviderStatistics {
    const completed = entries.filter((e) => e.status === "COMPLETED");
    const failed = entries.filter((e) => e.status === "FAILED");
    const retried = entries.filter((e) => e.retryCount > 0);
    const costs = entries.filter((e) => e.actualCost !== undefined).map((e) => e.actualCost as number);

    return {
      provider,
      averageRenderTimeMs: this.average(entries.map((e) => e.generationTimeMs)),
      averageQueueTimeMs: 0, // TODO: populate once queue/RenderQueue.ts timestamps feed the ledger.
      successRate: entries.length === 0 ? 0 : completed.length / entries.length,
      failureRate: entries.length === 0 ? 0 : failed.length / entries.length,
      retryRate: entries.length === 0 ? 0 : retried.length / entries.length,
      averageCost: this.average(costs),
      jobsCompleted: completed.length,
      jobsFailed: failed.length,
    };
  }

  private summarizeByRange(startIso: string, endIso: string): RenderMetricsSummary {
    const entries = this.ledger.getByDateRange(startIso, endIso);
    const completed = entries.filter((e) => e.status === "COMPLETED");
    const failed = entries.filter((e) => e.status === "FAILED");
    const costs = entries.filter((e) => e.actualCost !== undefined).map((e) => e.actualCost as number);

    return {
      periodStart: startIso,
      periodEnd: endIso,
      totalRenders: entries.length,
      successCount: completed.length,
      failureCount: failed.length,
      successRate: entries.length === 0 ? 0 : completed.length / entries.length,
      averageRenderTimeMs: this.average(entries.map((e) => e.generationTimeMs)),
      averageCost: costs.length === 0 ? undefined : this.average(costs),
      totalCost: costs.length === 0 ? undefined : costs.reduce((sum, c) => sum + c, 0),
    };
  }

  private average(values: Array<number | undefined>): number {
    const defined = values.filter((v): v is number => v !== undefined);
    if (defined.length === 0) return 0;
    return defined.reduce((sum, v) => sum + v, 0) / defined.length;
  }

  private startOfDayUtc(dateIso: string): string {
    const d = new Date(dateIso);
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())).toISOString();
  }

  private addDaysUtc(dateIso: string, days: number): string {
    const d = new Date(dateIso);
    return new Date(d.getTime() + days * 24 * 60 * 60 * 1000).toISOString();
  }
}
