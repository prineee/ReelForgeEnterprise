/**
 * AIOrchestrator.ts
 *
 * The planning layer's single entry point: given a rough sizing request,
 * decide which provider handles each capability, and estimate total cost,
 * credits, and generation time — all BEFORE a production begins. Wraps
 * ProviderSelector (decisions) + CostEstimator + GenerationEstimator
 * (math) into one OrchestrationPlan.
 *
 * This module is intentionally decoupled from
 * services/ai/orchestration/MovieProductionService.ts — it doesn't call
 * it, isn't called by it, and shares no runtime state with it. A caller
 * (e.g. a future POST /api/movie/estimate route, or app/api/movie/create's
 * route before it calls startProduction()) can plug this in without any
 * change to MovieProductionService, MovieProductionFactory, or the
 * contracts they expose. No network calls are made anywhere in this file.
 */

import type { OrchestrationPlan, OrchestrationRequest } from './OrchestratorTypes'
import { ProviderSelector } from './ProviderSelector'
import { CostEstimator } from './CostEstimator'
import { GenerationEstimator } from './GenerationEstimator'
import { InMemoryProviderRegistry } from './ProviderRegistry'
import type { ProviderRegistry } from './ProviderRegistry'
import { InMemoryProviderHealthMonitor } from './ProviderHealth'
import type { ProviderHealthMonitor } from './ProviderHealth'

export class AIOrchestratorError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message)
    this.name = 'AIOrchestratorError'
  }
}

export class AIOrchestrator {
  constructor(
    private readonly providerSelector: ProviderSelector,
    private readonly costEstimator: CostEstimator,
    private readonly generationEstimator: GenerationEstimator
  ) {}

  /**
   * Builds a full plan for a production before it starts: provider
   * selections, cost estimate, and generation estimate.
   */
  planProduction(request: OrchestrationRequest): OrchestrationPlan {
    this.validateRequest(request)

    let selections
    try {
      selections = this.providerSelector.selectAll(request)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      throw new AIOrchestratorError(`Failed to select providers for this request: ${message}`, error)
    }

    const cost = this.costEstimator.estimate(request, selections)
    const generation = this.generationEstimator.estimate(request, selections)

    return {
      request,
      selections,
      cost,
      generation,
      createdAt: new Date().toISOString(),
    }
  }

  private validateRequest(request: OrchestrationRequest): void {
    if (request.estimatedSceneCount < 0) {
      throw new AIOrchestratorError('OrchestrationRequest.estimatedSceneCount cannot be negative.')
    }
    if (request.estimatedCharacterCount < 0) {
      throw new AIOrchestratorError('OrchestrationRequest.estimatedCharacterCount cannot be negative.')
    }
    if (request.targetDurationSecondsPerScene <= 0) {
      throw new AIOrchestratorError('OrchestrationRequest.targetDurationSecondsPerScene must be positive.')
    }
    if (request.currentQueueDepth < 0) {
      throw new AIOrchestratorError('OrchestrationRequest.currentQueueDepth cannot be negative.')
    }
  }
}

/**
 * Wires the default in-memory ProviderRegistry + ProviderHealthMonitor
 * into a ready-to-use AIOrchestrator. No credentials or SDKs required —
 * everything here is placeholder metadata and pure math, so this can be
 * called from anywhere (a route, a script, a future factory) without any
 * setup. Pass explicit registry/health instances instead if a caller wants
 * to share state (e.g. one ProviderHealthMonitor updated by a real
 * health-check job) across multiple orchestrator instances.
 */
export function createDefaultAIOrchestrator(
  registry: ProviderRegistry = new InMemoryProviderRegistry(),
  health: ProviderHealthMonitor = new InMemoryProviderHealthMonitor()
): AIOrchestrator {
  const costEstimator = new CostEstimator(registry)
  const generationEstimator = new GenerationEstimator(registry)
  const providerSelector = new ProviderSelector(registry, health, costEstimator, generationEstimator)
  return new AIOrchestrator(providerSelector, costEstimator, generationEstimator)
}
