/**
 * StoryPlanner.ts
 *
 * NOT a replacement for services/ai/director/StoryAnalyzer.ts — that class
 * already turns a free-form user idea into a StoryBlueprint via a real
 * (injected, LLM-backed) LanguageModelProvider call, and is untouched by
 * this sprint. StoryPlanner takes an already-produced StoryBlueprint (from
 * StoryAnalyzer, called elsewhere, out of this sprint's scope) and a
 * DirectorProfile, and deterministically derives a three-act structural
 * plan — pure arithmetic over `estimatedSceneCount`/`estimatedDuration`,
 * no AI model call, no network access.
 */

import type { StoryBlueprint } from "../director/StoryAnalyzer";
import type { DirectorProfile, PacingLevel } from "./DirectorProfile";

export class StoryPlannerError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StoryPlannerError";
  }
}

export interface StoryAct {
  actNumber: 1 | 2 | 3;
  name: string;
  /** Inclusive scene-number range this act covers. */
  sceneNumberRange: { start: number; end: number };
  purpose: string;
  pacingGuidance: string;
}

export interface StoryPlan {
  storyTitle: string;
  acts: StoryAct[];
  overallPacing: PacingLevel;
  toneKeywords: string[];
  /** estimatedDuration / estimatedSceneCount, biased by the profile — see SceneSequencer.ts, which is what actually applies this per scene. */
  baseSceneDurationSeconds: number;
}

const ACT_NAMES: Record<1 | 2 | 3, string> = {
  1: "Setup",
  2: "Confrontation",
  3: "Resolution",
};

const ACT_PURPOSES: Record<1 | 2 | 3, string> = {
  1: "Establish the world, introduce the central characters, and pose the story's core conflict.",
  2: "Escalate the conflict, develop characters under pressure, and build toward the story's turning point.",
  3: "Resolve the conflict and deliver the story's emotional payoff, consistent with its ending style.",
};

/**
 * Deterministically structures a StoryBlueprint into a three-act plan,
 * biased by a DirectorProfile's pacing preference.
 */
export class StoryPlanner {
  plan(story: StoryBlueprint, profile: DirectorProfile): StoryPlan {
    if (story.estimatedSceneCount <= 0) {
      throw new StoryPlannerError(
        `StoryBlueprint.estimatedSceneCount must be positive, got ${story.estimatedSceneCount}.`
      );
    }

    const acts = this.buildActs(story.estimatedSceneCount);
    const baseSceneDurationSeconds = Math.max(
      1,
      story.estimatedDuration / story.estimatedSceneCount + profile.sceneDurationBiasSeconds
    );

    return {
      storyTitle: story.title,
      acts,
      overallPacing: profile.pacing,
      toneKeywords: [...story.emotionalArc, story.visualStyle].filter((v) => v.trim().length > 0),
      baseSceneDurationSeconds,
    };
  }

  private buildActs(sceneCount: number): StoryAct[] {
    const { act1End, act2End } = this.computeActBoundaries(sceneCount);

    const ranges: Record<1 | 2 | 3, { start: number; end: number }> = {
      1: { start: 1, end: act1End },
      2: { start: act1End + 1, end: act2End },
      3: { start: act2End + 1, end: sceneCount },
    };

    return ([1, 2, 3] as const).map((actNumber) => ({
      actNumber,
      name: ACT_NAMES[actNumber],
      sceneNumberRange: ranges[actNumber],
      purpose: ACT_PURPOSES[actNumber],
      pacingGuidance: this.pacingGuidanceFor(actNumber),
    }));
  }

  /**
   * Classic ~25/50/25 three-act split of the scene count, with every act
   * guaranteed at least one scene even when sceneCount is very small (act
   * boundaries may then coincide rather than represent distinct scenes).
   */
  private computeActBoundaries(sceneCount: number): { act1End: number; act2End: number } {
    if (sceneCount < 3) {
      return { act1End: 1, act2End: Math.max(1, sceneCount - 1) };
    }
    const act1End = Math.max(1, Math.round(sceneCount * 0.25));
    const act2End = Math.min(Math.max(act1End + 1, Math.round(sceneCount * 0.75)), sceneCount - 1);
    return { act1End, act2End };
  }

  private pacingGuidanceFor(actNumber: 1 | 2 | 3): string {
    switch (actNumber) {
      case 1:
        return "Establish rhythm deliberately — allow the audience to orient before escalating.";
      case 2:
        return "Accelerate steadily — shorten beats and raise stakes as the act progresses.";
      case 3:
        return "Resolve decisively — avoid lingering once the story's central conflict is settled.";
    }
  }
}
