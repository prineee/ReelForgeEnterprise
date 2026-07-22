/**
 * ScenePromptBuilder.ts
 *
 * Fourth module of the Production Engine. Assembles one
 * SceneGenerationRequest per Scene, combining PromptComposer's composed
 * prompt with each scene's character reference prompts and structural
 * metadata — everything a downstream image/video generation stage needs to
 * render the scene. This module performs no rendering and calls no
 * provider itself; it is pure orchestration over already-generated data.
 *
 * Architecture follow-up: ReferenceImageGenerator was refactored into a
 * pure prompt-generation module and no longer produces generated images,
 * URLs, or uploaded assets — only ReferencePromptPlan/CharacterReferencePrompt
 * (characterId + prompt text). ScenePromptBuilder now builds scene prompts
 * using only MovieBlueprint and those character reference prompts.
 * CharacterConsistencyPack is no longer a dependency here: it was
 * previously used for exactly one check (matching its movieId against the
 * MovieBlueprint), which ReferencePromptPlan.movieId already covers on its
 * own. Actual image generation (ImagenService) and asset storage
 * (CloudinaryService) happen in later stages this module knows nothing
 * about.
 *
 * Design note: PromptComposer.composeScenePrompt() returns one merged
 * string whose last section is always its (private) negative-prompt
 * output, labeled "AVOID:". Since PromptComposer cannot be modified to
 * expose positive/negative separately, this module splits that known,
 * stable output on the "AVOID:" marker rather than recomposing a negative
 * prompt itself — the content is exactly what PromptComposer already
 * deterministically produced, just separated back into two fields.
 *
 * Design note: expectedDuration, aspectRatio, quality, and outputFormat
 * have no single dedicated source. expectedDuration prefers
 * Scene.durationSeconds, then CameraPlan.durationSeconds, falling back to
 * 8 seconds (the same default already used for Veo generation elsewhere
 * in this codebase). aspectRatio defaults to "9:16", matching this
 * platform's existing vertical-video convention. quality defaults to the
 * fixed string "high", consistent with PromptComposer's own production
 * quality directive. outputFormat prefers Movie.exportFormats[0] when
 * populated, falling back to "MP4".
 */

import type { MovieBlueprint } from "../director/DirectorEngine";
import type { CharacterReferencePrompt, ReferencePromptPlan } from "./ReferenceImageGenerator";
import type { PromptComposer } from "./PromptComposer";

/**
 * Structural identifiers for the entities that produced a scene's prompt —
 * useful for tracing a generation request back to its planning-phase
 * sources.
 */
export interface SceneGenerationMetadata {
  characterIds: string[];
  environmentId: string;
  cameraPlanId: string;
  emotionPlanId: string;
}

/**
 * Everything a downstream generation stage needs to render one scene. No
 * generated images, URLs, or uploaded assets are expected here — only the
 * character reference prompts that a later image/video generation stage
 * will use.
 */
export interface SceneGenerationRequest {
  sceneId: string;
  sceneNumber: number;
  positivePrompt: string;
  negativePrompt: string;
  characterReferencePrompts: CharacterReferencePrompt[];
  expectedDuration: number;
  aspectRatio: string;
  quality: string;
  outputFormat: string;
  metadata: SceneGenerationMetadata;
}

/**
 * The complete set of scene generation requests for one movie.
 */
export interface ScenePromptBuildResult {
  movieId: string;
  requests: SceneGenerationRequest[];
}

/**
 * Thrown when the inputs to ScenePromptBuilder are inconsistent, or a
 * scene's composed prompt cannot be split into positive/negative sections.
 */
export class ScenePromptBuildError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ScenePromptBuildError";
  }
}

const DEFAULT_EXPECTED_DURATION_SECONDS = 8;
const DEFAULT_ASPECT_RATIO = "9:16";
const DEFAULT_QUALITY = "high";
const DEFAULT_OUTPUT_FORMAT = "MP4";
const NEGATIVE_PROMPT_MARKER = "AVOID:";

/**
 * Assembles SceneGenerationRequests from a MovieBlueprint and its
 * character reference prompts, using an injected PromptComposer for
 * per-scene prompt text. Pure orchestration — no rendering, no provider
 * calls, no vendor code.
 */
export class ScenePromptBuilder {
  constructor(private readonly promptComposer: PromptComposer) {}

  /**
   * Builds exactly one SceneGenerationRequest per Scene in the
   * MovieBlueprint, after validating that every scene's character
   * reference prompts resolve.
   */
  buildSceneRequests(
    movie: MovieBlueprint,
    referencePromptPlan: ReferencePromptPlan
  ): ScenePromptBuildResult {
    this.validateInputs(movie, referencePromptPlan);

    const promptByCharacter = new Map(
      referencePromptPlan.prompts.map((entry) => [entry.characterId, entry])
    );
    const seenSceneIds = new Set<string>();

    const requests = movie.scenes.map((scene) =>
      this.buildRequest(movie, scene, promptByCharacter, seenSceneIds)
    );

    return {
      movieId: movie.movie.id,
      requests,
    };
  }

  /**
   * Builds a single SceneGenerationRequest for one scene.
   */
  private buildRequest(
    movie: MovieBlueprint,
    scene: MovieBlueprint["scenes"][number],
    promptByCharacter: Map<string, CharacterReferencePrompt>,
    seenSceneIds: Set<string>
  ): SceneGenerationRequest {
    if (seenSceneIds.has(scene.id)) {
      throw new ScenePromptBuildError(`Duplicate sceneId: ${scene.id}`);
    }
    seenSceneIds.add(scene.id);

    const composedPrompt = this.promptComposer.composeScenePrompt(movie, scene.id);
    const { positivePrompt, negativePrompt } = this.splitPromptSections(composedPrompt, scene.id);

    if (positivePrompt.length === 0) {
      throw new ScenePromptBuildError(`Empty positivePrompt for scene ${scene.id}.`);
    }
    if (negativePrompt.length === 0) {
      throw new ScenePromptBuildError(`Empty negativePrompt for scene ${scene.id}.`);
    }

    const characterReferencePrompts = scene.characterIds.map((characterId) => {
      const entry = promptByCharacter.get(characterId);
      if (!entry) {
        throw new ScenePromptBuildError(
          `Missing character reference prompt for character "${characterId}" in scene ${scene.id}.`
        );
      }
      return entry;
    });

    const cameraPlan = movie.cameraPlans.find((plan) => plan.id === scene.cameraPlanId);
    const expectedDuration =
      scene.durationSeconds ?? cameraPlan?.durationSeconds ?? DEFAULT_EXPECTED_DURATION_SECONDS;

    const outputFormat =
      movie.movie.exportFormats.length > 0 ? movie.movie.exportFormats[0] : DEFAULT_OUTPUT_FORMAT;

    return {
      sceneId: scene.id,
      sceneNumber: scene.sceneNumber,
      positivePrompt,
      negativePrompt,
      characterReferencePrompts,
      expectedDuration,
      aspectRatio: DEFAULT_ASPECT_RATIO,
      quality: DEFAULT_QUALITY,
      outputFormat,
      metadata: {
        characterIds: scene.characterIds,
        environmentId: scene.environmentId,
        cameraPlanId: scene.cameraPlanId,
        emotionPlanId: scene.emotionPlanId,
      },
    };
  }

  /**
   * Splits PromptComposer's single composed prompt into positivePrompt and
   * negativePrompt, using the stable "AVOID:" section marker that
   * PromptComposer always appends last.
   */
  private splitPromptSections(
    composedPrompt: string,
    sceneId: string
  ): { positivePrompt: string; negativePrompt: string } {
    const markerIndex = composedPrompt.lastIndexOf(NEGATIVE_PROMPT_MARKER);
    if (markerIndex === -1) {
      throw new ScenePromptBuildError(
        `Composed prompt for scene ${sceneId} is missing its "${NEGATIVE_PROMPT_MARKER}" section.`
      );
    }

    return {
      positivePrompt: composedPrompt.slice(0, markerIndex).trim(),
      negativePrompt: composedPrompt.slice(markerIndex + NEGATIVE_PROMPT_MARKER.length).trim(),
    };
  }

  /**
   * Validates every scene's references before any request is built:
   *   - ReferencePromptPlan belongs to this movie.
   *   - no duplicate scene IDs.
   *   - no duplicate character reference prompt entries.
   *   - every scene's characterIds, environmentId, cameraPlanId, and
   *     emotionPlanId all resolve to a real entity — including every
   *     character having a reference prompt.
   */
  private validateInputs(movie: MovieBlueprint, referencePromptPlan: ReferencePromptPlan): void {
    if (movie.scenes.length === 0) {
      throw new ScenePromptBuildError("MovieBlueprint has no scenes.");
    }

    if (referencePromptPlan.movieId !== movie.movie.id) {
      throw new ScenePromptBuildError(
        `ReferencePromptPlan.movieId ("${referencePromptPlan.movieId}") does not match MovieBlueprint.movie.id ("${movie.movie.id}").`
      );
    }

    const seenSceneIds = new Set<string>();
    for (const scene of movie.scenes) {
      if (seenSceneIds.has(scene.id)) {
        throw new ScenePromptBuildError(`Duplicate sceneId in MovieBlueprint: ${scene.id}`);
      }
      seenSceneIds.add(scene.id);
    }

    const promptCharacterIds = new Set<string>();
    for (const entry of referencePromptPlan.prompts) {
      if (promptCharacterIds.has(entry.characterId)) {
        throw new ScenePromptBuildError(
          `Duplicate character reference prompt entry for characterId: ${entry.characterId}`
        );
      }
      promptCharacterIds.add(entry.characterId);
    }

    for (const scene of movie.scenes) {
      const missingPrompts = scene.characterIds.filter((id) => !promptCharacterIds.has(id));
      if (missingPrompts.length > 0) {
        throw new ScenePromptBuildError(
          `Scene ${scene.id} is missing character reference prompts for character(s): ${missingPrompts.join(", ")}.`
        );
      }

      if (!movie.environments.some((environment) => environment.id === scene.environmentId)) {
        throw new ScenePromptBuildError(
          `Scene ${scene.id} references unknown environmentId: ${scene.environmentId}`
        );
      }
      if (!movie.cameraPlans.some((plan) => plan.id === scene.cameraPlanId)) {
        throw new ScenePromptBuildError(
          `Scene ${scene.id} references unknown cameraPlanId: ${scene.cameraPlanId}`
        );
      }
      if (!movie.emotionPlans.some((plan) => plan.id === scene.emotionPlanId)) {
        throw new ScenePromptBuildError(
          `Scene ${scene.id} references unknown emotionPlanId: ${scene.emotionPlanId}`
        );
      }
    }
  }
}
