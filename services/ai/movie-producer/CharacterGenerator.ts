/**
 * CharacterGenerator.ts
 *
 * Character *authoring* already exists and is LLM-backed —
 * services/ai/director/CharacterDirector.ts extracts every distinct
 * Character from a StoryBlueprint, called inside DirectorEngine.createMovieBlueprint()
 * (out of this sprint's scope, per the established convention that the
 * Director trio — StoryAnalyzer/CharacterDirector/EnvironmentDirector — is
 * untouched here). This class does not author characters a second time.
 *
 * Per-scene appearance *tracking* already exists too —
 * services/ai/director-engine/CharacterMemory.ts's appearanceLog, but it
 * is populated via logAppearance() calls made internally by
 * AIDirectorEngine.plan() on its own private CharacterMemory instance,
 * which is not exposed on AIDirectorPlan. Rather than reconstruct a
 * second CharacterMemory and duplicate that internal logging loop, this
 * class counts appearances directly from Scene.characterIds — already
 * present on every Scene in MovieBlueprint, zero dependency on
 * CharacterMemory's consistency-pack/appearance-log machinery.
 *
 * Cross-movie reuse comes from services/ai/asset-intelligence/CharacterLibrary.ts
 * (already computed as part of AssetCatalog.characters) — not
 * recalculated here.
 *
 * No AI model calls, no network access, no randomness.
 */

import type { EntityId, Character } from "../director/OutputSchema";
import type { MovieBlueprint } from "../director/DirectorEngine";
import type { CharacterLibraryEntry } from "../asset-intelligence/CharacterLibrary";

export type CastRole = "LEAD" | "SUPPORTING" | "MINOR";

export interface CastMember {
  characterId: EntityId;
  name: string;
  role: CastRole;
  appearanceCount: number;
  /** True when CharacterLibrary has registered this character under more than one movie. */
  isReusedFromPriorMovie: boolean;
}

export interface CastPlan {
  movieId: EntityId;
  cast: CastMember[];
  leadCount: number;
  supportingCount: number;
  minorCount: number;
}

const LEAD_APPEARANCE_SHARE = 0.5;

/** Classifies MovieBlueprint.characters into cast roles by real scene-appearance frequency. Does not author or track appearances itself. */
export class CharacterGenerator {
  plan(movie: MovieBlueprint, characterLibrary: readonly CharacterLibraryEntry[]): CastPlan {
    const libraryByCharacterId = new Map(characterLibrary.map((entry) => [entry.characterId, entry]));
    const totalScenes = movie.scenes.length;

    const cast = movie.characters
      .map((character) => this.toCastMember(character, movie, libraryByCharacterId, totalScenes))
      .sort((a, b) => b.appearanceCount - a.appearanceCount);

    return {
      movieId: movie.movie.id,
      cast,
      leadCount: cast.filter((member) => member.role === "LEAD").length,
      supportingCount: cast.filter((member) => member.role === "SUPPORTING").length,
      minorCount: cast.filter((member) => member.role === "MINOR").length,
    };
  }

  private toCastMember(
    character: Character,
    movie: MovieBlueprint,
    libraryByCharacterId: Map<EntityId, CharacterLibraryEntry>,
    totalScenes: number
  ): CastMember {
    const appearanceCount = movie.scenes.filter((scene) => scene.characterIds.includes(character.id)).length;
    const libraryEntry = libraryByCharacterId.get(character.id);

    return {
      characterId: character.id,
      name: character.name,
      role: this.classifyRole(appearanceCount, totalScenes),
      appearanceCount,
      isReusedFromPriorMovie: (libraryEntry?.movieIds.length ?? 0) > 1,
    };
  }

  private classifyRole(appearanceCount: number, totalScenes: number): CastRole {
    if (totalScenes === 0 || appearanceCount === 0) return "MINOR";
    const share = appearanceCount / totalScenes;
    if (share >= LEAD_APPEARANCE_SHARE) return "LEAD";
    if (appearanceCount >= 2) return "SUPPORTING";
    return "MINOR";
  }
}

export default CharacterGenerator;
