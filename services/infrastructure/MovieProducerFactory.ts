/**
 * MovieProducerFactory.ts
 *
 * Composition root for services/ai/movie-producer/ — the same role
 * MovieWorkspaceFactory.ts plays for the director-engine/asset-intelligence
 * layer, kept as its own file for the same reason MovieWorkspaceFactory.ts
 * was split out from MovieProductionFactory.ts: this wiring has no
 * dependency on (and no reason to depend on) MovieProductionService or
 * RenderOrchestrator, and keeping it separate avoids growing an unrelated
 * file or risking regression to the already-working production/render
 * pipeline.
 *
 * buildMovieProductionPlan() reuses MovieWorkspaceFactory.buildDirectorPlan()
 * and getSharedAssetManager() exactly as-is rather than re-deriving the
 * MovieBlueprint -> AIDirectorPlan -> AssetCatalog pipeline a third time.
 * MovieProducer itself needs no shared singleton state (unlike
 * RenderJobManager/AssetManager, it holds no cross-request registry), so a
 * fresh instance per call is correct — the same pattern buildDirectorPlan()
 * already uses for `new AIDirectorEngine()`.
 *
 * No rendering is triggered anywhere in this file.
 */

import { buildDirectorPlan, getSharedAssetManager } from "./MovieWorkspaceFactory";
import { DIRECTOR_PROFILE_PRESETS, type DirectorProfile } from "../ai/director-engine/AIDirectorEngine";
import { MovieProducer, type MovieProductionPlan } from "../ai/movie-producer/MovieProducer";
import type { ProductionContext } from "./ProductionContextRepository";

/**
 * Builds a complete MovieProductionPlan for an already-completed
 * production's ProductionContext. Returns undefined when the production
 * hasn't reached Story Planning yet (no movieBlueprint to plan from) —
 * same contract as buildDirectorPlan().
 */
export function buildMovieProductionPlan(
  context: ProductionContext,
  profile: DirectorProfile = DIRECTOR_PROFILE_PRESETS.CINEMATIC_DRAMA
): MovieProductionPlan | undefined {
  if (!context.movieBlueprint) return undefined;

  const built = buildDirectorPlan(context, profile);
  if (!built) return undefined;
  const { plan, story } = built;

  const assetCatalog = getSharedAssetManager().catalog(context.movieBlueprint, plan);

  const producer = new MovieProducer();
  return producer.produce(context.movieBlueprint, story, plan, assetCatalog);
}
