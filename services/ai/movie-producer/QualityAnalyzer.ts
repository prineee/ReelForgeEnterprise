/**
 * QualityAnalyzer.ts
 *
 * Continuity checking already exists and is deterministic —
 * services/ai/director-engine/SceneContinuityEngine.ts's ContinuityReport,
 * already computed on AIDirectorPlan.continuity. Nothing here re-derives
 * continuity issues; ContinuityReport is consumed as one input signal
 * among several (continuity, cast balance, location coverage, scene
 * completeness) that together produce a single 0-100 quality score.
 * Follows SceneContinuityEngine's { type, message, severity } issue shape
 * for consistency with the rest of the codebase's deterministic-rule
 * style rather than inventing a new convention.
 *
 * No AI model calls, no network access, no randomness.
 */

import type { MovieBlueprint } from "../director/DirectorEngine";
import type { ContinuityReport } from "../director-engine/SceneContinuityEngine";
import type { CastPlan } from "./CharacterGenerator";
import type { LocationPlan } from "./LocationPlanner";

export type QualityIssueType =
  | "CONTINUITY"
  | "EMPTY_SCENE_DESCRIPTION"
  | "NO_LEAD_CHARACTER"
  | "SINGLE_LOCATION_MOVIE";

export type QualitySeverity = "ERROR" | "WARNING";

export interface QualityIssue {
  type: QualityIssueType;
  message: string;
  severity: QualitySeverity;
  sceneNumber?: number;
}

export interface QualityReport {
  score: number;
  issues: QualityIssue[];
  isReadyForProduction: boolean;
}

const SCORE_PENALTY: Record<QualitySeverity, number> = { ERROR: 15, WARNING: 5 };
const MIN_SCENES_FOR_SINGLE_LOCATION_WARNING = 6;

/** Deterministic 0-100 quality score + issues, composing ContinuityReport as one input signal. Never re-derives continuity. */
export class QualityAnalyzer {
  analyze(movie: MovieBlueprint, continuity: ContinuityReport, cast: CastPlan, locations: LocationPlan): QualityReport {
    const issues: QualityIssue[] = [
      ...continuity.issues.map((issue): QualityIssue => ({
        type: "CONTINUITY",
        message: issue.message,
        severity: issue.severity,
        sceneNumber: issue.sceneNumber,
      })),
      ...this.emptySceneDescriptionIssues(movie),
      ...this.castIssues(cast),
      ...this.locationIssues(movie, locations),
    ];

    const score = Math.max(0, 100 - issues.reduce((total, issue) => total + SCORE_PENALTY[issue.severity], 0));
    const isReadyForProduction = !issues.some((issue) => issue.severity === "ERROR");

    return { score, issues, isReadyForProduction };
  }

  private emptySceneDescriptionIssues(movie: MovieBlueprint): QualityIssue[] {
    return movie.scenes
      .filter((scene) => scene.description.trim().length === 0)
      .map((scene): QualityIssue => ({
        type: "EMPTY_SCENE_DESCRIPTION",
        message: `Scene ${scene.sceneNumber} has no description.`,
        severity: "ERROR",
        sceneNumber: scene.sceneNumber,
      }));
  }

  private castIssues(cast: CastPlan): QualityIssue[] {
    if (cast.leadCount > 0) return [];
    return [
      {
        type: "NO_LEAD_CHARACTER",
        message: "No character appears in enough scenes to read as a lead — the cast may feel unfocused.",
        severity: "WARNING",
      },
    ];
  }

  private locationIssues(movie: MovieBlueprint, locations: LocationPlan): QualityIssue[] {
    if (locations.distinctLocationCount > 1 || movie.scenes.length < MIN_SCENES_FOR_SINGLE_LOCATION_WARNING) return [];
    return [
      {
        type: "SINGLE_LOCATION_MOVIE",
        message: `All ${movie.scenes.length} scenes are set in a single location — consider whether visual variety is intentional.`,
        severity: "WARNING",
      },
    ];
  }
}

export default QualityAnalyzer;
