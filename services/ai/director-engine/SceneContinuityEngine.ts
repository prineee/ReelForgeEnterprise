/**
 * SceneContinuityEngine.ts
 *
 * Deterministic, rule-based continuity checks across a MovieBlueprint's
 * scene sequence — no AI model call, no semantic/visual analysis (that
 * would require a vision model, out of this sprint's scope). Every check
 * here is a structural comparison over already-generated data:
 * character usage, environment reuse, and time-of-day adjacency.
 *
 * This is new: the only pre-existing continuity concept in the codebase
 * is Environment.continuityNotes (a single freeform string, populated by
 * EnvironmentDirector and folded into PromptComposer's ENVIRONMENT
 * section) — a note a human/LLM wrote, not something validated against
 * the actual scene sequence. SceneContinuityEngine is the first thing
 * that actually checks the sequence itself.
 */

import { SceneTransition } from "../director/OutputSchema";
import type { MovieBlueprint } from "../director/DirectorEngine";
import type { CharacterMemory } from "./CharacterMemory";

export type ContinuityIssueType =
  | "CHARACTER_GAP"
  | "ENVIRONMENT_JUMP"
  | "TIME_OF_DAY_JUMP"
  | "MISSING_CONTINUITY_NOTES";

export type ContinuitySeverity = "WARNING" | "ERROR";

export interface ContinuityIssue {
  sceneNumber?: number;
  type: ContinuityIssueType;
  message: string;
  severity: ContinuitySeverity;
}

export interface ContinuityReport {
  issues: ContinuityIssue[];
  /** True only when no ERROR-severity issue exists — WARNINGs are review signals, not blockers. */
  isConsistent: boolean;
}

/**
 * Runs deterministic continuity checks over a MovieBlueprint's scene
 * sequence, using CharacterMemory (already populated via remember() +
 * logAppearance() calls) to know which characters actually appeared where.
 */
export class SceneContinuityEngine {
  check(movie: MovieBlueprint, memory: CharacterMemory): ContinuityReport {
    const issues: ContinuityIssue[] = [
      ...this.checkCharacterGaps(movie, memory),
      ...this.checkEnvironmentJumps(movie),
      ...this.checkTimeOfDayJumps(movie),
      ...this.checkMissingContinuityNotes(movie),
    ];

    return {
      issues,
      isConsistent: !issues.some((issue) => issue.severity === "ERROR"),
    };
  }

  /** A character listed on the movie but never featured in any scene is a real production error, not a style suggestion. */
  private checkCharacterGaps(movie: MovieBlueprint, memory: CharacterMemory): ContinuityIssue[] {
    const featured = new Set(movie.scenes.flatMap((scene) => scene.characterIds));
    const known = memory.getKnownCharacterIds().length > 0
      ? memory.getKnownCharacterIds()
      : movie.characters.map((c) => c.id);

    return known
      .filter((characterId) => !featured.has(characterId))
      .map((characterId) => {
        const character = movie.characters.find((c) => c.id === characterId);
        return {
          type: "CHARACTER_GAP" as const,
          message: `Character "${character?.name ?? characterId}" is never featured in any scene.`,
          severity: "ERROR" as const,
        };
      });
  }

  /** Consecutive scenes that change environment with no declared transition (SceneTransition.None) between them. */
  private checkEnvironmentJumps(movie: MovieBlueprint): ContinuityIssue[] {
    const sorted = [...movie.scenes].sort((a, b) => a.sceneNumber - b.sceneNumber);
    const issues: ContinuityIssue[] = [];

    for (let i = 0; i < sorted.length - 1; i++) {
      const current = sorted[i];
      const next = sorted[i + 1];
      if (current.environmentId === next.environmentId) continue;

      const cameraPlan = movie.cameraPlans.find((plan) => plan.id === current.cameraPlanId);
      if (cameraPlan?.transitionToNext === SceneTransition.None) {
        issues.push({
          sceneNumber: current.sceneNumber,
          type: "ENVIRONMENT_JUMP",
          message: `Scene ${current.sceneNumber} changes environment before scene ${next.sceneNumber} with no declared transition.`,
          severity: "WARNING",
        });
      }
    }

    return issues;
  }

  /** Consecutive scenes in the SAME environment whose resolved time-of-day differs, unexplained by any transition. */
  private checkTimeOfDayJumps(movie: MovieBlueprint): ContinuityIssue[] {
    const sorted = [...movie.scenes].sort((a, b) => a.sceneNumber - b.sceneNumber);
    const issues: ContinuityIssue[] = [];

    for (let i = 0; i < sorted.length - 1; i++) {
      const current = sorted[i];
      const next = sorted[i + 1];
      if (current.environmentId !== next.environmentId) continue;

      const environment = movie.environments.find((e) => e.id === current.environmentId);
      const currentTime = current.timeOfDay ?? environment?.timeOfDay;
      const nextTime = next.timeOfDay ?? environment?.timeOfDay;

      if (currentTime && nextTime && currentTime !== nextTime) {
        issues.push({
          sceneNumber: current.sceneNumber,
          type: "TIME_OF_DAY_JUMP",
          message: `Scene ${current.sceneNumber} (${currentTime}) is followed by scene ${next.sceneNumber} (${nextTime}) in the same environment.`,
          severity: "WARNING",
        });
      }
    }

    return issues;
  }

  /** An environment reused by non-consecutive scenes with no continuityNotes recorded. */
  private checkMissingContinuityNotes(movie: MovieBlueprint): ContinuityIssue[] {
    const usageBySceneNumber = new Map<string, number[]>();
    for (const scene of movie.scenes) {
      const list = usageBySceneNumber.get(scene.environmentId) ?? [];
      list.push(scene.sceneNumber);
      usageBySceneNumber.set(scene.environmentId, list);
    }

    const issues: ContinuityIssue[] = [];
    for (const [environmentId, sceneNumbers] of usageBySceneNumber) {
      if (sceneNumbers.length < 2) continue;
      const environment = movie.environments.find((e) => e.id === environmentId);
      if (environment?.continuityNotes) continue;

      issues.push({
        type: "MISSING_CONTINUITY_NOTES",
        message: `Environment "${environment?.name ?? environmentId}" is reused across scenes ${sceneNumbers.join(", ")} with no continuityNotes recorded.`,
        severity: "WARNING",
      });
    }

    return issues;
  }
}
