/**
 * MovieTimelineBuilder.ts
 *
 * NOT the same concept as services/ai/production/MovieAssembler.ts's
 * MovieTimeline — that one is built *after* rendering, from real
 * generated video URLs and their actual durations (post-production
 * assembly). MovieTimelineBuilder is *pre-production*: it plans scene
 * ordering and cumulative start/end times from a SceneSequencer.
 * SequencedScenePlan's target durations, before any video has been
 * rendered. Once rendering completes, MovieAssembler's real timeline may
 * differ from this plan (actual render durations vary) — this module
 * doesn't reconcile that; it's a planning artifact, not a source of
 * truth once real videos exist.
 *
 * No AI model calls, no network access — cumulative arithmetic only.
 */

import type { SequencedScenePlan } from "./SceneSequencer";

export class MovieTimelineBuilderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MovieTimelineBuilderError";
  }
}

export interface PlannedTimelineEntry {
  sceneId: string;
  sceneNumber: number;
  actNumber: 1 | 2 | 3;
  plannedStartSeconds: number;
  plannedEndSeconds: number;
  targetDurationSeconds: number;
}

export interface MovieTimelinePlan {
  entries: PlannedTimelineEntry[];
  totalPlannedDurationSeconds: number;
}

export class MovieTimelineBuilder {
  build(sequencedPlan: SequencedScenePlan): MovieTimelinePlan {
    if (sequencedPlan.sequence.length === 0) {
      throw new MovieTimelineBuilderError("SequencedScenePlan has no scenes to build a timeline from.");
    }

    let cursor = 0;
    const entries: PlannedTimelineEntry[] = sequencedPlan.sequence.map((scene) => {
      const plannedStartSeconds = cursor;
      const plannedEndSeconds = cursor + scene.targetDurationSeconds;
      cursor = plannedEndSeconds;

      return {
        sceneId: scene.sceneId,
        sceneNumber: scene.sceneNumber,
        actNumber: scene.actNumber,
        plannedStartSeconds,
        plannedEndSeconds,
        targetDurationSeconds: scene.targetDurationSeconds,
      };
    });

    return { entries, totalPlannedDurationSeconds: cursor };
  }
}
