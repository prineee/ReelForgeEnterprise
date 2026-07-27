/**
 * CharacterMemory.ts
 *
 * Extends services/ai/production/CharacterConsistencyEngine.ts (reused
 * via composition, not duplicated) from a per-build, non-persistent
 * consistency pack into a genuinely persistent (in-memory, per this
 * codebase's established pattern) record of which scenes each character
 * has appeared in. CharacterConsistencyEngine already derives *what* a
 * character must look like consistently; CharacterMemory adds *where*
 * they've been seen so far — the input SceneContinuityEngine.ts needs to
 * check for gaps or unexplained absences across the scene sequence.
 *
 * No AI model calls, no network access — remember()/logAppearance() are
 * pure data operations over already-generated MovieBlueprint data.
 */

import type { EntityId } from "../director/OutputSchema";
import type { MovieBlueprint } from "../director/DirectorEngine";
import {
  CharacterConsistencyEngine,
  type CharacterConsistencyPack,
} from "../production/CharacterConsistencyEngine";

export class CharacterMemoryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CharacterMemoryError";
  }
}

export interface CharacterAppearanceLogEntry {
  sceneId: string;
  sceneNumber: number;
  referencePromptUsed: string;
  loggedAt: string;
}

/**
 * Persistent (in-memory) per-character appearance history, layered on top
 * of CharacterConsistencyEngine's deterministic consistency-pack
 * derivation.
 */
export class CharacterMemory {
  private readonly appearanceLog = new Map<EntityId, CharacterAppearanceLogEntry[]>();
  private pack?: CharacterConsistencyPack;

  constructor(private readonly consistencyEngine: CharacterConsistencyEngine = new CharacterConsistencyEngine()) {}

  /** Builds (or rebuilds) this movie's consistency pack via the existing engine — call once before logAppearance()/getCanonicalPrompt(). */
  remember(movie: MovieBlueprint): CharacterConsistencyPack {
    this.pack = this.consistencyEngine.buildConsistencyPack(movie);
    return this.pack;
  }

  /** Records that a character appeared in a given scene, using their canonical reference prompt at the time of logging. */
  logAppearance(characterId: EntityId, sceneId: string, sceneNumber: number): void {
    const referencePromptUsed = this.getCanonicalPrompt(characterId);
    const history = this.appearanceLog.get(characterId) ?? [];
    history.push({ sceneId, sceneNumber, referencePromptUsed, loggedAt: new Date().toISOString() });
    this.appearanceLog.set(characterId, history);
  }

  getAppearanceHistory(characterId: EntityId): readonly CharacterAppearanceLogEntry[] {
    return this.appearanceLog.get(characterId) ?? [];
  }

  getScenesFeaturing(characterId: EntityId): readonly string[] {
    return this.getAppearanceHistory(characterId).map((entry) => entry.sceneId);
  }

  /** Delegates to CharacterConsistencyEngine.composeReferencePrompt() — requires remember() to have been called first. */
  getCanonicalPrompt(characterId: EntityId): string {
    if (!this.pack) {
      throw new CharacterMemoryError("remember(movie) must be called before getCanonicalPrompt().");
    }
    return this.consistencyEngine.composeReferencePrompt(characterId);
  }

  /** Every characterId this memory currently has a consistency pack entry for. */
  getKnownCharacterIds(): readonly EntityId[] {
    return this.pack?.characters.map((entry) => entry.uniqueCharacterId) ?? [];
  }
}
