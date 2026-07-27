/**
 * SceneSequencer.ts
 *
 * NOT a replacement for services/ai/director/ScenePlanner.ts — that class
 * already drafts Scene[] (narrative content, cast, environment, dialogue
 * placeholders) via a real LLM call, and is untouched by this sprint.
 * SceneSequencer takes an already-drafted Scene[] (from the real
 * ScenePlanner, called elsewhere) plus a StoryPlanner.StoryPlan and a
 * DirectorProfile, and deterministically assigns each scene to its act,
 * computes a target duration, and attaches pacing guidance — pure
 * arithmetic and lookups over already-generated data, no AI model call.
 */

import type { Scene } from "../director/OutputSchema";
import type { StoryPlan } from "./StoryPlanner";
import type { DirectorProfile } from "./DirectorProfile";

export class SceneSequencerError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SceneSequencerError";
  }
}

export interface SequencedScene {
  sceneId: string;
  sceneNumber: number;
  actNumber: 1 | 2 | 3;
  targetDurationSeconds: number;
  pacingNote: string;
}

export interface SequencedScenePlan {
  sequence: SequencedScene[];
  totalTargetDurationSeconds: number;
}

const MIN_SCENE_DURATION_SECONDS = 2;
const MAX_SCENE_DURATION_SECONDS = 60;

/**
 * Deterministically sequences an already-drafted Scene[] against a
 * StoryPlan's act structure, applying a DirectorProfile's pacing bias to
 * each scene's target duration.
 */
export class SceneSequencer {
  sequence(scenes: Scene[], storyPlan: StoryPlan, profile: DirectorProfile): SequencedScenePlan {
    if (scenes.length === 0) {
      throw new SceneSequencerError("No scenes to sequence.");
    }

    const sorted = [...scenes].sort((a, b) => a.sceneNumber - b.sceneNumber);
    const sequence = sorted.map((scene) => this.sequenceOne(scene, storyPlan, profile));

    return {
      sequence,
      totalTargetDurationSeconds: sequence.reduce((sum, s) => sum + s.targetDurationSeconds, 0),
    };
  }

  private sequenceOne(scene: Scene, storyPlan: StoryPlan, profile: DirectorProfile): SequencedScene {
    const actNumber = this.resolveAct(scene.sceneNumber, storyPlan);
    const targetDurationSeconds = this.clampDuration(
      scene.durationSeconds ?? storyPlan.baseSceneDurationSeconds
    );

    return {
      sceneId: scene.id,
      sceneNumber: scene.sceneNumber,
      actNumber,
      targetDurationSeconds,
      pacingNote: this.pacingNoteFor(actNumber, storyPlan, profile),
    };
  }

  private resolveAct(sceneNumber: number, storyPlan: StoryPlan): 1 | 2 | 3 {
    const act = storyPlan.acts.find(
      (a) => sceneNumber >= a.sceneNumberRange.start && sceneNumber <= a.sceneNumberRange.end
    );
    if (!act) {
      throw new SceneSequencerError(
        `Scene number ${sceneNumber} falls outside every act's range in this StoryPlan.`
      );
    }
    return act.actNumber;
  }

  private clampDuration(seconds: number): number {
    return Math.min(MAX_SCENE_DURATION_SECONDS, Math.max(MIN_SCENE_DURATION_SECONDS, seconds));
  }

  private pacingNoteFor(actNumber: 1 | 2 | 3, storyPlan: StoryPlan, profile: DirectorProfile): string {
    const act = storyPlan.acts.find((a) => a.actNumber === actNumber);
    const base = act?.pacingGuidance ?? "";
    return `${base} (overall pacing: ${profile.pacing.toLowerCase()}, profile: ${profile.name})`;
  }
}
