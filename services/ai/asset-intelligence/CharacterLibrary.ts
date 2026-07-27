/**
 * CharacterLibrary.ts
 *
 * Reuses services/ai/director-engine/CharacterMemory.ts (Sprint 6) —
 * does not duplicate its consistency-pack derivation or appearance
 * logging. CharacterMemory is scoped to *one* MovieBlueprint at a time
 * (remember() rebuilds its cache per call); CharacterLibrary adds what
 * it doesn't have: a catalog spanning *multiple* movies, tracking which
 * productions a given character has appeared in — the actual "reusable
 * character across productions" concept a library implies.
 *
 * No AI model calls, no media generation — register() only calls
 * CharacterMemory.remember(), itself pure data composition.
 */

import type { EntityId } from "../director/OutputSchema";
import type { MovieBlueprint } from "../director/DirectorEngine";
import type { CharacterConsistencyEntry } from "../production/CharacterConsistencyEngine";
import { CharacterMemory } from "../director-engine/CharacterMemory";

export interface CharacterLibraryEntry {
  characterId: EntityId;
  /** Every movieId this character has been registered under, in registration order. */
  movieIds: string[];
  /** The most recently registered consistency profile for this character. */
  consistencyEntry: CharacterConsistencyEntry;
  registrationCount: number;
}

export class CharacterLibrary {
  private readonly entries = new Map<EntityId, CharacterLibraryEntry>();

  constructor(private readonly memory: CharacterMemory = new CharacterMemory()) {}

  /** Catalogs (or re-catalogs) every character in a MovieBlueprint, via CharacterMemory.remember() — reused, not reimplemented. */
  register(movie: MovieBlueprint): void {
    const pack = this.memory.remember(movie);

    for (const consistencyEntry of pack.characters) {
      const characterId = consistencyEntry.uniqueCharacterId;
      const existing = this.entries.get(characterId);
      const movieIds = existing?.movieIds.includes(movie.movie.id)
        ? existing.movieIds
        : [...(existing?.movieIds ?? []), movie.movie.id];

      this.entries.set(characterId, {
        characterId,
        movieIds,
        consistencyEntry,
        registrationCount: (existing?.registrationCount ?? 0) + 1,
      });
    }
  }

  get(characterId: EntityId): CharacterLibraryEntry | undefined {
    return this.entries.get(characterId);
  }

  list(): readonly CharacterLibraryEntry[] {
    return Array.from(this.entries.values());
  }

  /** Every character registered under more than one movie — the library's actual reuse signal. */
  listReused(): readonly CharacterLibraryEntry[] {
    return this.list().filter((entry) => entry.movieIds.length > 1);
  }

  /** The underlying CharacterMemory instance, for callers that also want per-scene appearance logging (see CharacterMemory.logAppearance()) — exposed rather than duplicated. */
  getMemory(): CharacterMemory {
    return this.memory;
  }
}
