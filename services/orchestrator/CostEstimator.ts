/**
 * CostEstimator.ts
 *
 * Estimates AI cost before a production begins: how many units of each
 * capability (story planning, character images, scene images, videos,
 * voice, rendering, storage) the request will need, and what that costs on
 * a given provider. Pure math over ProviderRegistry data — no network
 * calls, no SDKs.
 *
 * deriveCapabilityUnits() is the one piece of sizing logic both
 * CostEstimator and GenerationEstimator need (how many "units" of each
 * capability a request implies), so it lives here and GenerationEstimator
 * imports it, rather than each re-deriving it slightly differently.
 */

import type { ExpectedCost, OrchestrationRequest, ProviderId, ProviderSelection, CostBreakdownEntry, CostEstimate } from './OrchestratorTypes'
import { AICapability } from './OrchestratorTypes'
import type { ProviderRegistry } from './ProviderRegistry'

export class CostEstimatorError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'CostEstimatorError'
  }
}

/**
 * Cost/duration multiplier applied per quality tier — a placeholder
 * heuristic, not a billing rule. Exported so GenerationEstimator applies
 * the same quality semantics to time that this file applies to cost.
 */
export const QUALITY_MULTIPLIER: Record<OrchestrationRequest['qualityTier'], number> = {
  draft: 0.7,
  standard: 1.0,
  high: 1.4,
}

/** Rough estimate of rendered video weight, used only to size the Storage capability. */
const ESTIMATED_MB_PER_VIDEO_SECOND = 1.2

/**
 * Estimates how many units of each capability a request implies. "Unit"
 * meaning is capability-specific: one call for story/rendering, one image
 * per character/scene, one clip per scene, one voice line per scene, and
 * estimated output megabytes for storage.
 */
export function deriveCapabilityUnits(request: OrchestrationRequest): Partial<Record<AICapability, number>> {
  const totalVideoSeconds = request.estimatedSceneCount * request.targetDurationSecondsPerScene
  const estimatedStorageMb = Math.max(1, Math.round(totalVideoSeconds * ESTIMATED_MB_PER_VIDEO_SECOND))

  return {
    [AICapability.StoryGeneration]: 1,
    [AICapability.CharacterImage]: Math.max(0, request.estimatedCharacterCount),
    [AICapability.SceneImage]: Math.max(0, request.estimatedSceneCount),
    [AICapability.VideoGeneration]: Math.max(0, request.estimatedSceneCount),
    [AICapability.VoiceSynthesis]: Math.max(0, request.estimatedSceneCount),
    [AICapability.Rendering]: 1,
    [AICapability.Storage]: estimatedStorageMb,
  }
}

export class CostEstimator {
  constructor(private readonly registry: ProviderRegistry) {}

  /** Cost of `units` of `capability` on a specific provider, quality-adjusted. */
  estimateForProvider(
    capability: AICapability,
    providerId: ProviderId,
    units: number,
    qualityTier: OrchestrationRequest['qualityTier']
  ): ExpectedCost {
    const entry = this.registry.get(providerId)
    const capabilityProfile = entry.capabilities[capability]
    if (!capabilityProfile) {
      throw new CostEstimatorError(`Provider "${providerId}" does not support capability "${capability}".`)
    }

    const multiplier = QUALITY_MULTIPLIER[qualityTier]
    return {
      credits: Math.ceil(units * capabilityProfile.cost.creditsPerUnit * multiplier),
      usd: Number((units * capabilityProfile.cost.usdPerUnit * multiplier).toFixed(4)),
    }
  }

  /**
   * Full cost breakdown across every capability, using the providers
   * ProviderSelector already chose. Returns one breakdown entry per
   * capability that has a unit count > 0, plus totals.
   */
  estimate(request: OrchestrationRequest, selections: ProviderSelection[]): CostEstimate {
    const units = deriveCapabilityUnits(request)
    const selectionByCapability = new Map(selections.map((s) => [s.capability, s]))

    const breakdown: CostBreakdownEntry[] = []
    let totalCredits = 0
    let totalUsd = 0

    for (const [capability, unitCount] of Object.entries(units) as [AICapability, number][]) {
      if (unitCount <= 0) continue

      const selection = selectionByCapability.get(capability)
      if (!selection) {
        breakdown.push({ capability, providerId: null, units: unitCount, credits: 0, usd: 0 })
        continue
      }

      const cost = this.estimateForProvider(capability, selection.providerId, unitCount, request.qualityTier)
      breakdown.push({ capability, providerId: selection.providerId, units: unitCount, credits: cost.credits, usd: cost.usd })
      totalCredits += cost.credits
      totalUsd += cost.usd
    }

    return { breakdown, totalCredits, totalUsd: Number(totalUsd.toFixed(4)) }
  }
}
