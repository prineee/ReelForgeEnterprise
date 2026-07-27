/**
 * ActGenerator.ts
 *
 * Three-act structure (act boundaries, names, purpose, pacing guidance)
 * already exists and is deterministic — services/ai/director-engine/StoryPlanner.ts's
 * StoryPlan/StoryAct[], already computed once per production and exposed
 * on AIDirectorPlan.storyPlan (services/ai/director-engine/AIDirectorEngine.ts).
 * This class does not recompute act boundaries or duplicate StoryPlanner's
 * arithmetic — it wraps each already-planned StoryAct with a narrative
 * framing sentence drawn from the story's actual conflict/theme/ending
 * style (StoryPlanner's own act purposes are fixed generic templates that
 * never reference the specific story) plus genre-informed tone keywords
 * from GenreEngine.
 *
 * No AI model calls, no network access, no randomness.
 */

import type { StoryAct, StoryPlan } from "../director-engine/StoryPlanner";
import type { StoryBlueprint } from "../director/StoryAnalyzer";
import type { PacingLevel } from "../director-engine/DirectorProfile";
import type { GenreGuidance } from "./GenreEngine";

export interface ActBeat extends StoryAct {
  /** A sentence framing this act against the story's actual conflict/theme/ending style — StoryAct.purpose is a fixed generic template; this is not. */
  narrativeFocus: string;
  toneKeywords: string[];
}

export interface ActBreakdown {
  storyTitle: string;
  acts: ActBeat[];
  overallPacing: PacingLevel;
}

/** Enriches StoryPlanner's real StoryPlan with story-specific narrative framing per act. Never recomputes act boundaries/purpose/pacingGuidance. */
export class ActGenerator {
  generate(storyPlan: StoryPlan, story: StoryBlueprint, genre: GenreGuidance): ActBreakdown {
    return {
      storyTitle: storyPlan.storyTitle,
      overallPacing: storyPlan.overallPacing,
      acts: storyPlan.acts.map((act) => ({
        ...act,
        narrativeFocus: this.narrativeFocusFor(act.actNumber, story),
        toneKeywords: genre.toneKeywords,
      })),
    };
  }

  private narrativeFocusFor(actNumber: 1 | 2 | 3, story: StoryBlueprint): string {
    switch (actNumber) {
      case 1:
        return `Introduce "${story.title}" to its ${story.targetAudience} audience and plant the central conflict: ${story.conflict}.`;
      case 2:
        return `Deepen the conflict — ${story.conflict} — around the story's theme of ${story.theme}, tracking the emotional arc through ${story.emotionalArc.join(" → ") || "its planned beats"}.`;
      case 3:
        return `Bring "${story.conflict}" to a ${story.endingStyle} resolution consistent with the story's theme of ${story.theme}.`;
    }
  }
}

export default ActGenerator;
