/**
 * AIDirectorEngine.ts
 *
 * The facade tying together every module in this directory: DirectorProfile,
 * StoryPlanner, SceneSequencer, CharacterMemory, SceneContinuityEngine,
 * MovieTimelineBuilder, DirectorPromptPipeline. Deliberately parallel to
 * (not a replacement for) services/ai/director/DirectorEngine.ts — that
 * class actually runs the six LLM-backed stages that *produce* a
 * StoryBlueprint/MovieBlueprint; this class takes those already-produced
 * outputs (called elsewhere, out of this sprint's scope — "Do NOT
 * implement AI model calls") and derives the structural/business-logic
 * plan around them: act structure, scene pacing, a pre-production
 * timeline, continuity checks, and enriched, provider-independent scene
 * prompts.
 *
 * No AI model call happens anywhere in this class or anything it calls.
 */

import type { StoryBlueprint } from "../director/StoryAnalyzer";
import type { MovieBlueprint } from "../director/DirectorEngine";
import type { ReferencePromptPlan } from "../production/ReferenceImageGenerator";

import { DirectorProfileRegistry, DIRECTOR_PROFILE_PRESETS, type DirectorProfile } from "./DirectorProfile";
import { StoryPlanner, type StoryPlan } from "./StoryPlanner";
import { SceneSequencer, type SequencedScenePlan } from "./SceneSequencer";
import { CharacterMemory } from "./CharacterMemory";
import { SceneContinuityEngine, type ContinuityReport } from "./SceneContinuityEngine";
import { MovieTimelineBuilder, type MovieTimelinePlan } from "./MovieTimelineBuilder";
import { DirectorPromptPipeline, type DirectorPromptResult } from "./DirectorPromptPipeline";

export interface AIDirectorPlan {
  storyPlan: StoryPlan;
  sequencedScenes: SequencedScenePlan;
  timeline: MovieTimelinePlan;
  continuity: ContinuityReport;
  prompts: DirectorPromptResult;
}

export class AIDirectorEngine {
  constructor(
    private readonly storyPlanner: StoryPlanner = new StoryPlanner(),
    private readonly sceneSequencer: SceneSequencer = new SceneSequencer(),
    private readonly timelineBuilder: MovieTimelineBuilder = new MovieTimelineBuilder(),
    private readonly characterMemory: CharacterMemory = new CharacterMemory(),
    private readonly continuityEngine: SceneContinuityEngine = new SceneContinuityEngine(),
    private readonly promptPipeline: DirectorPromptPipeline = new DirectorPromptPipeline()
  ) {}

  /**
   * Builds the full structural plan for an already-produced
   * StoryBlueprint + MovieBlueprint + ReferencePromptPlan (all three
   * produced elsewhere by the real, LLM-backed director/production
   * pipeline — this method calls none of that itself).
   */
  plan(
    story: StoryBlueprint,
    movie: MovieBlueprint,
    referencePromptPlan: ReferencePromptPlan,
    profile: DirectorProfile = DIRECTOR_PROFILE_PRESETS.CINEMATIC_DRAMA
  ): AIDirectorPlan {
    const storyPlan = this.storyPlanner.plan(story, profile);
    const sequencedScenes = this.sceneSequencer.sequence(movie.scenes, storyPlan, profile);
    const timeline = this.timelineBuilder.build(sequencedScenes);

    this.characterMemory.remember(movie);
    for (const scene of movie.scenes) {
      for (const characterId of scene.characterIds) {
        this.characterMemory.logAppearance(characterId, scene.id, scene.sceneNumber);
      }
    }

    const continuity = this.continuityEngine.check(movie, this.characterMemory);
    const prompts = this.promptPipeline.compose(movie, referencePromptPlan, profile, continuity);

    return { storyPlan, sequencedScenes, timeline, continuity, prompts };
  }
}

export { DirectorProfileRegistry, DIRECTOR_PROFILE_PRESETS };
export type { DirectorProfile };
