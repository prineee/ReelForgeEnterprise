/**
 * ProviderSelector.ts
 *
 * Determines which registered ProviderId should execute a render.
 *
 * Current behavior (Sprint 1) is an exact, intentional mirror of
 * resolveVideoProvider() in services/infrastructure/MovieProductionFactory.ts:
 * VIDEO_PROVIDER=LTX (case-insensitive) selects "LTX", anything else
 * (including unset) selects "GOOGLE". No behavior change from today —
 * this class exists so that logic has one owner going forward instead of
 * being duplicated as GPU-aware routing is added.
 *
 * ProviderSelectionContext is the extension point for future selection
 * inputs (GPU availability, GPU queue depth, cost ceiling, priority,
 * latency budget) — see docs/architecture/render-orchestrator.md. None of
 * these are implemented yet; select() ignores the context entirely today.
 */

import type { ProviderId } from "./interfaces/RenderProvider";

export interface ProviderSelectionContext {
  // TODO: wire once self-hosted GPU providers are real.
  gpuAvailable?: boolean;
  // TODO: wire once GPU providers report queue depth.
  gpuQueueDepth?: number;
  // TODO: wire once CostOptimizer.estimateCost() is implemented.
  maxCost?: number;
  // TODO: use to prefer low-latency/low-queue providers for HIGH priority jobs.
  priority?: "LOW" | "NORMAL" | "HIGH";
  // TODO: use to exclude providers whose expected latency exceeds this budget.
  maxLatencyMs?: number;
}

export class ProviderSelector {
  select(_context?: ProviderSelectionContext): ProviderId {
    // TODO: incorporate GPU availability/queue, cost, priority, and
    // latency budget from _context once those providers/signals are real
    // (see ProviderSelectionContext above). Until then this is a
    // deliberate 1:1 mirror of today's VIDEO_PROVIDER switch.
    return process.env.VIDEO_PROVIDER?.toUpperCase() === "LTX" ? "LTX" : "GOOGLE";
  }
}
