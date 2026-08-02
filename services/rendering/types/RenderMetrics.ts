/**
 * RenderMetrics.ts (types)
 *
 * Not to be confused with ../RenderMetrics.ts (the Sprint 1 in-memory
 * collector class). RenderMetricEntry — the single-render record that
 * class collects — is re-exported here rather than redefined, so there
 * is one canonical definition. RenderMetricsSummary is new: the
 * aggregated shape cost/CostIntelligence.ts's dailySummary()/
 * monthlySummary()/yearlySummary() return, built by rolling up entries
 * (from RenderMetrics and/or ledger/RenderLedger.ts) over a time range.
 */

export type { RenderMetricEntry } from "../RenderMetrics";

export interface RenderMetricsSummary {
  periodStart: string;
  periodEnd: string;
  totalRenders: number;
  successCount: number;
  failureCount: number;
  successRate: number;
  averageRenderTimeMs: number;
  /** Undefined until real per-provider pricing exists (see CostOptimizer.ts). */
  averageCost?: number;
  totalCost?: number;
}
