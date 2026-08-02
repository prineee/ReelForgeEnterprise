/**
 * ProductionPlanner.ts
 *
 * Dependency-aware readiness ordering already exists —
 * services/ai/asset-intelligence/AssetDependencyGraph.ts's
 * topologicalOrder() (Kahn's algorithm over the real MovieBlueprint
 * entity graph), already built once as part of AssetCatalog.dependencyGraph.
 * Narrative scene timing already exists too —
 * services/ai/director-engine/MovieTimelineBuilder.ts's MovieTimelinePlan,
 * already computed on AIDirectorPlan.timeline. Neither is recomputed
 * here; this class only reconciles the two into one ordered production
 * schedule and attaches a read-only provider preview per scene via
 * services/rendering/ProviderSelector.ts's select() — a pure function
 * that inspects VIDEO_PROVIDER and returns a ProviderId, never submits
 * or triggers a render. RenderOrchestrator/RenderJobManager are never
 * called from this file.
 *
 * No AI model calls, no network access, no randomness, no rendering.
 */

import type { EntityId } from "../director/OutputSchema";
import type { MovieBlueprint } from "../director/DirectorEngine";
import type { AssetDependencyGraph, AssetNodeType } from "../asset-intelligence/AssetDependencyGraph";
import type { MovieTimelinePlan } from "../director-engine/MovieTimelineBuilder";
import { ProviderSelector } from "../../rendering/ProviderSelector";
import type { ProviderId } from "../../rendering/interfaces/RenderProvider";

export interface ScheduledUnit {
  assetId: EntityId;
  assetType: AssetNodeType;
  label: string;
  /** Position in the dependency-safe build order (AssetDependencyGraph.topologicalOrder()) — 0-based. */
  order: number;
  /** Narrative start time from MovieTimelinePlan — only populated for SCENE nodes. */
  narrativeStartSeconds?: number;
  /** Read-only provider preview via ProviderSelector.select() — never submits a render. Only populated for SCENE nodes. */
  recommendedProvider?: ProviderId;
}

export interface ProductionSchedule {
  movieId: EntityId;
  units: ScheduledUnit[];
  totalScenes: number;
  totalPlannedDurationSeconds: number;
}

/** Reconciles AssetDependencyGraph's readiness order with MovieTimelinePlan's narrative timing into one schedule. Never triggers a render. */
export class ProductionPlanner {
  constructor(private readonly providerSelector: ProviderSelector = new ProviderSelector()) {}

  schedule(movie: MovieBlueprint, dependencyGraph: AssetDependencyGraph, timeline: MovieTimelinePlan): ProductionSchedule {
    const timelineBySceneId = new Map(timeline.entries.map((entry) => [entry.sceneId, entry]));

    const units = dependencyGraph.topologicalOrder().map((node, index): ScheduledUnit => {
      if (node.type !== "SCENE") {
        return { assetId: node.id, assetType: node.type, label: node.label, order: index };
      }

      const timelineEntry = timelineBySceneId.get(node.id);
      return {
        assetId: node.id,
        assetType: node.type,
        label: node.label,
        order: index,
        narrativeStartSeconds: timelineEntry?.plannedStartSeconds,
        recommendedProvider: this.providerSelector.select(),
      };
    });

    return {
      movieId: movie.movie.id,
      units,
      totalScenes: movie.scenes.length,
      totalPlannedDurationSeconds: timeline.totalPlannedDurationSeconds,
    };
  }
}

export default ProductionPlanner;
