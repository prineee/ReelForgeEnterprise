/**
 * CameraDirector.ts
 *
 * Produces one camera plan per planned scene from a StoryBlueprint,
 * targeting OutputSchema v2. The actual language-model call is abstracted
 * behind an injected LanguageModelProvider (the same interface used by
 * StoryAnalyzer, CharacterDirector, and EnvironmentDirector), so this
 * module contains no provider-specific code and makes no network calls
 * itself.
 */

import type {
  CameraPlan,
  CameraShot,
  CameraMovement,
  CameraHeight,
  SceneTransition,
  Lighting,
  EntityId,
} from "./OutputSchema";
import {
  CameraShot as CameraShotEnum,
  CameraMovement as CameraMovementEnum,
  CameraHeight as CameraHeightEnum,
  SceneTransition as SceneTransitionEnum,
  Lighting as LightingEnum,
} from "./OutputSchema";
import type { StoryBlueprint, LanguageModelProvider } from "./StoryAnalyzer";

/**
 * Raw, unvalidated shape of a single camera plan as expected back from the
 * language model, before it is parsed and validated.
 */
interface RawCameraPlan {
  sceneNumber?: unknown;
  shot?: unknown;
  movement?: unknown;
  angle?: unknown;
  lens?: unknown;
  framing?: unknown;
  lighting?: unknown;
  cameraHeight?: unknown;
  focusSubject?: unknown;
  transitionToNext?: unknown;
  cinematicPurpose?: unknown;
  durationSeconds?: unknown;
}

/**
 * Raw, unvalidated top-level shape expected back from the language model.
 */
interface RawCameraPlanResponse {
  cameraPlans?: unknown;
}

/**
 * Thrown when the language model's response cannot be parsed into a valid
 * set of camera plans.
 */
export class CameraPlanParseError extends Error {
  constructor(message: string, public readonly rawResponse: string) {
    super(message);
    this.name = "CameraPlanParseError";
  }
}

const VALID_SHOTS = new Set<string>(Object.values(CameraShotEnum));
const VALID_MOVEMENTS = new Set<string>(Object.values(CameraMovementEnum));
const VALID_LIGHTING = new Set<string>(Object.values(LightingEnum));
const VALID_CAMERA_HEIGHTS = new Set<string>(Object.values(CameraHeightEnum));
const VALID_TRANSITIONS = new Set<string>(Object.values(SceneTransitionEnum));

/**
 * Plans one camera setup per scene of a StoryBlueprint by delegating
 * language generation to an injected LanguageModelProvider. Populates
 * OutputSchema v2's typed CameraPlan fields directly — framing, lighting,
 * camera height, focus subject, transition, and cinematic purpose are real
 * fields on CameraPlan itself, so no local extension interface is needed.
 */
export class CameraDirector {
  constructor(private readonly provider: LanguageModelProvider) {}

  /**
   * Produces exactly one camera plan per scene planned in the story
   * (`story.estimatedSceneCount`), ordered by scene number.
   */
  async planCamera(story: StoryBlueprint): Promise<CameraPlan[]> {
    console.log("CAM1 before buildPrompt");
    const prompt = this.buildPrompt(story);
    console.log("CAM2 after buildPrompt");

    console.log("CAM3 before provider.generate");
    console.log("prompt is string:", typeof prompt === "string");
    console.log("prompt is undefined:", prompt === undefined);
    console.log("prompt is empty:", typeof prompt === "string" && prompt.length === 0);
    console.log("prompt.length:", prompt?.length);
    console.log("prompt first 500 chars:", prompt?.slice(0, 500));
    console.log("prompt last 500 chars:", prompt?.slice(-500));
    let rawResponse: string;
    try {
      rawResponse = await this.provider.generate(prompt);
    } catch (error) {
      console.error("CAMERA DIRECTOR ERROR");
      console.error(error);
      if (error instanceof Error) console.error(error.stack);
      throw error;
    }
    console.log("CAM4 after provider.generate");

    console.log("CAM5 before parseResponse");
    const result = this.parseResponse(rawResponse, story.estimatedSceneCount);
    console.log("CAM6 after parseResponse");

    return result;
  }

  /**
   * Builds the structured prompt instructing the language model to return
   * one camera plan per scene as a single JSON object.
   */
  private buildPrompt(story: StoryBlueprint): string {
    return [
      "You are a professional director of photography.",
      `Given the story blueprint below, produce exactly ${story.estimatedSceneCount}`,
      "camera plans — one for each planned scene, numbered sequentially",
      `from 1 to ${story.estimatedSceneCount}.`,
      "Respond with ONLY a single valid JSON object — no markdown, no commentary.",
      "",
      'The JSON object must have exactly one field, "cameraPlans", an array',
      "where each item has exactly these fields:",
      '  "sceneNumber": number (1-based, unique, sequential)',
      `  "shot": string (one of: ${Array.from(VALID_SHOTS).join(", ")})`,
      `  "movement": string (one of: ${Array.from(VALID_MOVEMENTS).join(", ")})`,
      '  "angle": number (camera angle, in degrees, relative to eye level)',
      '  "lens": string (lens suggestion, e.g. "35mm", "85mm telephoto")',
      '  "framing": string (compositional framing, e.g. rule of thirds, centered)',
      `  "lighting": string (one of: ${Array.from(VALID_LIGHTING).join(", ")})`,
      `  "cameraHeight": string (one of: ${Array.from(VALID_CAMERA_HEIGHTS).join(", ")})`,
      '  "focusSubject": string (what/who the shot is focused on)',
      `  "transitionToNext": string (one of: ${Array.from(VALID_TRANSITIONS).join(", ")})`,
      '  "cinematicPurpose": string (why this shot serves the story here)',
      '  "durationSeconds": number (optional, planned shot length)',
      "",
      "Story blueprint:",
      `Title: ${story.title}`,
      `Theme: ${story.theme}`,
      `Conflict: ${story.conflict}`,
      `Visual style: ${story.visualStyle}`,
      `Ending style: ${story.endingStyle}`,
      `Emotional arc: ${story.emotionalArc.join(" -> ")}`,
      `Estimated scene count: ${story.estimatedSceneCount}`,
    ].join("\n");
  }

  /**
   * Parses and validates the language model's raw text response into a
   * strongly typed, scene-ordered array of camera plans.
   */
  private parseResponse(rawResponse: string, expectedSceneCount: number): CameraPlan[] {
    let parsed: RawCameraPlanResponse;

    console.log("========== CAMERA RAW RESPONSE ==========");
    console.log(rawResponse);
    console.log("=========================================");

    try {
      parsed = JSON.parse(rawResponse) as RawCameraPlanResponse;
    } catch {
      throw new CameraPlanParseError(
        "Language model response is not valid JSON.",
        rawResponse
      );
    }

    if (!Array.isArray(parsed.cameraPlans)) {
      throw new CameraPlanParseError(
        'Missing or invalid "cameraPlans" field.',
        rawResponse
      );
    }

    const seenSceneNumbers = new Set<number>();
    const usedIds = new Set<EntityId>();
    const plans: CameraPlan[] = parsed.cameraPlans.map((item) =>
      this.buildCameraPlan(item, seenSceneNumbers, usedIds, rawResponse)
    );

    if (plans.length !== expectedSceneCount) {
      throw new CameraPlanParseError(
        `Expected ${expectedSceneCount} camera plans (one per scene) but received ${plans.length}.`,
        rawResponse
      );
    }

    return plans.sort((a, b) => a.sceneNumber - b.sceneNumber);
  }

  /**
   * Validates a single raw camera plan entry and normalizes it into a
   * strongly typed CameraPlan using only OutputSchema v2 fields.
   */
  private buildCameraPlan(
    item: unknown,
    seenSceneNumbers: Set<number>,
    usedIds: Set<EntityId>,
    rawResponse: string
  ): CameraPlan {
    const raw = this.expectRawCameraPlan(item, rawResponse);

    const sceneNumber = this.expectPositiveInteger(raw.sceneNumber, "sceneNumber", rawResponse);
    if (seenSceneNumbers.has(sceneNumber)) {
      throw new CameraPlanParseError(
        `Duplicate sceneNumber in response: ${sceneNumber}`,
        rawResponse
      );
    }
    seenSceneNumbers.add(sceneNumber);

    return {
      id: this.generateCameraPlanId(sceneNumber, usedIds),
      sceneNumber,
      shot: this.expectEnum(raw.shot, VALID_SHOTS, "shot", rawResponse) as CameraShot,
      movement: this.expectEnum(raw.movement, VALID_MOVEMENTS, "movement", rawResponse) as CameraMovement,
      angle: this.expectNumber(raw.angle, "angle", rawResponse),
      lens: this.expectString(raw.lens, "lens", rawResponse),
      framing: this.expectString(raw.framing, "framing", rawResponse),
      lighting: this.expectEnum(raw.lighting, VALID_LIGHTING, "lighting", rawResponse) as Lighting,
      cameraHeight: this.expectEnum(
        raw.cameraHeight,
        VALID_CAMERA_HEIGHTS,
        "cameraHeight",
        rawResponse
      ) as CameraHeight,
      focusSubject: {
        description: this.expectString(raw.focusSubject, "focusSubject", rawResponse),
      },
      transitionToNext: this.expectEnum(
        raw.transitionToNext,
        VALID_TRANSITIONS,
        "transitionToNext",
        rawResponse
      ) as SceneTransition,
      cinematicPurpose: this.expectString(raw.cinematicPurpose, "cinematicPurpose", rawResponse),
      durationSeconds: this.expectOptionalNumber(raw.durationSeconds),
    };
  }

  /**
   * Generates a stable, human-readable, persistent, collision-free camera
   * plan ID derived from the scene number it belongs to.
   */
  private generateCameraPlanId(sceneNumber: number, usedIds: Set<EntityId>): EntityId {
    let candidate: EntityId = `cam-scene-${sceneNumber}`;
    let suffix = 1;
    while (usedIds.has(candidate)) {
      candidate = `cam-scene-${sceneNumber}-${suffix}`;
      suffix += 1;
    }

    usedIds.add(candidate);
    return candidate;
  }

  private expectRawCameraPlan(value: unknown, rawResponse: string): RawCameraPlan {
    if (typeof value !== "object" || value === null) {
      throw new CameraPlanParseError("Invalid camera plan entry.", rawResponse);
    }
    return value as RawCameraPlan;
  }

  private expectString(value: unknown, field: string, rawResponse: string): string {
    if (typeof value !== "string" || value.trim().length === 0) {
      throw new CameraPlanParseError(`Missing or invalid "${field}" field.`, rawResponse);
    }
    return value;
  }

  private expectNumber(value: unknown, field: string, rawResponse: string): number {
    if (typeof value !== "number" || Number.isNaN(value)) {
      throw new CameraPlanParseError(`Missing or invalid "${field}" field.`, rawResponse);
    }
    return value;
  }

  private expectOptionalNumber(value: unknown): number | undefined {
    return typeof value === "number" && !Number.isNaN(value) ? value : undefined;
  }

  private expectPositiveInteger(value: unknown, field: string, rawResponse: string): number {
    if (typeof value !== "number" || !Number.isInteger(value) || value < 1) {
      throw new CameraPlanParseError(`Missing or invalid "${field}" field.`, rawResponse);
    }
    return value;
  }

  private expectEnum(
    value: unknown,
    validValues: Set<string>,
    field: string,
    rawResponse: string
  ): string {
    if (typeof value !== "string" || !validValues.has(value)) {
      throw new CameraPlanParseError(`Missing or invalid "${field}" field.`, rawResponse);
    }
    return value;
  }
}
