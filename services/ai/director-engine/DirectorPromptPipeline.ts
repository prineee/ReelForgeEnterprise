/**
 * DirectorPromptPipeline.ts
 *
 * NOT a replacement for services/ai/production/PromptComposer.ts or
 * ScenePromptBuilder.ts — both are reused here via composition, untouched.
 * PromptComposer already deterministically composes one prompt string per
 * scene; ScenePromptBuilder already assembles that into a
 * SceneGenerationRequest (positivePrompt/negativePrompt/character
 * reference prompts/duration/aspect ratio/quality) — the exact shape
 * MovieProductionService.generateSceneVideo() already converts into
 * RenderOrchestrator's provider-independent RenderRequest for whichever
 * provider is selected (LTX, Google, Local GPU today; Wan, CogVideoX,
 * Hunyuan, or any future provider tomorrow — see
 * services/rendering/interfaces/RenderProvider.ts).
 *
 * DirectorPromptPipeline's only new contribution is enrichment: it takes
 * ScenePromptBuilder's already-correct output and appends a
 * DirectorProfile's style/negative modifiers, plus any WARNING/ERROR
 * continuity notes from SceneContinuityEngine, onto the same
 * positivePrompt/negativePrompt strings — never producing a different
 * output shape. This is *why* every future provider automatically
 * consumes the enriched pipeline for free: they already consume
 * SceneGenerationRequest via the exact same conversion that exists today;
 * this module never introduces a second, competing prompt format.
 *
 * No AI model calls, no network access — string concatenation only.
 */

import type { MovieBlueprint } from "../director/DirectorEngine";
import type { ReferencePromptPlan } from "../production/ReferenceImageGenerator";
import { PromptComposer } from "../production/PromptComposer";
import { ScenePromptBuilder, type SceneGenerationRequest } from "../production/ScenePromptBuilder";
import type { DirectorProfile } from "./DirectorProfile";
import type { ContinuityReport, ContinuityIssue } from "./SceneContinuityEngine";

export interface DirectorPromptResult {
  movieId: string;
  requests: SceneGenerationRequest[];
}

/**
 * Enriches ScenePromptBuilder's deterministic SceneGenerationRequest[]
 * with DirectorProfile style modifiers and continuity warnings — the same
 * output type every existing/future provider already consumes.
 */
export class DirectorPromptPipeline {
  private readonly sceneBuilder: ScenePromptBuilder;

  constructor(promptComposer: PromptComposer = new PromptComposer(), sceneBuilder?: ScenePromptBuilder) {
    this.sceneBuilder = sceneBuilder ?? new ScenePromptBuilder(promptComposer);
  }

  compose(
    movie: MovieBlueprint,
    referencePromptPlan: ReferencePromptPlan,
    profile: DirectorProfile,
    continuity?: ContinuityReport
  ): DirectorPromptResult {
    const base = this.sceneBuilder.buildSceneRequests(movie, referencePromptPlan);

    const requests = base.requests.map((request) =>
      this.applyEnrichment(request, profile, this.issuesForScene(request.sceneNumber, continuity))
    );

    return { movieId: base.movieId, requests };
  }

  private applyEnrichment(
    request: SceneGenerationRequest,
    profile: DirectorProfile,
    issues: ContinuityIssue[]
  ): SceneGenerationRequest {
    const positiveSuffix = profile.promptStyleModifiers.join(", ");
    const negativeSuffix = [
      ...profile.negativePromptModifiers,
      ...issues.map((issue) => `continuity: ${issue.message}`),
    ].join(", ");

    return {
      ...request,
      positivePrompt: positiveSuffix
        ? `${request.positivePrompt}\n\nSTYLE: ${positiveSuffix}`
        : request.positivePrompt,
      negativePrompt: negativeSuffix ? `${request.negativePrompt}, ${negativeSuffix}` : request.negativePrompt,
    };
  }

  private issuesForScene(sceneNumber: number, continuity?: ContinuityReport): ContinuityIssue[] {
    if (!continuity) return [];
    return continuity.issues.filter((issue) => issue.sceneNumber === sceneNumber);
  }
}
