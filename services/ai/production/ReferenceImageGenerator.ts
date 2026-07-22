/**
 * ReferenceImageGenerator.ts
 *
 * A pure prompt-generation module: derives the reference-image prompts for
 * every character in a movie from an already-built CharacterConsistencyPack,
 * validates that the pack matches the movie's cast, and returns them. It
 * does not generate images itself.
 *
 * Architecture correction: image generation is now owned exclusively by
 * ImagenService (the AI Provider Layer). This module previously generated
 * images through an injected ImageGenerationProvider — that responsibility,
 * the provider interface, and the generated-image types have all been
 * removed. The intended call chain is now:
 *
 *   ReferenceImageGenerator (prompts) → ImagenService (images) →
 *   CloudinaryService (storage)
 *
 * with MovieProductionService orchestrating those three steps. This module
 * makes no provider calls, no network calls, and has no SDK or Cloudinary
 * dependency — it is deterministic, synchronous, pure data derivation.
 */

import type { MovieBlueprint } from "../director/DirectorEngine";
import type { CharacterConsistencyPack } from "./CharacterConsistencyEngine";

/**
 * The reference-image prompt for a single character.
 */
export interface CharacterReferencePrompt {
  characterId: string;
  prompt: string;
}

/**
 * The complete set of reference-image prompts for one movie, one per
 * character.
 */
export interface ReferencePromptPlan {
  movieId: string;
  prompts: CharacterReferencePrompt[];
}

/**
 * Thrown when a CharacterConsistencyPack fails validation against the
 * MovieBlueprint it's supposed to belong to.
 */
export class ReferenceImageGenerationError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = "ReferenceImageGenerationError";
  }
}

/**
 * Derives reference-image prompts for every character in a movie from a
 * CharacterConsistencyPack. Pure prompt derivation — no image generation,
 * no provider calls, no networking, no vendor code.
 */
export class ReferenceImageGenerator {
  /**
   * Validates the pack against the movie, then returns exactly one
   * reference-image prompt per character.
   */
  buildReferencePrompts(movie: MovieBlueprint, pack: CharacterConsistencyPack): ReferencePromptPlan {
    this.validatePack(movie, pack);

    const prompts: CharacterReferencePrompt[] = pack.characters.map((entry) => ({
      characterId: entry.uniqueCharacterId,
      prompt: entry.referencePrompt,
    }));

    return {
      movieId: movie.movie.id,
      prompts,
    };
  }

  /**
   * Validates the pack: no duplicate character IDs, the pack covers
   * exactly the movie's characters — neither missing any nor including
   * unknown ones — and every entry has a non-empty reference prompt.
   */
  private validatePack(movie: MovieBlueprint, pack: CharacterConsistencyPack): void {
    if (pack.movieId !== movie.movie.id) {
      throw new ReferenceImageGenerationError(
        `CharacterConsistencyPack.movieId ("${pack.movieId}") does not match MovieBlueprint.movie.id ("${movie.movie.id}").`
      );
    }

    const seen = new Set<string>();
    for (const entry of pack.characters) {
      if (seen.has(entry.uniqueCharacterId)) {
        throw new ReferenceImageGenerationError(
          `Duplicate characterId in CharacterConsistencyPack: ${entry.uniqueCharacterId}`
        );
      }
      seen.add(entry.uniqueCharacterId);
    }

    const movieCharacterIds = new Set(movie.characters.map((character) => character.id));
    const missing = [...movieCharacterIds].filter((id) => !seen.has(id));
    const extra = [...seen].filter((id) => !movieCharacterIds.has(id));

    if (missing.length > 0 || extra.length > 0) {
      throw new ReferenceImageGenerationError(
        `CharacterConsistencyPack does not exactly match MovieBlueprint characters. ` +
          `Missing: [${missing.join(", ")}]. Unexpected: [${extra.join(", ")}].`
      );
    }

    for (const entry of pack.characters) {
      if (!entry.referencePrompt || entry.referencePrompt.trim().length === 0) {
        throw new ReferenceImageGenerationError(
          `CharacterConsistencyPack entry for characterId "${entry.uniqueCharacterId}" has an empty referencePrompt.`
        );
      }
    }
  }
}
