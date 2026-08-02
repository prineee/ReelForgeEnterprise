/**
 * CharacterStudioFactory.ts
 *
 * Composition root for the Character Studio UI, mirroring
 * MovieWorkspaceFactory.ts's and MovieProducerFactory.ts's role: pure
 * read-composition over already-existing, already-public services. No new
 * business logic, no new persistence, no new shared singleton state.
 *
 * "Which movies exist" now comes from MovieCatalogService (Sprint 16,
 * Task 3) — the one canonical enumeration shared with Scene Studio,
 * Render Center, and Movie Library, scoped to the requesting userId.
 *
 * CharacterLibrary (getSharedAssetManager().getCharacterLibrary()) is
 * still the source for cross-movie character identity/reuse detection
 * (CharacterMemory's consistency matching, not reimplemented here) — that
 * part is unchanged, real business logic this file doesn't redesign.
 * What changed: CharacterLibraryEntry.movieIds is keyed by DirectorEngine's
 * own title-slug Movie.id (CharacterLibrary.register(movie) reads
 * movie.movie.id), a different id space from ProductionContextRepository's
 * key (productionId — the id used everywhere else as "movieId": Workspace/
 * Render Center URLs, RenderJob.projectId, and now MovieCatalogService).
 * Resolving a CharacterLibraryEntry's movieIds directly against
 * ProductionContextRepository.get() therefore never matched anything.
 * buildCanonicalMovieIdIndex() below translates slug id -> canonical
 * movieId using the catalog, so this file can keep using CharacterLibrary
 * for identity while actually resolving each movie correctly.
 *
 * No AI model calls, no rendering triggered anywhere in this file.
 */

import { getSharedProductionContextRepository } from "./MovieProductionFactory";
import { getSharedAssetManager, buildDirectorPlan } from "./MovieWorkspaceFactory";
import { listMovieCatalog } from "./MovieCatalogService";
import { DIRECTOR_PROFILE_PRESETS } from "../ai/director-engine/AIDirectorEngine";
import { CharacterGenerator, type CastRole } from "../ai/movie-producer/CharacterGenerator";
import { VoicePlanner, type VoicePlanIssue } from "../ai/asset-intelligence/VoicePlanner";
import type { AssetNode, AssetNodeType } from "../ai/asset-intelligence/AssetDependencyGraph";
import type { ContinuityIssue } from "../ai/director-engine/SceneContinuityEngine";
import type { PlannedTimelineEntry } from "../ai/director-engine/MovieTimelineBuilder";
import type { Character, EntityId, CameraShot } from "../ai/director/OutputSchema";
import type { MovieBlueprint } from "../ai/director/DirectorEngine";
import type { CharacterLibraryEntry } from "../ai/asset-intelligence/CharacterLibrary";
import type { ProductionContext } from "./ProductionContextRepository";

const characterGenerator = new CharacterGenerator();
const voicePlanner = new VoicePlanner();

export interface CharacterSummary {
  characterId: EntityId;
  name: string;
  role?: CastRole;
  gender?: string;
  age?: number;
  voiceName?: string;
  movieCount: number;
  primaryMovieId: string;
  primaryMovieTitle: string;
  hasContinuityIssue: boolean;
}

export interface CharacterProfile {
  character: Character;
  libraryEntry: CharacterLibraryEntry;
  primaryMovieId: string;
  primaryMovieTitle: string;
  role?: CastRole;
  /** Most frequent CameraPlan.shot across scenes where this character is the camera's focus subject (CameraPlan.focusSubject.characterId) — a derived aggregate, not a stored preference. Undefined when the character is never the focus subject of any planned shot. */
  favoriteCameraShot?: CameraShot;
}

export interface MovieUsageEntry {
  movieId: string;
  movieTitle: string;
  sceneCount: number;
  firstAppearanceSceneNumber?: number;
  lastAppearanceSceneNumber?: number;
}

export interface CharacterAppearanceEntry {
  sceneId: string;
  sceneNumber: number;
  sceneTitle?: string;
}

export interface CharacterContinuitySummary {
  movieId: string;
  movieTitle: string;
  appearances: CharacterAppearanceEntry[];
  issues: ContinuityIssue[];
}

export interface CharacterVoiceProfile {
  character: Character;
  assignedVoiceProfileId?: string;
  issues: VoicePlanIssue[];
}

export interface CharacterTimelineResult {
  movieId: string;
  movieTitle: string;
  entries: (PlannedTimelineEntry & { sceneTitle?: string })[];
  totalPlannedDurationSeconds: number;
}

export interface RelationshipMovieRef {
  movieId: string;
  movieTitle: string;
  isPrimary: boolean;
}

export interface RelationshipSceneNode {
  sceneId: string;
  label: string;
  environmentId?: string;
  locationLabel?: string;
  locationAssetLabels: string[];
}

export interface CharacterRelationships {
  characterId: string;
  characterName: string;
  movies: RelationshipMovieRef[];
  ownAssetLabels: string[];
  scenes: RelationshipSceneNode[];
}

function resolveMovieBlueprint(movieId: string): MovieBlueprint | undefined {
  return getSharedProductionContextRepository().get(movieId)?.movieBlueprint;
}

/** Maps DirectorEngine's title-slug Movie.id -> canonical movieId (productionId), scoped to userId's catalog — see file header. */
function buildCanonicalMovieIdIndex(userId: string): Map<string, string> {
  const repository = getSharedProductionContextRepository();
  const index = new Map<string, string>();
  for (const entry of listMovieCatalog(userId)) {
    const slugId = repository.get(entry.movieId)?.movieBlueprint?.movie.id;
    if (slugId) index.set(slugId, entry.movieId);
  }
  return index;
}

/** entry.movieIds translated into canonical movieIds, filtered to ones that resolved (i.e. belong to this user's catalog). */
function canonicalMovieIds(entry: CharacterLibraryEntry, index: Map<string, string>): string[] {
  return entry.movieIds.map((slugId) => index.get(slugId)).filter((id): id is string => Boolean(id));
}

function primaryMovieId(entry: CharacterLibraryEntry, index: Map<string, string>): string | undefined {
  const ids = canonicalMovieIds(entry, index);
  return ids[ids.length - 1];
}

function roleFor(character: Character, movie: MovieBlueprint, characterLibraryEntries: readonly CharacterLibraryEntry[], castPlanCache?: Map<string, ReturnType<CharacterGenerator["plan"]>>): CastRole | undefined {
  let castPlan = castPlanCache?.get(movie.movie.id);
  if (!castPlan) {
    castPlan = characterGenerator.plan(movie, characterLibraryEntries);
    castPlanCache?.set(movie.movie.id, castPlan);
  }
  return castPlan.cast.find((member) => member.characterId === character.id)?.role;
}

function favoriteCameraShotFor(characterId: EntityId, movie: MovieBlueprint): CameraShot | undefined {
  const counts = new Map<CameraShot, number>();
  for (const cameraPlan of movie.cameraPlans) {
    if (cameraPlan.focusSubject.characterId !== characterId) continue;
    counts.set(cameraPlan.shot, (counts.get(cameraPlan.shot) ?? 0) + 1);
  }
  let best: CameraShot | undefined;
  let bestCount = 0;
  for (const [shot, count] of counts) {
    if (count > bestCount) {
      best = shot;
      bestCount = count;
    }
  }
  return best;
}

/** Module 1 — every character resident in the shared CharacterLibrary whose most recently registered movie belongs to userId's canonical catalog. */
export function listCharacterSummaries(userId: string): CharacterSummary[] {
  const characterLibrary = getSharedAssetManager().getCharacterLibrary();
  const entries = characterLibrary.list();
  const castPlanCache = new Map<string, ReturnType<CharacterGenerator["plan"]>>();
  const index = buildCanonicalMovieIdIndex(userId);

  return entries
    .map((entry): CharacterSummary | undefined => {
      const movieId = primaryMovieId(entry, index);
      if (!movieId) return undefined;
      const movie = resolveMovieBlueprint(movieId);
      const character = movie?.characters.find((c) => c.id === entry.characterId);
      if (!movie || !character) return undefined;

      const directorPlan = buildDirectorPlan(getSharedProductionContextRepository().get(movieId)!, DIRECTOR_PROFILE_PRESETS.CINEMATIC_DRAMA);
      const hasContinuityIssue = Boolean(
        directorPlan?.plan.continuity.issues.some(
          (issue) => issue.type === "CHARACTER_GAP" && issue.message.includes(`"${character.name}"`)
        )
      );

      return {
        characterId: character.id,
        name: character.name,
        role: roleFor(character, movie, entries, castPlanCache),
        gender: character.appearance.gender,
        age: character.appearance.age,
        voiceName: character.voiceProfile.voiceName,
        movieCount: canonicalMovieIds(entry, index).length,
        primaryMovieId: movieId,
        primaryMovieTitle: movie.movie.title,
        hasContinuityIssue,
      };
    })
    .filter((summary): summary is CharacterSummary => summary !== undefined);
}

/** Module 2 — full Character resolved via the movie it was most recently registered under. */
export function resolveCharacterProfile(characterId: EntityId, userId: string): CharacterProfile | undefined {
  const characterLibrary = getSharedAssetManager().getCharacterLibrary();
  const entry = characterLibrary.get(characterId);
  if (!entry) return undefined;

  const movieId = primaryMovieId(entry, buildCanonicalMovieIdIndex(userId));
  if (!movieId) return undefined;
  const movie = resolveMovieBlueprint(movieId);
  const character = movie?.characters.find((c) => c.id === characterId);
  if (!movie || !character) return undefined;

  return {
    character,
    libraryEntry: entry,
    primaryMovieId: movieId,
    primaryMovieTitle: movie.movie.title,
    role: roleFor(character, movie, characterLibrary.list()),
    favoriteCameraShot: favoriteCameraShotFor(characterId, movie),
  };
}

/** Module 3 — every movie (in userId's catalog) using this character, via CharacterLibraryEntry.movieIds (the library's own cross-movie relationship, not recomputed) translated to canonical movieIds. */
export function getCharacterMovieUsage(characterId: EntityId, userId: string): MovieUsageEntry[] {
  const entry = getSharedAssetManager().getCharacterLibrary().get(characterId);
  if (!entry) return [];

  return canonicalMovieIds(entry, buildCanonicalMovieIdIndex(userId))
    .map((movieId): MovieUsageEntry | undefined => {
      const movie = resolveMovieBlueprint(movieId);
      if (!movie) return undefined;
      const scenes = movie.scenes.filter((scene) => scene.characterIds.includes(characterId)).sort((a, b) => a.sceneNumber - b.sceneNumber);

      return {
        movieId,
        movieTitle: movie.movie.title,
        sceneCount: scenes.length,
        firstAppearanceSceneNumber: scenes[0]?.sceneNumber,
        lastAppearanceSceneNumber: scenes[scenes.length - 1]?.sceneNumber,
      };
    })
    .filter((usage): usage is MovieUsageEntry => usage !== undefined);
}

/**
 * Module 4 — real per-scene appearances read directly from Scene.characterIds
 * (CharacterMemory's own appearance log is only ever populated on
 * AIDirectorEngine's private internal instance, never on the
 * AssetManager-owned one this file has access to — confirmed empty in
 * every wired code path, so it is not used here) plus CHARACTER_GAP issues
 * from the real AIDirectorPlan.continuity (SceneContinuityEngine, reused
 * via buildDirectorPlan(), not recomputed).
 */
export function getCharacterContinuity(characterId: EntityId, userId: string, movieId?: string): CharacterContinuitySummary | undefined {
  const entry = getSharedAssetManager().getCharacterLibrary().get(characterId);
  if (!entry) return undefined;
  const resolvedMovieId = movieId ?? primaryMovieId(entry, buildCanonicalMovieIdIndex(userId));
  if (!resolvedMovieId) return undefined;

  const context = getSharedProductionContextRepository().get(resolvedMovieId);
  const movie = context?.movieBlueprint;
  const character = movie?.characters.find((c) => c.id === characterId);
  if (!context || !movie || !character) return undefined;

  const appearances = movie.scenes
    .filter((scene) => scene.characterIds.includes(characterId))
    .sort((a, b) => a.sceneNumber - b.sceneNumber)
    .map((scene): CharacterAppearanceEntry => ({ sceneId: scene.id, sceneNumber: scene.sceneNumber, sceneTitle: scene.title }));

  const directorPlan = buildDirectorPlan(context, DIRECTOR_PROFILE_PRESETS.CINEMATIC_DRAMA);
  const issues = (directorPlan?.plan.continuity.issues ?? []).filter(
    (issue) => issue.type === "CHARACTER_GAP" && issue.message.includes(`"${character.name}"`)
  );

  return { movieId: resolvedMovieId, movieTitle: movie.movie.title, appearances, issues };
}

/** Module 6 — reads VoicePlanner's real assignment + issues for this character. VoicePlan only carries the id mapping; the full VoiceProfile lives on Character itself (the same object the id points to). */
export function getCharacterVoiceProfile(characterId: EntityId, userId: string, movieId?: string): CharacterVoiceProfile | undefined {
  const entry = getSharedAssetManager().getCharacterLibrary().get(characterId);
  if (!entry) return undefined;
  const resolvedMovieId = movieId ?? primaryMovieId(entry, buildCanonicalMovieIdIndex(userId));
  if (!resolvedMovieId) return undefined;

  const movie = resolveMovieBlueprint(resolvedMovieId);
  const character = movie?.characters.find((c) => c.id === characterId);
  if (!movie || !character) return undefined;

  const voicePlan = voicePlanner.plan(movie);

  return {
    character,
    assignedVoiceProfileId: voicePlan.assignmentsByCharacter[characterId],
    issues: voicePlan.issues.filter((issue) => issue.characterId === characterId),
  };
}

/** Module 7 — filters MovieTimelineBuilder's real PlannedTimelineEntry[] (via AIDirectorPlan.timeline) to scenes this character appears in. Defaults to the most recently registered movie. */
export function getCharacterTimeline(characterId: EntityId, userId: string, movieId?: string): CharacterTimelineResult | undefined {
  const entry = getSharedAssetManager().getCharacterLibrary().get(characterId);
  if (!entry) return undefined;
  const resolvedMovieId = movieId ?? primaryMovieId(entry, buildCanonicalMovieIdIndex(userId));
  if (!resolvedMovieId) return undefined;

  const context = getSharedProductionContextRepository().get(resolvedMovieId);
  const movie = context?.movieBlueprint;
  if (!context || !movie) return undefined;

  const characterSceneIds = new Set(movie.scenes.filter((scene) => scene.characterIds.includes(characterId)).map((scene) => scene.id));
  const sceneById = new Map(movie.scenes.map((scene) => [scene.id, scene]));

  const directorPlan = buildDirectorPlan(context, DIRECTOR_PROFILE_PRESETS.CINEMATIC_DRAMA);
  if (!directorPlan) return undefined;

  const entries = directorPlan.plan.timeline.entries
    .filter((timelineEntry) => characterSceneIds.has(timelineEntry.sceneId))
    .map((timelineEntry) => ({ ...timelineEntry, sceneTitle: sceneById.get(timelineEntry.sceneId)?.title }));

  return {
    movieId: resolvedMovieId,
    movieTitle: movie.movie.title,
    entries,
    totalPlannedDurationSeconds: directorPlan.plan.timeline.totalPlannedDurationSeconds,
  };
}

/**
 * Module 8 — traverses the real AssetDependencyGraph (via AssetManager.catalog(),
 * not a second graph) for this character: its own direct dependents
 * (reference images + scenes), then for each scene, its Environment and
 * that Environment's own dependents as the "assets" level. Movies come
 * from CharacterLibraryEntry.movieIds, not the graph (Movie isn't a node
 * type in AssetDependencyGraph).
 */
export function getCharacterRelationships(characterId: EntityId, userId: string, movieId?: string): CharacterRelationships | undefined {
  const characterLibrary = getSharedAssetManager().getCharacterLibrary();
  const entry = characterLibrary.get(characterId);
  if (!entry) return undefined;
  const index = buildCanonicalMovieIdIndex(userId);
  const resolvedMovieId = movieId ?? primaryMovieId(entry, index);
  if (!resolvedMovieId) return undefined;

  const context = getSharedProductionContextRepository().get(resolvedMovieId);
  const movie = context?.movieBlueprint;
  const character = movie?.characters.find((c) => c.id === characterId);
  if (!context || !movie || !character) return undefined;

  const directorPlan = buildDirectorPlan(context, DIRECTOR_PROFILE_PRESETS.CINEMATIC_DRAMA);
  if (!directorPlan) return undefined;
  const assetCatalog = getSharedAssetManager().catalog(movie, directorPlan.plan);
  const graph = assetCatalog.dependencyGraph;

  const directDependents = graph.getDependents(characterId);
  const ownAssetLabels = directDependents.filter((node) => node.type === "REFERENCE_IMAGE").map((node) => node.label);
  const sceneNodes = directDependents.filter((node) => node.type === "SCENE");

  const scenes: RelationshipSceneNode[] = sceneNodes.map((sceneNode) => {
    const scene = movie.scenes.find((s) => s.id === sceneNode.id);
    const environmentNode: AssetNode | undefined = scene ? graph.getNode(scene.environmentId) : undefined;
    const locationAssetLabels = scene
      ? graph
          .getDependents(scene.environmentId)
          .filter((node): node is AssetNode & { type: Extract<AssetNodeType, "REFERENCE_IMAGE"> } => node.type === "REFERENCE_IMAGE")
          .map((node) => node.label)
      : [];

    return {
      sceneId: sceneNode.id,
      label: sceneNode.label,
      environmentId: scene?.environmentId,
      locationLabel: environmentNode?.label,
      locationAssetLabels,
    };
  });

  const movies: RelationshipMovieRef[] = canonicalMovieIds(entry, index).map((id) => ({
    movieId: id,
    movieTitle: resolveMovieBlueprint(id)?.movie.title ?? id,
    isPrimary: id === resolvedMovieId,
  }));

  return { characterId, characterName: character.name, movies, ownAssetLabels, scenes };
}
