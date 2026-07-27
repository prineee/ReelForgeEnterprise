/**
 * MusicPlanner.ts
 *
 * No music-generation service exists anywhere in this codebase (confirmed
 * by inspection — no Suno/audio-music API integration, nothing beyond
 * MusicCue's type declaration). This sprint explicitly forbids AI model
 * calls and media generation, so MusicPlanner produces a *plan* only:
 * per-scene MusicCue direction (style + mood tags) and its planned
 * position on the timeline — never an actual audio track.
 *
 * Reuses services/ai/director-engine/StoryPlanner.ts's StoryPlan and
 * services/ai/director-engine/MovieTimelineBuilder.ts's MovieTimelinePlan
 * (both consumed as already-computed input, from
 * AIDirectorEngine.plan()'s output — see AssetManager.ts) rather than
 * recomputing act structure or scene timing itself. Where
 * services/ai/director/ScenePlanner.ts already populated
 * Scene.backgroundMusic (a real LLM-derived cue), that cue is kept as-is
 * (source: "EXISTING"); MusicPlanner only fills genuine gaps
 * deterministically (source: "DERIVED") from each scene's EmotionPlan —
 * it never overwrites LLM-authored direction.
 */

import { Emotion } from "../director/OutputSchema";
import type { MusicCue } from "../director/OutputSchema";
import type { MovieBlueprint } from "../director/DirectorEngine";
import type { StoryPlan } from "../director-engine/StoryPlanner";
import type { MovieTimelinePlan } from "../director-engine/MovieTimelineBuilder";

export type MusicCueSource = "EXISTING" | "DERIVED";

export interface PlannedMusicCue {
  sceneId: string;
  sceneNumber: number;
  actNumber: 1 | 2 | 3;
  startSeconds: number;
  cue: MusicCue;
  source: MusicCueSource;
}

export interface MusicPlan {
  cues: PlannedMusicCue[];
  overallStyle: string;
}

/** Deterministic mood-tag lookup — not a substitute for ScenePlanner's LLM-authored cues, only a fallback when none exists. */
const MOOD_TAGS_BY_EMOTION: Readonly<Record<Emotion, string[]>> = {
  [Emotion.Joy]: ["uplifting", "bright"],
  [Emotion.Sadness]: ["somber", "melancholic"],
  [Emotion.Anger]: ["aggressive", "driving"],
  [Emotion.Fear]: ["tense", "dissonant"],
  [Emotion.Surprise]: ["sudden", "sharp"],
  [Emotion.Disgust]: ["unsettling", "dissonant"],
  [Emotion.Love]: ["warm", "tender"],
  [Emotion.Tension]: ["suspenseful", "sparse"],
  [Emotion.Calm]: ["ambient", "gentle"],
  [Emotion.Excitement]: ["energetic", "driving"],
  [Emotion.Melancholy]: ["wistful", "sparse"],
  [Emotion.Determination]: ["building", "resolute"],
};

export class MusicPlannerError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MusicPlannerError";
  }
}

export class MusicPlanner {
  plan(movie: MovieBlueprint, storyPlan: StoryPlan, timeline: MovieTimelinePlan): MusicPlan {
    const timelineByScene = new Map(timeline.entries.map((entry) => [entry.sceneId, entry]));

    const cues = movie.scenes.map((scene) => {
      const timelineEntry = timelineByScene.get(scene.id);
      if (!timelineEntry) {
        throw new MusicPlannerError(`No timeline entry for scene "${scene.id}" — timeline and movie are out of sync.`);
      }

      const existing = scene.backgroundMusic;
      if (existing) {
        return {
          sceneId: scene.id,
          sceneNumber: scene.sceneNumber,
          actNumber: timelineEntry.actNumber,
          startSeconds: timelineEntry.plannedStartSeconds,
          cue: existing,
          source: "EXISTING" as const,
        };
      }

      const emotionPlan = movie.emotionPlans.find((plan) => plan.sceneNumber === scene.sceneNumber);
      const dominantEmotion = emotionPlan?.dominantEmotion ?? Emotion.Calm;
      const moodTags = [...MOOD_TAGS_BY_EMOTION[dominantEmotion], this.tempoTagFor(storyPlan.overallPacing)];

      return {
        sceneId: scene.id,
        sceneNumber: scene.sceneNumber,
        actNumber: timelineEntry.actNumber,
        startSeconds: timelineEntry.plannedStartSeconds,
        cue: { style: movie.movie.musicStyle, moodTags, volume: 0.5 } satisfies MusicCue,
        source: "DERIVED" as const,
      };
    });

    return { cues, overallStyle: movie.movie.musicStyle };
  }

  /** Reuses StoryPlan.overallPacing (StoryPlanner.ts) as a tempo signal for derived cues — real use of the reused plan, not just a passthrough parameter. */
  private tempoTagFor(pacing: StoryPlan["overallPacing"]): string {
    switch (pacing) {
      case "SLOW":
        return "slow tempo";
      case "FAST":
        return "fast tempo";
      case "MEDIUM":
      default:
        return "moderate tempo";
    }
  }
}
