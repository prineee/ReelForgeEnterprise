/**
 * MovieReviewGenerator.ts
 *
 * Composes a human-readable verdict from data every earlier stage in this
 * layer already computed — QualityAnalyzer's score/issues, GenreEngine's
 * guidance, CharacterGenerator's cast plan, LocationPlanner's location
 * plan. Deliberately deterministic template composition, not an
 * LLM-as-judge call: every other composition class in
 * services/ai/director-engine/ and services/ai/asset-intelligence/
 * (StoryPlanner, SceneSequencer, SceneContinuityEngine, MusicPlanner,
 * VoicePlanner, ShotLibrary, TransitionLibrary) is deterministic with zero
 * AI model calls — only the Director trio (StoryAnalyzer/CharacterDirector/
 * EnvironmentDirector) call a language model, and those are explicitly
 * out of scope for this composition layer. A review verdict built the
 * same deterministic way stays predictable, testable, and free of new
 * provider/cost/latency dependencies this sprint doesn't ask for.
 *
 * No AI model calls, no network access, no randomness.
 */

import type { MovieBlueprint } from "../director/DirectorEngine";
import type { GenreGuidance } from "./GenreEngine";
import type { QualityReport } from "./QualityAnalyzer";
import type { CastPlan } from "./CharacterGenerator";
import type { LocationPlan } from "./LocationPlanner";

export type ReviewVerdict = "READY" | "NEEDS_REVISION" | "NOT_READY";

export interface MovieReview {
  movieId: string;
  verdict: ReviewVerdict;
  summary: string;
  strengths: string[];
  concerns: string[];
  qualityScore: number;
}

const READY_THRESHOLD = 80;
const NEEDS_REVISION_THRESHOLD = 50;

/** Deterministic verdict/summary composition over already-computed quality/genre/cast/location data. No LLM call. */
export class MovieReviewGenerator {
  review(movie: MovieBlueprint, genre: GenreGuidance, quality: QualityReport, cast: CastPlan, locations: LocationPlan): MovieReview {
    return {
      movieId: movie.movie.id,
      verdict: this.verdictFor(quality),
      summary: this.summaryFor(movie, genre, cast, locations),
      strengths: this.strengthsFor(quality, cast, locations),
      concerns: quality.issues.map((issue) => (issue.sceneNumber ? `Scene ${issue.sceneNumber}: ${issue.message}` : issue.message)),
      qualityScore: quality.score,
    };
  }

  private verdictFor(quality: QualityReport): ReviewVerdict {
    if (!quality.isReadyForProduction) return "NOT_READY";
    if (quality.score >= READY_THRESHOLD) return "READY";
    if (quality.score >= NEEDS_REVISION_THRESHOLD) return "NEEDS_REVISION";
    return "NOT_READY";
  }

  private summaryFor(movie: MovieBlueprint, genre: GenreGuidance, cast: CastPlan, locations: LocationPlan): string {
    return (
      `"${movie.movie.title}" is a ${genre.primaryGenre.toLowerCase().replace(/_/g, " ")} production spanning ` +
      `${movie.scenes.length} scenes, ${cast.cast.length} characters (${cast.leadCount} lead, ${cast.supportingCount} supporting), ` +
      `and ${locations.distinctLocationCount} distinct location${locations.distinctLocationCount === 1 ? "" : "s"}.`
    );
  }

  private strengthsFor(quality: QualityReport, cast: CastPlan, locations: LocationPlan): string[] {
    const strengths: string[] = [];
    if (!quality.issues.some((issue) => issue.type === "CONTINUITY")) {
      strengths.push("No continuity issues detected across the scene sequence.");
    }
    if (cast.leadCount >= 1 && cast.leadCount <= 3) {
      strengths.push("Cast has a clear, focused lead presence.");
    }
    if (locations.reusedLocationCount > 0) {
      strengths.push(`Reuses ${locations.reusedLocationCount} location${locations.reusedLocationCount === 1 ? "" : "s"} already established in prior productions, aiding visual consistency.`);
    }
    return strengths;
  }
}

export default MovieReviewGenerator;
