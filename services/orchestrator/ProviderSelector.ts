/**
 * ProviderSelector.ts
 *
 * Given a production request, decides which provider should handle each
 * capability it needs: story generation, character/scene images, video,
 * voice, rendering, storage. Filters candidates by ProviderRegistry
 * availability and ProviderHealth usability, then ranks the survivors by
 * the request's priority. No network calls — this only reads registry
 * metadata and calls CostEstimator/GenerationEstimator's pure math.
 */

import type { OrchestrationRequest, ProviderRegistryEntry, ProviderSelection } from './OrchestratorTypes'
import { AICapability } from './OrchestratorTypes'
import type { ProviderRegistry } from './ProviderRegistry'
import { ProviderAvailability } from './OrchestratorTypes'
import type { ProviderHealthMonitor } from './ProviderHealth'
import { CostEstimator, deriveCapabilityUnits } from './CostEstimator'
import { GenerationEstimator } from './GenerationEstimator'

export class ProviderSelectionError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ProviderSelectionError'
  }
}

interface Candidate {
  entry: ProviderRegistryEntry
  credits: number
  usd: number
  durationSeconds: number
}

export class ProviderSelector {
  constructor(
    private readonly registry: ProviderRegistry,
    private readonly health: ProviderHealthMonitor,
    private readonly costEstimator: CostEstimator,
    private readonly generationEstimator: GenerationEstimator
  ) {}

  /** Selects a provider for every capability the request needs at least one unit of. */
  selectAll(request: OrchestrationRequest): ProviderSelection[] {
    const units = deriveCapabilityUnits(request)
    const selections: ProviderSelection[] = []

    for (const [capability, unitCount] of Object.entries(units) as [AICapability, number][]) {
      if (unitCount <= 0) continue
      selections.push(this.select(capability, request))
    }

    return selections
  }

  /** Selects a provider for a single capability. */
  select(capability: AICapability, request: OrchestrationRequest): ProviderSelection {
    const units = deriveCapabilityUnits(request)[capability] ?? 0

    const candidates: Candidate[] = this.registry
      .listByCapability(capability)
      .filter((entry) => entry.status === ProviderAvailability.Available && this.health.isUsable(entry.id))
      .map((entry) => ({
        entry,
        ...this.costEstimator.estimateForProvider(capability, entry.id, units, request.qualityTier),
        durationSeconds: this.generationEstimator.estimateForProvider(capability, entry.id, units, request.qualityTier),
      }))

    if (candidates.length === 0) {
      throw new ProviderSelectionError(
        `No available, healthy provider supports capability "${capability}". Every registered candidate is either ` +
          `ProviderAvailability.Planned or currently unusable per ProviderHealth.`
      )
    }

    const ranked = this.rank(candidates, request.priority)
    const winner = ranked[0]

    return {
      capability,
      providerId: winner.entry.id,
      reason: this.buildReason(winner, ranked.length, request.priority),
      expectedCost: { credits: winner.credits, usd: winner.usd },
      expectedDurationSeconds: winner.durationSeconds,
      priority: request.priority,
    }
  }

  private rank(candidates: Candidate[], priority: OrchestrationRequest['priority']): Candidate[] {
    const sorted = [...candidates]

    switch (priority) {
      case 'low':
        // Cost matters most: cheapest first, fastest as a tiebreaker.
        return sorted.sort((a, b) => a.credits - b.credits || a.durationSeconds - b.durationSeconds)
      case 'high':
        // Speed matters most: fastest first, cheapest as a tiebreaker.
        return sorted.sort((a, b) => a.durationSeconds - b.durationSeconds || a.credits - b.credits)
      case 'normal':
      default:
        // Balanced: weigh credits and minutes equally.
        return sorted.sort(
          (a, b) => a.credits + a.durationSeconds / 60 - (b.credits + b.durationSeconds / 60)
        )
    }
  }

  private buildReason(winner: Candidate, candidateCount: number, priority: OrchestrationRequest['priority']): string {
    if (candidateCount === 1) {
      return `${winner.entry.displayName} is the only available, healthy provider for this capability.`
    }
    if (priority === 'low') {
      return `${winner.entry.displayName} was the cheapest of ${candidateCount} available, healthy providers.`
    }
    if (priority === 'high') {
      return `${winner.entry.displayName} was the fastest of ${candidateCount} available, healthy providers.`
    }
    return `${winner.entry.displayName} offered the best balance of cost and speed among ${candidateCount} available, healthy providers.`
  }
}
