/**
 * ProviderStatistics.ts
 *
 * Shared type for health/ProviderHealthMonitor.ts and
 * cost/CostIntelligence.ts.providerStatistics(). One definition of "what
 * we track per provider" so both modules report the same shape.
 */

import type { ProviderId } from "../interfaces/RenderProvider";

export interface ProviderStatistics {
  provider: ProviderId;
  averageRenderTimeMs: number;
  averageQueueTimeMs: number;
  successRate: number;
  failureRate: number;
  retryRate: number;
  averageCost: number;
  jobsCompleted: number;
  jobsFailed: number;
}
