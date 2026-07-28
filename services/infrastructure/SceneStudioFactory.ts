/**
 * SceneStudioFactory.ts
 *
 * Composition root for Scene Studio, following the exact same pattern as
 * MovieWorkspaceFactory.ts / MovieProducerFactory.ts / CharacterStudioFactory.ts:
 * pure read-composition over already-existing, already-public services. No
 * new business logic, no new Scene Planner, Timeline Builder, Prompt
 * Composer, or AssetManager — every field either comes straight off a
 * real MovieBlueprint/AIDirectorPlan/AssetCatalog/MovieProductionPlan, or
 * is explicitly marked undefined so callers can render "Not planned yet"
 * rather than fabricate a value.
 *
 * There is no cross-movie "Scene Library" (unlike CharacterLibrary/
 * LocationLibrary — no such concept exists for scenes anywhere in this
 * codebase, and this file does not invent one). Scene Studio's routes
 * address a scene by sceneId alone, with no movieId in the URL, so
 * "which movies to search" comes from MovieCatalogService (Sprint 16,
 * Task 3) — listOwnedMovieIds(userId), scoped to the requesting user —
 * rather than the CharacterLibrary/LocationLibrary movieIds bridge this
 * file used before. That bridge was also silently broken: those
 * libraries key movieIds by DirectorEngine's title-slug Movie.id, a
 * different id space from ProductionContextRepository's productionId key
 * (see CharacterStudioFactory.ts's buildCanonicalMovieIdIndex for the
 * same bug fixed there) — so ProductionContextRepository.get(movieId)
 * here never matched anything for a slug id. MovieCatalogService reads
 * productionId directly, so no translation layer is needed.
 *
 * No AI model calls, no rendering triggered anywhere in this file.
 */

import { getSharedProductionContextRepository } from "./MovieProductionFactory";
import { getSharedAssetManager, getSharedRenderJobManager, buildDirectorPlan } from "./MovieWorkspaceFactory";
import { listOwnedMovieIds } from "./MovieCatalogService";
import { buildMovieProductionPlan } from "./MovieProducerFactory";
import { DIRECTOR_PROFILE_PRESETS } from "../ai/director-engine/AIDirectorEngine";
import type { AIDirectorPlan } from "../ai/director-engine/AIDirectorEngine";
import { LocationPlanner } from "../ai/movie-producer/LocationPlanner";
import type { MovieProductionPlan } from "../ai/movie-producer/MovieProducer";
import type { AssetCatalog } from "../ai/asset-intelligence/AssetManager";
import type { ContinuityIssue } from "../ai/director-engine/SceneContinuityEngine";
import type { QualityIssue } from "../ai/movie-producer/QualityAnalyzer";
import type { SceneGenerationRequest } from "../ai/production/ScenePromptBuilder";
import type { RenderJobStatus } from "../rendering/types/RenderJob";
import type { ProviderId } from "../rendering/interfaces/RenderProvider";
import type {
  Scene,
  CameraPlan,
  EmotionPlan,
  Environment,
  Character,
  EntityId,
  DialogueLine,
  SoundEffectCue,
  CharacterEmotionState,
} from "../ai/director/OutputSchema";
import type { MovieBlueprint } from "../ai/director/DirectorEngine";

const locationPlanner = new LocationPlanner();

// ── Shared internal resolution ──────────────────────────────────────────

interface SceneContext {
  movieId: string;
  movieTitle: string;
  movie: MovieBlueprint;
  scene: Scene;
  cameraPlan?: CameraPlan;
  emotionPlan?: EmotionPlan;
  environment?: Environment;
  directorPlan: AIDirectorPlan;
  assetCatalog: AssetCatalog;
  productionPlan?: MovieProductionPlan;
  previousScene?: Scene;
  nextScene?: Scene;
  sceneGenerationRequest?: SceneGenerationRequest;
}

function resolveMovieBlueprint(movieId: string): MovieBlueprint | undefined {
  return getSharedProductionContextRepository().get(movieId)?.movieBlueprint;
}

/** Searches every movie in userId's catalog for a scene with this id — there is no global scene index, so this is a real (small) linear search, not a fabricated lookup. */
function resolveSceneContext(sceneId: EntityId, userId: string): SceneContext | undefined {
  for (const movieId of listOwnedMovieIds(userId)) {
    const context = getSharedProductionContextRepository().get(movieId);
    const movie = context?.movieBlueprint;
    if (!context || !movie) continue;

    const scene = movie.scenes.find((s) => s.id === sceneId);
    if (!scene) continue;

    const directorPlan = buildDirectorPlan(context, DIRECTOR_PROFILE_PRESETS.CINEMATIC_DRAMA);
    if (!directorPlan) return undefined;

    const assetCatalog = getSharedAssetManager().catalog(movie, directorPlan.plan);
    const productionPlan = buildMovieProductionPlan(context, DIRECTOR_PROFILE_PRESETS.CINEMATIC_DRAMA);

    const sortedScenes = [...movie.scenes].sort((a, b) => a.sceneNumber - b.sceneNumber);
    const sceneIndex = sortedScenes.findIndex((s) => s.id === scene.id);

    const sceneGenerationRequest =
      context.sceneGenerationRequests?.find((request) => request.sceneId === scene.id) ??
      directorPlan.plan.prompts.requests.find((request) => request.sceneId === scene.id || request.sceneNumber === scene.sceneNumber);

    return {
      movieId,
      movieTitle: movie.movie.title,
      movie,
      scene,
      cameraPlan: movie.cameraPlans.find((c) => c.id === scene.cameraPlanId),
      emotionPlan: movie.emotionPlans.find((e) => e.id === scene.emotionPlanId),
      environment: movie.environments.find((e) => e.id === scene.environmentId),
      directorPlan: directorPlan.plan,
      assetCatalog,
      productionPlan,
      previousScene: sceneIndex > 0 ? sortedScenes[sceneIndex - 1] : undefined,
      nextScene: sceneIndex >= 0 && sceneIndex < sortedScenes.length - 1 ? sortedScenes[sceneIndex + 1] : undefined,
      sceneGenerationRequest,
    };
  }
  return undefined;
}

function characterNamesFor(movie: MovieBlueprint, characterIds: readonly EntityId[]): string[] {
  return characterIds.map((id) => movie.characters.find((c) => c.id === id)?.name ?? id);
}

function statusFor(movieId: string, sceneId: string): RenderJobStatus | "DRAFTED" {
  const job = getSharedRenderJobManager()
    .list()
    .find((j) => j.projectId === movieId && j.sceneId === sceneId);
  return job?.status ?? "DRAFTED";
}

// ── Module 1 — Scene Browser ────────────────────────────────────────────

export interface SceneBrowserSummary {
  sceneId: EntityId;
  movieId: string;
  movieTitle: string;
  sceneNumber: number;
  title?: string;
  durationSeconds: number;
  cameraAngle?: string;
  shotType?: string;
  mood?: string;
  characterNames: string[];
  locationName: string;
  renderStatus: RenderJobStatus | "DRAFTED";
}

/** Every scene across every movie in userId's catalog — real MovieBlueprint.scenes, not a second scene index. */
export function listSceneSummaries(userId: string): SceneBrowserSummary[] {
  const summaries: SceneBrowserSummary[] = [];

  for (const movieId of listOwnedMovieIds(userId)) {
    const movie = resolveMovieBlueprint(movieId);
    if (!movie) continue;

    const cameraPlanById = new Map(movie.cameraPlans.map((c) => [c.id, c]));
    const emotionPlanById = new Map(movie.emotionPlans.map((e) => [e.id, e]));
    const environmentById = new Map(movie.environments.map((e) => [e.id, e]));

    for (const scene of movie.scenes) {
      const cameraPlan = cameraPlanById.get(scene.cameraPlanId);
      const emotionPlan = emotionPlanById.get(scene.emotionPlanId);
      const environment = environmentById.get(scene.environmentId);

      summaries.push({
        sceneId: scene.id,
        movieId,
        movieTitle: movie.movie.title,
        sceneNumber: scene.sceneNumber,
        title: scene.title,
        durationSeconds: scene.durationSeconds ?? cameraPlan?.durationSeconds ?? 8,
        cameraAngle: cameraPlan ? `${cameraPlan.angle}°` : undefined,
        shotType: cameraPlan?.shot,
        mood: emotionPlan?.dominantEmotion,
        characterNames: characterNamesFor(movie, scene.characterIds),
        locationName: environment?.name ?? scene.environmentId,
        renderStatus: statusFor(movieId, scene.id),
      });
    }
  }

  return summaries.sort((a, b) => a.movieTitle.localeCompare(b.movieTitle) || a.sceneNumber - b.sceneNumber);
}

// ── Module 2 — Scene Detail ─────────────────────────────────────────────

export interface SceneOverview {
  movieId: string;
  movieTitle: string;
  scene: Scene;
  directorNotes?: string;
  storyPurpose?: string;
  sceneImportance?: string;
  promptSummary?: string;
  transitionInName?: string;
  transitionOutName?: string;
}

export function getSceneOverview(sceneId: EntityId, userId: string): SceneOverview | undefined {
  const ctx = resolveSceneContext(sceneId, userId);
  if (!ctx) return undefined;

  const act = ctx.directorPlan.storyPlan.acts.find(
    (a) => ctx.scene.sceneNumber >= a.sceneNumberRange.start && ctx.scene.sceneNumber <= a.sceneNumberRange.end
  );
  const transitionLibrary = getSharedAssetManager().getTransitionLibrary();
  const previousCameraPlan = ctx.previousScene ? ctx.movie.cameraPlans.find((c) => c.id === ctx.previousScene!.cameraPlanId) : undefined;

  return {
    movieId: ctx.movieId,
    movieTitle: ctx.movieTitle,
    scene: ctx.scene,
    directorNotes: ctx.cameraPlan?.cinematicPurpose,
    storyPurpose: act ? `Act ${act.actNumber} — ${act.name}: ${act.purpose}` : undefined,
    // No scene-importance field exists on Scene anywhere in OutputSchema.ts — left undefined intentionally rather than derived from an unrelated field (e.g. EmotionPlan.intensity measures emotional intensity, not narrative importance).
    sceneImportance: undefined,
    promptSummary: ctx.sceneGenerationRequest?.positivePrompt,
    // "Transition in" is the previous scene's own CameraPlan.transitionToNext (the transition it declared into this scene) — undefined, not guessed, when that camera plan can't be resolved.
    transitionInName: previousCameraPlan ? transitionLibrary.get(previousCameraPlan.transitionToNext).name : undefined,
    transitionOutName: ctx.cameraPlan ? transitionLibrary.get(ctx.cameraPlan.transitionToNext).name : undefined,
  };
}

// ── Module 3 — Camera Inspector ─────────────────────────────────────────

export interface CameraInspectorData {
  cameraPlan?: CameraPlan;
  shotPresetName?: string;
  cinematicStyleModifiers: string[];
}

/** Reuses DirectorPromptPipeline's real enrichment input — DirectorProfile.promptStyleModifiers, the exact style data DirectorPromptPipeline appends to this scene's composed prompt — as "Cinematic Style," rather than inventing a scene-level style field that doesn't exist. */
export function getCameraInspector(sceneId: EntityId, userId: string): CameraInspectorData | undefined {
  const ctx = resolveSceneContext(sceneId, userId);
  if (!ctx) return undefined;

  const shotPreset = ctx.cameraPlan ? getSharedAssetManager().getShotLibrary().matchCameraPlan(ctx.cameraPlan) : undefined;

  return {
    cameraPlan: ctx.cameraPlan,
    shotPresetName: shotPreset?.name,
    cinematicStyleModifiers: DIRECTOR_PROFILE_PRESETS.CINEMATIC_DRAMA.promptStyleModifiers,
  };
}

// ── Module 4 — Lighting Inspector ───────────────────────────────────────

export interface LightingInspectorData {
  environment?: Environment;
  mood?: string;
}

export function getLightingInspector(sceneId: EntityId, userId: string): LightingInspectorData | undefined {
  const ctx = resolveSceneContext(sceneId, userId);
  if (!ctx) return undefined;

  return {
    environment: ctx.environment,
    mood: ctx.emotionPlan?.dominantEmotion,
  };
}

// ── Module 5 — Character Placement ──────────────────────────────────────

export interface CharacterPlacementEntry {
  characterId: EntityId;
  name: string;
  speakingOrder?: number;
  emotionalState?: CharacterEmotionState;
}

export interface CharacterPlacementData {
  characters: CharacterPlacementEntry[];
  dialogue?: DialogueLine[];
}

/** Speaking order is read directly from Scene.dialogue's real array order (already-authored screenplay data) - not derived or guessed. Emotional state is EmotionPlan.characterStates, already computed by the Director pipeline. "Screen presence" has no backing field anywhere and is intentionally omitted rather than approximated from dialogue line count. */
export function getCharacterPlacement(sceneId: EntityId, userId: string): CharacterPlacementData | undefined {
  const ctx = resolveSceneContext(sceneId, userId);
  if (!ctx) return undefined;

  const speakingOrderByCharacterId = new Map<EntityId, number>();
  (ctx.scene.dialogue ?? []).forEach((line, index) => {
    if (!speakingOrderByCharacterId.has(line.characterId)) {
      speakingOrderByCharacterId.set(line.characterId, index + 1);
    }
  });

  const characters = ctx.scene.characterIds.map((characterId): CharacterPlacementEntry => {
    const character = ctx.movie.characters.find((c) => c.id === characterId);
    return {
      characterId,
      name: character?.name ?? characterId,
      speakingOrder: speakingOrderByCharacterId.get(characterId),
      emotionalState: ctx.emotionPlan?.characterStates.find((state) => state.characterId === characterId),
    };
  });

  return { characters, dialogue: ctx.scene.dialogue };
}

// ── Module 6 — Location Inspector ───────────────────────────────────────

export interface LocationInspectorData {
  environment?: Environment;
  relatedScenes: { sceneId: EntityId; sceneNumber: number; title?: string }[];
  isReusedFromPriorMovie: boolean;
}

/** Reuses LocationPlanner (services/ai/movie-producer/LocationPlanner.ts, Sprint 10) for the reuse signal - itself a thin composition over LocationLibrary, not a second reuse check. */
export function getLocationInspector(sceneId: EntityId, userId: string): LocationInspectorData | undefined {
  const ctx = resolveSceneContext(sceneId, userId);
  if (!ctx) return undefined;

  const locationPlan = locationPlanner.plan(ctx.movie, ctx.assetCatalog.locations);
  const planned = locationPlan.locations.find((location) => location.environmentId === ctx.scene.environmentId);

  const relatedScenes = ctx.movie.scenes
    .filter((s) => s.environmentId === ctx.scene.environmentId && s.id !== ctx.scene.id)
    .sort((a, b) => a.sceneNumber - b.sceneNumber)
    .map((s) => ({ sceneId: s.id, sceneNumber: s.sceneNumber, title: s.title }));

  return {
    environment: ctx.environment,
    relatedScenes,
    isReusedFromPriorMovie: planned?.isReusedFromPriorMovie ?? false,
  };
}

// ── Module 7 — Asset Inspector ──────────────────────────────────────────

export interface AssetInspectorData {
  characterReferenceImages: { characterName: string; url?: string; angle?: string }[];
  environmentReferenceImages: { url?: string; angle?: string }[];
  videoUrl?: string;
  musicCue?: AssetCatalog["musicPlan"]["cues"][number];
  voiceAssignments: { characterName: string; voiceName?: string }[];
  soundEffects: SoundEffectCue[];
}

export function getAssetInspector(sceneId: EntityId, userId: string): AssetInspectorData | undefined {
  const ctx = resolveSceneContext(sceneId, userId);
  if (!ctx) return undefined;

  const characters: Character[] = ctx.scene.characterIds
    .map((id) => ctx.movie.characters.find((c) => c.id === id))
    .filter((c): c is Character => c !== undefined);

  const characterReferenceImages = characters.flatMap((character) =>
    character.referenceImages.map((image) => ({ characterName: character.name, url: image.url, angle: image.angle }))
  );
  const environmentReferenceImages = (ctx.environment?.referenceImages ?? []).map((image) => ({ url: image.url, angle: image.angle }));

  const job = getSharedRenderJobManager()
    .list()
    .find((j) => j.projectId === ctx.movieId && j.sceneId === sceneId);

  const musicCue = ctx.assetCatalog.musicPlan.cues.find((cue) => cue.sceneId === sceneId);

  const voiceAssignments = characters.map((character) => ({
    characterName: character.name,
    voiceName: character.voiceProfile.voiceName,
  }));

  return {
    characterReferenceImages,
    environmentReferenceImages,
    videoUrl: job?.result?.videoUrl,
    musicCue,
    voiceAssignments,
    soundEffects: ctx.scene.soundEffects ?? [],
  };
}

// ── Module 8 — Production Preview ───────────────────────────────────────

export interface ProductionPreviewData {
  recommendedProvider?: ProviderId;
  estimatedCredits?: number;
  estimatedRenderTimeSeconds?: number;
  qualityScore?: number;
  continuityIssues: (ContinuityIssue | QualityIssue)[];
}

/** Reuses MovieProducer's already-computed MovieProductionPlan (via MovieProducerFactory.buildMovieProductionPlan(), Sprint 10) - schedule/quality are read off it, never recomputed. No render job is submitted; recommendedProvider is ProductionPlanner's own read-only ProviderSelector.select() preview. */
export function getProductionPreview(sceneId: EntityId, userId: string): ProductionPreviewData | undefined {
  const ctx = resolveSceneContext(sceneId, userId);
  if (!ctx) return undefined;

  const scheduledUnit = ctx.productionPlan?.schedule.units.find((unit) => unit.assetType === "SCENE" && unit.assetId === sceneId);
  const sceneQualityIssues = ctx.productionPlan?.quality.issues.filter((issue) => issue.sceneNumber === ctx.scene.sceneNumber) ?? [];

  return {
    recommendedProvider: scheduledUnit?.recommendedProvider,
    // Scene.estimatedRenderCost/estimatedRenderTime exist on the type but nothing in the pipeline populates them - CostOptimizer.estimateCost() throws "not implemented yet." Left undefined rather than guessed.
    estimatedCredits: ctx.scene.estimatedRenderCost,
    estimatedRenderTimeSeconds: ctx.scene.estimatedRenderTime,
    qualityScore: ctx.productionPlan?.quality.score,
    continuityIssues: sceneQualityIssues,
  };
}

// ── Module 9 — Prompt Viewer ─────────────────────────────────────────────

export interface PromptViewerData {
  positivePrompt?: string;
  negativePrompt?: string;
  aspectRatio?: string;
  quality?: string;
  expectedDuration?: number;
}

/** Reuses DirectorPromptPipeline's real, already-composed SceneGenerationRequest - never recomposes a prompt. */
export function getPromptViewer(sceneId: EntityId, userId: string): PromptViewerData | undefined {
  const ctx = resolveSceneContext(sceneId, userId);
  if (!ctx) return undefined;

  return {
    positivePrompt: ctx.sceneGenerationRequest?.positivePrompt,
    negativePrompt: ctx.sceneGenerationRequest?.negativePrompt,
    aspectRatio: ctx.sceneGenerationRequest?.aspectRatio,
    quality: ctx.sceneGenerationRequest?.quality,
    expectedDuration: ctx.sceneGenerationRequest?.expectedDuration,
  };
}

// ── Module 10 — Scene Navigation ────────────────────────────────────────

export interface SceneNavigationData {
  movieId: string;
  previousSceneId?: EntityId;
  nextSceneId?: EntityId;
  characterLinks: { characterId: EntityId; name: string }[];
}

export function getSceneNavigation(sceneId: EntityId, userId: string): SceneNavigationData | undefined {
  const ctx = resolveSceneContext(sceneId, userId);
  if (!ctx) return undefined;

  return {
    movieId: ctx.movieId,
    previousSceneId: ctx.previousScene?.id,
    nextSceneId: ctx.nextScene?.id,
    characterLinks: ctx.scene.characterIds.map((id) => ({
      characterId: id,
      name: ctx.movie.characters.find((c) => c.id === id)?.name ?? id,
    })),
  };
}
