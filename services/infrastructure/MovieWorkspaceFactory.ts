/**
 * MovieWorkspaceFactory.ts
 *
 * The composition root for the Movie Studio workspace UI (app/movie-studio/)
 * — mirrors services/infrastructure/MovieProductionFactory.ts's role
 * (module-level shared singletons, globalThis-anchored so Next.js dev-mode
 * Fast Refresh can't silently reset them) but for the Sprint 5-7 services
 * that file never wires in: RenderJobManager (services/rendering/jobs/),
 * AssetManager (services/ai/asset-intelligence/), and AIDirectorEngine
 * (services/ai/director-engine/). This file creates no new business logic
 * — every class it constructs already exists and is untouched; this is
 * wiring only, exactly like MovieProductionFactory.ts already is for the
 * director/production layer.
 *
 * Why a separate file rather than adding to MovieProductionFactory.ts:
 * that file is explicitly documented as composing the director/production/
 * VeoService layer for MovieProductionService — it has no dependency on
 * (and no reason to depend on) RenderJobManager/AssetManager/AIDirectorEngine,
 * none of which MovieProductionService calls. Keeping this wiring separate
 * avoids growing an unrelated file and avoids risking any regression to
 * the already-working production pipeline that file drives.
 *
 * Video provider selection here uses the exact same RenderDecisionEngine +
 * createDefaultProviderRegistry() + VIDEO_PROVIDER env var as
 * MovieProductionFactory.ts's real (non-Developer-Mode) path — rendering
 * triggered from this workspace behaves identically to rendering triggered
 * anywhere else in the app, not a separately-special-cased "demo" mode.
 */

import { RenderOrchestrator } from "../rendering/RenderOrchestrator";
import { createDefaultProviderRegistry } from "../rendering/ProviderRegistry";
import { RenderDecisionEngine } from "../rendering/decision/RenderDecisionEngine";
import { RenderJobManager } from "../rendering/jobs/RenderJobManager";
import { AssetManager } from "../ai/asset-intelligence/AssetManager";
import { AIDirectorEngine, DIRECTOR_PROFILE_PRESETS, type DirectorProfile } from "../ai/director-engine/AIDirectorEngine";
import type { AIDirectorPlan } from "../ai/director-engine/AIDirectorEngine";
import type { MovieBlueprint } from "../ai/director/DirectorEngine";
import type { StoryBlueprint } from "../ai/director/StoryAnalyzer";
import type { ReferencePromptPlan } from "../ai/production/ReferenceImageGenerator";
import type { ProductionContext, UploadedReferenceAsset } from "./ProductionContextRepository";

declare global {
  // eslint-disable-next-line no-var
  var __movieWorkspaceRenderJobManager: RenderJobManager | undefined;
  // eslint-disable-next-line no-var
  var __movieWorkspaceAssetManager: AssetManager | undefined;
}

/** Same dev-mode Fast Refresh protection InMemoryProductionContextRepository already uses. */
export function getSharedRenderJobManager(): RenderJobManager {
  if (!globalThis.__movieWorkspaceRenderJobManager) {
    globalThis.__movieWorkspaceRenderJobManager = new RenderJobManager(
      new RenderOrchestrator(createDefaultProviderRegistry(), new RenderDecisionEngine())
    );
  }
  return globalThis.__movieWorkspaceRenderJobManager;
}

/**
 * Shared across every movie this process handles, not reset per request —
 * this is what makes CharacterLibrary.listReused()/LocationLibrary's
 * cross-movie tracking (services/ai/asset-intelligence/) mean anything: a
 * character registered while cataloging one movie is still known when a
 * second movie is cataloged later in the same process.
 */
export function getSharedAssetManager(): AssetManager {
  if (!globalThis.__movieWorkspaceAssetManager) {
    globalThis.__movieWorkspaceAssetManager = new AssetManager();
  }
  return globalThis.__movieWorkspaceAssetManager;
}

/**
 * Builds a real ReferencePromptPlan from a ProductionContext's already-
 * generated UploadedReferenceAsset[] (Stage 2 output) — reusing exactly
 * the prompt text ReferenceImageGenerator/ImagenService already produced
 * for this movie, rather than re-deriving anything.
 */
function buildReferencePromptPlan(movieId: string, uploadedAssets: UploadedReferenceAsset[] = []): ReferencePromptPlan {
  return {
    movieId,
    prompts: uploadedAssets.map((asset) => ({ characterId: asset.characterId, prompt: asset.prompt })),
  };
}

/**
 * Minimal StoryBlueprint reconstruction from a MovieBlueprint's assembled
 * Movie — DirectorEngine.assembleMovie() (services/ai/director/DirectorEngine.ts)
 * folds the original StoryBlueprint into Movie without keeping every field
 * (theme/targetAudience/conflict/endingStyle don't survive), so this
 * recovers only what StoryPlanner.ts (services/ai/director-engine/) actually
 * reads: title, estimatedSceneCount (from Movie.scenes.length),
 * estimatedDuration (from Movie.estimatedDurationSeconds), emotionalArc,
 * and visualStyle. Not a duplicate of StoryAnalyzer's real LLM-backed
 * blueprint — a narrower reconstruction sufficient for the workspace UI's
 * read-only planning views.
 */
function reconstructStoryBlueprint(movie: MovieBlueprint): StoryBlueprint {
  return {
    title: movie.movie.title,
    genre: movie.movie.genres,
    theme: movie.movie.synopsis,
    targetAudience: "general",
    estimatedDuration: movie.movie.estimatedDurationSeconds ?? movie.scenes.length * 8,
    estimatedSceneCount: movie.scenes.length,
    conflict: movie.movie.logline,
    endingStyle: "resolved",
    emotionalArc: movie.emotionPlans.map((plan) => plan.dominantEmotion),
    visualStyle: movie.movie.musicStyle,
  };
}

type DirectorPlanResult = { plan: AIDirectorPlan; story: StoryBlueprint; referencePromptPlan: ReferencePromptPlan };

/**
 * Per-context, per-profile cache for buildDirectorPlan() — several callers
 * across CharacterStudioFactory/SceneStudioFactory/MovieProducerFactory
 * were independently rebuilding the identical plan (same context, same
 * profile) multiple times in a single request. Keyed by the ProductionContext
 * object itself (a WeakMap, so it never needs manual invalidation/cleanup):
 * ProductionContextRepository.save() always stores a new context object, so
 * a stale context is simply never in the map — this can never serve a plan
 * built from an outdated movieBlueprint.
 */
const directorPlanCache = new WeakMap<ProductionContext, Map<string, DirectorPlanResult>>();

/**
 * Runs the real, untouched AIDirectorEngine.plan() (services/ai/director-engine/)
 * against a completed production's real MovieBlueprint — the first live
 * caller of that engine anywhere in the app; every prior sprint verified
 * it only via throwaway scripts. Returns undefined when the production
 * hasn't reached Story Planning yet (no movieBlueprint to plan from).
 */
export function buildDirectorPlan(
  context: ProductionContext,
  profile: DirectorProfile = DIRECTOR_PROFILE_PRESETS.CINEMATIC_DRAMA
): DirectorPlanResult | undefined {
  if (!context.movieBlueprint) return undefined;

  const cacheForContext = directorPlanCache.get(context);
  const cached = cacheForContext?.get(profile.id);
  if (cached) return cached;

  const story = reconstructStoryBlueprint(context.movieBlueprint);
  const referencePromptPlan = buildReferencePromptPlan(context.movieBlueprint.movie.id, context.uploadedReferenceAssets);

  const engine = new AIDirectorEngine();
  const plan = engine.plan(story, context.movieBlueprint, referencePromptPlan, profile);

  const result: DirectorPlanResult = { plan, story, referencePromptPlan };
  const map = cacheForContext ?? new Map<string, DirectorPlanResult>();
  map.set(profile.id, result);
  directorPlanCache.set(context, map);

  return result;
}
