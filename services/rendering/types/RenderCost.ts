/**
 * RenderCost.ts
 *
 * Shared cost/profit types for cost/CostIntelligence.ts. CostEstimateRequest
 * and RenderCostRecord already exist in ../CostOptimizer.ts (Sprint 1) —
 * re-exported here rather than redefined, so there is exactly one
 * definition of "what a cost estimate request looks like." Everything
 * below is new: the profit/margin shapes CostIntelligence adds on top of
 * CostOptimizer's raw cost estimation.
 */

export type { CostEstimateRequest, RenderCostRecord } from "../CostOptimizer";

import type { ProviderId } from "../interfaces/RenderProvider";

export interface ProfitCalculation {
  provider: ProviderId;
  revenue: number;
  cost: number;
  profit: number;
  marginPercent: number;
}

/** Currency is always assumed USD today — no multi-currency support exists anywhere in this codebase yet. */
export interface CostBreakdown {
  provider: ProviderId;
  estimatedCost?: number;
  actualCost?: number;
  creditsCharged?: number;
}
