/**
 * CharacterStudioFactory.ts
 *
 * Composition root for the Character Studio UI, mirroring
 * MovieWorkspaceFactory.ts's and MovieProducerFactory.ts's role: pure
 * read-composition over already-existing, already-public services. No new
 * business logic, no new persistence, no new shared singleton state.
 *
 * The hard constraint this file works within: ProductionContextRepository
 * has no enumeration method (getOrCreate/get/save only, confirmed by
 * inspection) — there is no way to discover "every movie that exists."
 * What IS real and already cross-movie is CharacterLibrary
 * (getSharedAssetManager().getCharacterLibrary()), a shared singleton that
 * accumulates one entry per character every time any movie's workspace
 * page registers it via AssetManager.catalog(). This file treats that
 * accumulated state as the source of truth for "which characters/movies
 * exist" — Character Studio can only ever show characters from movies
 * whose workspace has been visited during this server process's lifetime,
 * same in-memory-now scope every other part of this codebase already
 * documents (ProductionContextRepository's own header, RenderJobManager,
 * etc). This file does not add persistence to fix that — doing so would
 * be a backend redesign, out of scope for this sprint.
 *
 * For each known character, CharacterLibraryEntry.movieIds (already
 * public) is the bridge back to that character's real, full data:
 * ProductionContextRepository.get(movieId) resolves the real
 * MovieBlueprint, from which the full Character (personality,
 * emotionalBaseline, wardrobe, voiceProfile) is read directly — nothing
 * here re-authors or re-derives that data. "Most recently registered
 * movie" (the last id in movieIds) is used as the canonical source for
 * single-movie-scoped fields, the same convention CharacterLibraryEntry
 * itself already uses for `consistencyEntry` ("the most recently
 * registered consistency profile").
 *
 * No AI model calls, no rendering triggered anywhere in this file.
 */

import { getSharedProductionContextRepository } from "./MovieProductionFactory";
import { getSharedAssetManager, buildDirectorPlan } from "./MovieWorkspaceFactory";
import { DIRECTOR_PROFILE_PRESETS } from "../ai/director-engine/AIDirectorEngine";
import { CharacterGenerator, type CastRole } from "../ai/movie-producer/CharacterGenerator";
import { VoicePlanner, type VoicePlanIssue } from "../ai/asset-intelligence/VoicePlanner";
import type { AssetNode, AssetNodeType } from "../ai/asset-intelligence/AssetDependencyGraph";
import type { ContinuityIssue } from "../ai/director-engine/SceneContinuityEngine";
import type { PlannedTimelineEntry } from "../ai/director-engine/MovieTimelineBuilder";
import type { Character, EntityId } from "../ai/director/OutputSchema";
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

function primaryMovieId(entry: CharacterLibraryEntry): string | undefined {
  return entry.movieIds[entry.movieIds.length - 1];
}

function roleFor(character: Character, movie: MovieBlueprint, characterLibraryEntries: readonly CharacterLibraryEntry[]): CastRole | undefined {
  const castPlan = characterGenerator.plan(movie, characterLibraryEntries);
  return castPlan.cast.find((member) => member.characterId === character.id)?.role;
}

/** Module 1 — every character resident in the shared CharacterLibrary, resolved against its most recently registered movie. */
export function listCharacterSummaries(): CharacterSummary[] {
  const characterLibrary = getSharedAssetManager().getCharacterLibrary();
  const entries = characterLibrary.list();

  return entries
    .map((entry): CharacterSummary | undefined => {
      const movieId = primaryMovieId(entry);
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
        role: roleFor(character, movie, entries),
        gender: character.appearance.gender,
        age: character.appearance.age,
        voiceName: character.voiceProfile.voiceName,
        movieCount: entry.movieIds.length,
        primaryMovieId: movieId,
        primaryMovieTitle: movie.movie.title,
        hasContinuityIssue,
      };
    })
    .filter((summary): summary is CharacterSummary => summary !== undefined);
}

/** Module 2 — full Character resolved via the movie it was most recently registered under. */
export function resolveCharacterProfile(characterId: EntityId): CharacterProfile | undefined {
  const characterLibrary = getSharedAssetManager().getCharacterLibrary();
  const entry = characterLibrary.get(characterId);
  if (!entry) return undefined;

  const movieId = primaryMovieId(entry);
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
  };
}

/** Module 3 — every movie using this character, via CharacterLibraryEntry.movieIds (the library's own cross-movie relationship, not recomputed). */
export function getCharacterMovieUsage(characterId: EntityId): MovieUsageEntry[] {
  const entry = getSharedAssetManager().getCharacterLibrary().get(characterId);
  if (!entry) return [];

  return entry.movieIds
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
export function getCharacterContinuity(characterId: EntityId, movieId?: string): CharacterContinuitySummary | undefined {
  const entry = getSharedAssetManager().getCharacterLibrary().get(characterId);
  if (!entry) return undefined;
  const resolvedMovieId = movieId ?? primaryMovieId(entry);
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
export function getCharacterVoiceProfile(characterId: EntityId, movieId?: string): CharacterVoiceProfile | undefined {
  const entry = getSharedAssetManager().getCharacterLibrary().get(characterId);
  if (!entry) return undefined;
  const resolvedMovieId = movieId ?? primaryMovieId(entry);
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
export function getCharacterTimeline(characterId: EntityId, movieId?: string): CharacterTimelineResult | undefined {
  const entry = getSharedAssetManager().getCharacterLibrary().get(characterId);
  if (!entry) return undefined;
  const resolvedMovieId = movieId ?? primaryMovieId(entry);
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

  return { movieId: resolvedMovieId, movieTitle: movie.movie.title, entries };
}

/**
 * Module 8 — traverses the real AssetDependencyGraph (via AssetManager.catalog(),
 * not a second graph) for this character: its own direct dependents
 * (reference images + scenes), then for each scene, its Environment and
 * that Environment's own dependents as the "assets" level. Movies come
 * from CharacterLibraryEntry.movieIds, not the graph (Movie isn't a node
 * type in AssetDependencyGraph).
 */
export function getCharacterRelationships(characterId: EntityId, movieId?: string): CharacterRelationships | undefined {
  const characterLibrary = getSharedAssetManager().getCharacterLibrary();
  const entry = characterLibrary.get(characterId);
  if (!entry) return undefined;
  const resolvedMovieId = movieId ?? primaryMovieId(entry);
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

  const movies: RelationshipMovieRef[] = entry.movieIds.map((id) => ({
    movieId: id,
    movieTitle: resolveMovieBlueprint(id)?.movie.title ?? id,
    isPrimary: id === resolvedMovieId,
  }));

  return { characterId, characterName: character.name, movies, ownAssetLabels, scenes };
}
