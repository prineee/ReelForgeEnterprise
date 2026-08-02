/**
 * RenderDecisionEngine.ts
 *
 * The future brain for provider selection — since Sprint 4, the first
 * real piece of that brain: routing to LOCAL_GPU. ProviderSelector.ts
 * itself is untouched (still only ever returns GOOGLE/LTX) — this class
 * extends it rather than replacing it, so it can be passed anywhere a
 * ProviderSelector is expected, concretely as RenderOrchestrator's
 * `selector` constructor argument (see MovieProductionFactory.ts), with
 * zero changes to RenderOrchestrator.ts itself. select() is overridden
 * with the one real implementation; decide() (Sprint 3's original public
 * name) is a one-line alias to it, so both names stay callable without
 * duplicating the routing logic.
 *
 * Current behavior: VIDEO_PROVIDER=LOCAL_GPU routes to "LOCAL_GPU";
 * anything else falls through to super.select() — ProviderSelector's
 * own, unmodified GOOGLE/LTX logic. No automatic GPU-aware routing yet
 * (see the TODOs below) — this is an explicit opt-in via VIDEO_PROVIDER,
 * exactly as Sprint 4 specifies.
 */

import { ProviderSelector, type ProviderSelectionContext } from "../ProviderSelector";
import type { ProviderId } from "../interfaces/RenderProvider";

/**
 * Extends ProviderSelectionContext with the additional inputs a fuller
 * decision engine will need. Every new field is optional and currently
 * ignored by select() — see the TODOs below.
 */
export interface RenderDecisionContext extends ProviderSelectionContext {
  // TODO Sprint 5+: user's subscription tier, used to gate GPU access or cap spend.
  userPlan?: string;
  // TODO Sprint 5+: hard ceiling for this render's cost; reject/reroute if exceeded.
  budget?: number;
}

export class RenderDecisionEngine extends ProviderSelector {
  /**
   * Chooses a provider for a render.
   *
   * TODO Sprint 5+, in roughly this priority order (once GPU-aware
   * automatic routing replaces today's explicit-opt-in-only behavior):
   *   1. GPU Cost         — GPUManager.estimateRenderCost() vs cloud API cost.
   *   2. API Cost         — CostIntelligence.estimateCost() per candidate provider.
   *   3. GPU Queue        — GPUManager.getQueueDepth(); skip GPU if backed up.
   *   4. Latency           — context.maxLatencyMs vs each candidate's expected time.
   *   5. Priority          — context.priority; HIGH may bypass GPU queue entirely.
   *   6. User Plan         — context.userPlan; gate GPU access by tier.
   *   7. Budget            — context.budget vs estimated cost; reroute or reject.
   *   8. Estimated Cost    — final tie-break among remaining candidates.
   *   9. Provider Health   — ProviderHealthMonitor.getStatistics(); avoid unhealthy providers.
   */
  override select(context?: RenderDecisionContext): ProviderId {
    if (process.env.VIDEO_PROVIDER?.toUpperCase() === "LOCAL_GPU") {
      // TODO Sprint 5+: don't route here unconditionally — check
      // GPUManager.isAvailable()/getGPUHealth() first and fall back to
      // super.select() if the local worker is unhealthy or unconfigured.
      return "LOCAL_GPU";
    }

    return super.select(context);
  }

  /** Alias for select() — kept for callers written against Sprint 3's original public name. */
  decide(context?: RenderDecisionContext): ProviderId {
    return this.select(context);
  }
}
