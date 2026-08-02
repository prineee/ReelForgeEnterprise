/**
 * CostOptimizer.ts
 *
 * Architecture only — no pricing rules yet. This class exists so
 * RenderOrchestrator/ProviderSelector have a stable place to call into
 * once real cost data (LTX $/sec, Google $/sec, self-hosted GPU $/hour
 * amortized, ...) exists, without changing their call sites later. Every
 * method currently throws or no-ops per its own TODO — see each method.
 */

import type { ProviderId } from "./interfaces/RenderProvider";

export interface RenderCostRecord {
  provider: ProviderId;
  durationSeconds: number;
  resolution: string;
  /** Actual cost, once known — undefined until calculateCost() is implemented. */
  cost?: number;
  timestamp: string;
}

export interface CostEstimateRequest {
  provider: ProviderId;
  durationSeconds: number;
  resolution: string;
}

export class CostOptimizer {
  private readonly records: RenderCostRecord[] = [];

  /**
   * Records a completed render for later cost analysis.
   * TODO: once calculateCost() is implemented, call it here and persist
   * the resolved `cost` instead of leaving it undefined.
   */
  recordRender(record: RenderCostRecord): void {
    this.records.push(record);
  }

  /**
   * Computes the actual cost of a completed render.
   * TODO: implement real per-provider pricing rules (LTX $/sec, Google
   * $/sec, self-hosted GPU $/hour amortized across concurrent jobs, etc).
   */
  calculateCost(_record: RenderCostRecord): number {
    throw new Error("CostOptimizer.calculateCost() is not implemented yet.");
  }

  /**
   * Estimates the cost of a render before submitting it.
   * TODO: implement pre-flight cost estimation once pricing rules exist,
   * so ProviderSelector can factor cost into selection (see
   * ProviderSelectionContext.maxCost in ProviderSelector.ts).
   */
  estimateCost(_request: CostEstimateRequest): number {
    throw new Error("CostOptimizer.estimateCost() is not implemented yet.");
  }

  /**
   * Recommends the cheapest/best provider among candidates for a given
   * request.
   * TODO: implement once GPU providers are real and estimateCost() works
   * for every candidate — rank by cost, then by latency/queue depth.
   */
  recommendProvider(_candidates: ProviderId[], _request: CostEstimateRequest): ProviderId {
    throw new Error("CostOptimizer.recommendProvider() is not implemented yet.");
  }

  /** Read-only access to everything recordRender() has captured so far. */
  getRecords(): readonly RenderCostRecord[] {
    return this.records;
  }
}
