/**
 * GenreEngine.ts
 *
 * Genre *classification* already exists and is LLM-backed —
 * services/ai/director/StoryAnalyzer.ts produces StoryBlueprint.genre
 * (validated against the real Genre enum, services/ai/director/OutputSchema.ts),
 * and DirectorEngine.assembleMovie() copies it straight onto Movie.genres.
 * This class does not reclassify genre — it consumes the already-classified
 * Genre[] and turns it into deterministic downstream guidance (pacing,
 * which DirectorProfile preset fits, tone keywords, visual style hints)
 * that nothing in the codebase currently derives from genre.
 *
 * No AI model calls, no network access, no randomness — a fixed lookup
 * table, same standard as DirectorProfile.ts's presets.
 */

import type { Genre } from "../director/OutputSchema";
import type { StoryBlueprint } from "../director/StoryAnalyzer";
import type { PacingLevel } from "../director-engine/DirectorProfile";

export interface GenreProfile {
  recommendedPacing: PacingLevel;
  /** References a DIRECTOR_PROFILE_PRESETS key (services/ai/director-engine/DirectorProfile.ts) — not a new preset system. */
  recommendedDirectorProfileId: string;
  toneKeywords: string[];
  visualStyleHints: string[];
}

export interface GenreGuidance {
  primaryGenre: Genre;
  secondaryGenres: Genre[];
  recommendedPacing: PacingLevel;
  recommendedDirectorProfileId: string;
  toneKeywords: string[];
  visualStyleHints: string[];
}

/** One entry per Genre enum value — deliberately exhaustive (Record<Genre, ...>) so adding a Genre without an entry here is a compile error. */
const GENRE_PROFILES: Record<Genre, GenreProfile> = {
  ACTION: {
    recommendedPacing: "FAST",
    recommendedDirectorProfileId: "FAST_PACED_ACTION",
    toneKeywords: ["kinetic", "high-stakes", "adrenaline"],
    visualStyleHints: ["dynamic motion blur", "high contrast"],
  },
  ADVENTURE: {
    recommendedPacing: "FAST",
    recommendedDirectorProfileId: "FAST_PACED_ACTION",
    toneKeywords: ["exploratory", "sweeping", "wonder"],
    visualStyleHints: ["expansive wide shots", "vibrant color grading"],
  },
  COMEDY: {
    recommendedPacing: "FAST",
    recommendedDirectorProfileId: "FAST_PACED_ACTION",
    toneKeywords: ["light", "playful", "quick-witted"],
    visualStyleHints: ["bright even lighting", "energetic blocking"],
  },
  DOCUMENTARY: {
    recommendedPacing: "MEDIUM",
    recommendedDirectorProfileId: "CINEMATIC_DRAMA",
    toneKeywords: ["observational", "grounded", "factual"],
    visualStyleHints: ["naturalistic lighting", "handheld realism"],
  },
  DRAMA: {
    recommendedPacing: "MEDIUM",
    recommendedDirectorProfileId: "CINEMATIC_DRAMA",
    toneKeywords: ["measured", "naturalistic", "character-driven"],
    visualStyleHints: ["classical composition", "35mm film grain"],
  },
  FANTASY: {
    recommendedPacing: "MEDIUM",
    recommendedDirectorProfileId: "CINEMATIC_DRAMA",
    toneKeywords: ["mythic", "wondrous", "otherworldly"],
    visualStyleHints: ["rich saturated color", "sweeping establishing shots"],
  },
  HORROR: {
    recommendedPacing: "SLOW",
    recommendedDirectorProfileId: "INTIMATE_INDIE",
    toneKeywords: ["tense", "dread", "unsettling"],
    visualStyleHints: ["low-key lighting", "long held shots"],
  },
  MUSICAL: {
    recommendedPacing: "FAST",
    recommendedDirectorProfileId: "FAST_PACED_ACTION",
    toneKeywords: ["exuberant", "rhythmic", "theatrical"],
    visualStyleHints: ["saturated stage lighting", "choreographed motion"],
  },
  MYSTERY: {
    recommendedPacing: "SLOW",
    recommendedDirectorProfileId: "INTIMATE_INDIE",
    toneKeywords: ["enigmatic", "deliberate", "suspenseful"],
    visualStyleHints: ["shadowed compositions", "shallow depth of field"],
  },
  NOIR: {
    recommendedPacing: "SLOW",
    recommendedDirectorProfileId: "INTIMATE_INDIE",
    toneKeywords: ["cynical", "moody", "atmospheric"],
    visualStyleHints: ["high-contrast shadows", "venetian-blind lighting"],
  },
  ROMANCE: {
    recommendedPacing: "SLOW",
    recommendedDirectorProfileId: "INTIMATE_INDIE",
    toneKeywords: ["tender", "intimate", "warm"],
    visualStyleHints: ["soft natural light", "shallow depth of field"],
  },
  SCI_FI: {
    recommendedPacing: "MEDIUM",
    recommendedDirectorProfileId: "CINEMATIC_DRAMA",
    toneKeywords: ["speculative", "immersive", "conceptual"],
    visualStyleHints: ["clean geometric composition", "cool color palette"],
  },
  THRILLER: {
    recommendedPacing: "FAST",
    recommendedDirectorProfileId: "FAST_PACED_ACTION",
    toneKeywords: ["urgent", "tense", "propulsive"],
    visualStyleHints: ["high contrast", "dynamic motion blur"],
  },
};

/** Turns an already-classified Genre[] (StoryBlueprint.genre / Movie.genres) into deterministic downstream guidance. Never re-derives genre itself. */
export class GenreEngine {
  plan(genres: readonly Genre[], story: StoryBlueprint): GenreGuidance {
    if (genres.length === 0) {
      throw new GenreEngineError("Cannot plan genre guidance for a story with no classified genres.");
    }

    const [primaryGenre, ...secondaryGenres] = genres;
    const primaryProfile = GENRE_PROFILES[primaryGenre];

    const toneKeywords = this.uniqueMerge(
      genres.flatMap((genre) => GENRE_PROFILES[genre].toneKeywords),
      story.emotionalArc
    );
    const visualStyleHints = this.uniqueMerge(
      genres.flatMap((genre) => GENRE_PROFILES[genre].visualStyleHints),
      story.visualStyle ? [story.visualStyle] : []
    );

    return {
      primaryGenre,
      secondaryGenres,
      recommendedPacing: primaryProfile.recommendedPacing,
      recommendedDirectorProfileId: primaryProfile.recommendedDirectorProfileId,
      toneKeywords,
      visualStyleHints,
    };
  }

  private uniqueMerge(...lists: string[][]): string[] {
    return Array.from(new Set(lists.flat().filter((entry) => entry.trim().length > 0)));
  }
}

export class GenreEngineError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GenreEngineError";
  }
}

export default GenreEngine;
