/**
 * GenerationEstimator.ts
 *
 * Estimates how long a production will take before it begins: total
 * runtime, per-scene runtime, queue delay from productions ahead of it,
 * and an expected completion timestamp. Pure math over ProviderCostRegistry
 * speed profiles — no network calls, no timers, no polling.
 *
 * Stage order mirrors the real pipeline's sequential stages
 * (services/ai/orchestration/MovieProductionService.ts: story → reference
 * images → scene prompts → video generation → assembly), so
 * totalRuntimeSeconds is a sum across capabilities rather than a max —
 * consistent with how those stages actually run one after another today.
 */

import type { GenerationBreakdownEntry, GenerationEstimate, OrchestrationRequest, ProviderId, ProviderSelection } from './OrchestratorTypes'
import { AICapability } from './OrchestratorTypes'
import type { ProviderCostRegistry } from './ProviderRegistry'
import { QUALITY_MULTIPLIER, deriveCapabilityUnits } from './CostEstimator'

export class GenerationEstimatorError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'GenerationEstimatorError'
  }
}

/**
 * Average seconds a queued production is assumed to take, used only to
 * size queue delay for productions ahead of this one. A placeholder
 * constant — MovieProductionService doesn't expose real queue timing yet.
 */
const ASSUMED_SECONDS_PER_QUEUED_PRODUCTION = 20 * 60

export class GenerationEstimator {
  constructor(private readonly registry: ProviderCostRegistry) {}

  /** Seconds to produce `units` of `capability` on a specific provider, quality-adjusted, accounting for concurrency. */
  estimateForProvider(
    capability: AICapability,
    providerId: ProviderId,
    units: number,
    qualityTier: OrchestrationRequest['qualityTier']
  ): number {
    const entry = this.registry.get(providerId)
    const capabilityProfile = entry.capabilities[capability]
    if (!capabilityProfile) {
      throw new GenerationEstimatorError(`Provider "${providerId}" does not support capability "${capability}".`)
    }

    const { secondsPerUnit, concurrency } = capabilityProfile.speed
    const batches = Math.ceil(units / Math.max(1, concurrency))
    return Math.round(batches * secondsPerUnit * QUALITY_MULTIPLIER[qualityTier])
  }

  /** Full timing breakdown across every capability, using the providers ProviderSelector already chose. */
  estimate(request: OrchestrationRequest, selections: ProviderSelection[]): GenerationEstimate {
    const units = deriveCapabilityUnits(request)
    const selectionByCapability = new Map(selections.map((s) => [s.capability, s]))

    const breakdown: GenerationBreakdownEntry[] = []
    let totalRuntimeSeconds = 0
    let perSceneRelevantSeconds = 0

    for (const [capability, unitCount] of Object.entries(units) as [AICapability, number][]) {
      if (unitCount <= 0) continue

      const selection = selectionByCapability.get(capability)
      if (!selection) {
        breakdown.push({ capability, units: unitCount, secondsTotal: 0 })
        continue
      }

      const secondsTotal = this.estimateForProvider(capability, selection.providerId, unitCount, request.qualityTier)
      breakdown.push({ capability, units: unitCount, secondsTotal })
      totalRuntimeSeconds += secondsTotal

      if (
        capability === AICapability.SceneImage ||
        capability === AICapability.VideoGeneration ||
        capability === AICapability.VoiceSynthesis
      ) {
        perSceneRelevantSeconds += secondsTotal
      }
    }

    const perSceneRuntimeSeconds =
      request.estimatedSceneCount > 0 ? Math.round(perSceneRelevantSeconds / request.estimatedSceneCount) : 0

    const queueDelaySeconds = Math.max(0, request.currentQueueDepth) * ASSUMED_SECONDS_PER_QUEUED_PRODUCTION
    const expectedCompletionAt = new Date(Date.now() + (queueDelaySeconds + totalRuntimeSeconds) * 1000).toISOString()

    return {
      breakdown,
      totalRuntimeSeconds,
      perSceneRuntimeSeconds,
      queueDelaySeconds,
      expectedCompletionAt,
    }
  }
}
