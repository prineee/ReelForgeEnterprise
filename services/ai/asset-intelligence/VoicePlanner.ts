/**
 * VoicePlanner.ts
 *
 * services/ai/director/ScenePlanner.ts already deterministically derives
 * each scene's VoiceActorAssignment[] from Character.voiceProfile.id (not
 * an LLM call — confirmed by inspection) — VoicePlanner does not
 * reimplement that derivation. It validates the result instead: every
 * character with a spoken DialogueLine in a scene must have a matching
 * VoiceActorAssignment in that same scene, and catalogs the movie's
 * overall character-to-voice mapping.
 *
 * services/ai/providers/audio/ElevenLabsService.ts (the only real TTS
 * seam in this codebase) is never imported or called here — it remains
 * entirely unconfigured (NotConfiguredAudioClient), and this sprint
 * forbids AI model calls/media generation regardless. VoicePlanner only
 * plans *which* voice profile belongs to *which* character/scene; it
 * synthesizes no audio.
 */

import type { EntityId } from "../director/OutputSchema";
import type { MovieBlueprint } from "../director/DirectorEngine";

export interface VoicePlanIssue {
  sceneNumber: number;
  characterId: EntityId;
  message: string;
}

export interface VoicePlan {
  /** characterId -> voiceProfileId, across the whole movie. */
  assignmentsByCharacter: Record<EntityId, EntityId>;
  issues: VoicePlanIssue[];
}

export class VoicePlanner {
  plan(movie: MovieBlueprint): VoicePlan {
    const assignmentsByCharacter: Record<EntityId, EntityId> = {};
    for (const character of movie.characters) {
      assignmentsByCharacter[character.id] = character.voiceProfile.id;
    }

    const issues = movie.scenes.flatMap((scene) => this.checkScene(scene, assignmentsByCharacter));

    return { assignmentsByCharacter, issues };
  }

  private checkScene(
    scene: MovieBlueprint["scenes"][number],
    assignmentsByCharacter: Record<EntityId, EntityId>
  ): VoicePlanIssue[] {
    if (!scene.dialogue || scene.dialogue.length === 0) return [];

    const assignedInScene = new Set((scene.voiceActors ?? []).map((assignment) => assignment.characterId));
    const speakingCharacterIds = new Set(scene.dialogue.map((line) => line.characterId));

    return Array.from(speakingCharacterIds)
      .filter((characterId) => !assignedInScene.has(characterId))
      .map((characterId) => ({
        sceneNumber: scene.sceneNumber,
        characterId,
        message: assignmentsByCharacter[characterId]
          ? `Character "${characterId}" has dialogue in scene ${scene.sceneNumber} but no VoiceActorAssignment for this scene.`
          : `Character "${characterId}" has dialogue in scene ${scene.sceneNumber} but is not a recognized character on this movie.`,
      }));
  }
}
