/**
 * EmotionDirector.ts
 *
 * Produces one scene-level emotional plan per planned scene, given a
 * StoryBlueprint and the story's cast. This is a pre-production step: it no
 * longer depends on Scene[], since ScenePlanner (which produces Scene[])
 * itself depends on EmotionPlan[] — taking Scene[] here would create a
 * circular dependency between EmotionDirector and ScenePlanner. Scene
 * numbers are instead derived from `story.estimatedSceneCount`, and
 * characterStates are chosen by the language model from the full cast
 * rather than validated against a specific scene's roster (that roster
 * doesn't exist yet at this stage — ScenePlanner decides it afterward and
 * joins EmotionPlans in by scene number).
 *
 * The actual language-model call is abstracted behind an injected
 * LanguageModelProvider (the same interface used by StoryAnalyzer,
 * CharacterDirector, EnvironmentDirector, and CameraDirector), so this
 * module contains no provider-specific code and makes no network calls
 * itself.
 */

import type {
  EmotionPlan,
  CharacterEmotionState,
  Emotion,
  EmotionTransition,
  Character,
  EntityId,
} from "./OutputSchema";
import { Emotion as EmotionEnum, EmotionTransition as EmotionTransitionEnum } from "./OutputSchema";
import type { StoryBlueprint, LanguageModelProvider } from "./StoryAnalyzer";

/**
 * Raw, unvalidated shape of a single character emotional state as expected
 * back from the language model, before it is parsed and validated.
 */
interface RawCharacterEmotionState {
  characterId?: unknown;
  emotion?: unknown;
  intensity?: unknown;
  notes?: unknown;
}

/**
 * Raw, unvalidated shape of a single emotion plan as expected back from the
 * language model, before it is parsed and validated.
 */
interface RawEmotionPlan {
  sceneNumber?: unknown;
  dominantEmotion?: unknown;
  intensity?: unknown;
  transition?: unknown;
  audienceTarget?: unknown;
  pacingNotes?: unknown;
  characterStates?: unknown;
}

/**
 * Raw, unvalidated top-level shape expected back from the language model.
 */
interface RawEmotionPlanResponse {
  emotionPlans?: unknown;
}

/**
 * Thrown when the language model's response cannot be parsed into a valid
 * set of emotion plans.
 */
export class EmotionParseError extends Error {
  constructor(message: string, public readonly rawResponse: string) {
    super(message);
    this.name = "EmotionParseError";
  }
}

const VALID_EMOTIONS = new Set<string>(Object.values(EmotionEnum));
const VALID_TRANSITIONS = new Set<string>(Object.values(EmotionTransitionEnum));

/**
 * Plans the emotional throughline of every planned scene by delegating
 * language generation to an injected LanguageModelProvider. Populates
 * OutputSchema v2.1's scene-level EmotionPlan fields directly, including a
 * CharacterEmotionState for every character the model judges emotionally
 * present in that scene.
 */
export class EmotionDirector {
  constructor(private readonly provider: LanguageModelProvider) {}

  /**
   * Produces exactly one EmotionPlan per planned scene
   * (`story.estimatedSceneCount`), ordered by scene number.
   */
  async planEmotion(story: StoryBlueprint, characters: Character[]): Promise<EmotionPlan[]> {
    console.log("ENTER: EmotionDirector");

    console.log("E1 before buildPrompt");
    const prompt = this.buildPrompt(story, characters);
    console.log("E2 after buildPrompt");

    console.log("E3 before provider.generate");
    let rawResponse: string;
    try {
      rawResponse = await this.provider.generate(prompt);
    } catch (error) {
      console.error("EMOTION DIRECTOR ERROR");
      console.error(error);
      if (error instanceof Error) console.error(error.stack);
      throw error;
    }
    console.log("========== EMOTION RAW RESPONSE ==========");
    console.log(rawResponse);
    console.log("==========================================");
    console.log("E4 after provider.generate");

    console.log("E5 before parseResponse");
    let result: EmotionPlan[];
    try {
      result = this.parseResponse(rawResponse, characters, story.estimatedSceneCount);
    } catch (error) {
      console.error("EMOTION PARSE ERROR");
      console.error(error);
      if (error instanceof Error) console.error(error.stack);
      console.error(rawResponse);
      throw error;
    }
    console.log("E6 after parseResponse");

    console.log("EXIT: EmotionDirector");
    return result;
  }

  /**
   * Builds the structured prompt instructing the language model to return
   * one emotion plan per planned scene as a single JSON object.
   */
  private buildPrompt(story: StoryBlueprint, characters: Character[]): string {
    const characterLines = characters
      .map((character) => `  - id: "${character.id}", name: "${character.name}"`)
      .join("\n");

    return [
      "You are a professional film emotional-arc consultant.",
      `Given the story blueprint and cast below, produce exactly ${story.estimatedSceneCount}`,
      "emotion plans — one for each planned scene, numbered sequentially",
      `from 1 to ${story.estimatedSceneCount}.`,
      "Respond with ONLY a single valid JSON object — no markdown, no commentary.",
      "",
      'The JSON object must have exactly one field, "emotionPlans", an array',
      "where each item has exactly these fields:",
      '  "sceneNumber": number (1-based, unique, sequential)',
      `  "dominantEmotion": string (one of: ${Array.from(VALID_EMOTIONS).join(", ")})`,
      '  "intensity": number (integer, 1-10)',
      `  "transition": string (one of: ${Array.from(VALID_TRANSITIONS).join(", ")})`,
      '  "audienceTarget": string (the emotional response this scene should evoke in the audience)',
      '  "pacingNotes": string (rhythm/timing guidance supporting the intended emotional beat)',
      '  "characterStates": array with one entry per character emotionally present in this scene',
      "    (a non-empty subset of the cast below — not every character needs to appear in",
      "    every scene), each with these fields:",
      '    "characterId": string (must be one of the character ids listed below)',
      `    "emotion": string (one of: ${Array.from(VALID_EMOTIONS).join(", ")})`,
      '    "intensity": number (integer, 1-10)',
      '    "notes": string (optional)',
      "",
      "Cast:",
      characterLines,
      "",
      "Story blueprint:",
      `Title: ${story.title}`,
      `Theme: ${story.theme}`,
      `Conflict: ${story.conflict}`,
      `Ending style: ${story.endingStyle}`,
      `Emotional arc: ${story.emotionalArc.join(" -> ")}`,
    ].join("\n");
  }

  /**
   * Parses and validates the language model's raw text response into a
   * strongly typed, scene-ordered array of emotion plans.
   */
  private parseResponse(
    rawResponse: string,
    characters: Character[],
    expectedSceneCount: number
  ): EmotionPlan[] {
    let parsed: RawEmotionPlanResponse;

    try {
      parsed = JSON.parse(rawResponse) as RawEmotionPlanResponse;
    } catch {
      throw new EmotionParseError(
        "Language model response is not valid JSON.",
        rawResponse
      );
    }

    if (!Array.isArray(parsed.emotionPlans)) {
      throw new EmotionParseError(
        'Missing or invalid "emotionPlans" field.',
        rawResponse
      );
    }

    const knownCharacterIds = new Set(characters.map((character) => character.id));
    const seenSceneNumbers = new Set<number>();
    const usedIds = new Set<EntityId>();

    const plans = parsed.emotionPlans.map((item) =>
      this.buildEmotionPlan(item, knownCharacterIds, seenSceneNumbers, usedIds, rawResponse)
    );

    if (plans.length !== expectedSceneCount) {
      throw new EmotionParseError(
        `Expected ${expectedSceneCount} emotion plans (one per scene) but received ${plans.length}.`,
        rawResponse
      );
    }

    return plans.sort((a, b) => a.sceneNumber - b.sceneNumber);
  }

  /**
   * Validates a single raw emotion plan entry and normalizes it into a
   * strongly typed EmotionPlan.
   */
  private buildEmotionPlan(
    item: unknown,
    knownCharacterIds: Set<EntityId>,
    seenSceneNumbers: Set<number>,
    usedIds: Set<EntityId>,
    rawResponse: string
  ): EmotionPlan {
    const raw = this.expectRawEmotionPlan(item, rawResponse);

    const sceneNumber = this.expectPositiveInteger(raw.sceneNumber, "sceneNumber", rawResponse);
    if (seenSceneNumbers.has(sceneNumber)) {
      throw new EmotionParseError(
        `Duplicate sceneNumber in response: ${sceneNumber}`,
        rawResponse
      );
    }
    seenSceneNumbers.add(sceneNumber);

    return {
      id: this.generateEmotionPlanId(sceneNumber, usedIds),
      sceneNumber,
      dominantEmotion: this.expectEmotion(raw.dominantEmotion, "dominantEmotion", rawResponse),
      intensity: this.expectIntensity(raw.intensity, "intensity", rawResponse),
      transition: this.expectTransition(raw.transition, rawResponse),
      audienceTarget: this.expectString(raw.audienceTarget, "audienceTarget", rawResponse),
      pacingNotes: this.expectString(raw.pacingNotes, "pacingNotes", rawResponse),
      characterStates: this.expectCharacterStates(raw.characterStates, knownCharacterIds, rawResponse),
    };
  }

  /**
   * Validates the characterStates array against the overall known cast —
   * every characterId must be a real Character.id, with no duplicates
   * within a single plan.
   */
  private expectCharacterStates(
    value: unknown,
    knownCharacterIds: Set<EntityId>,
    rawResponse: string
  ): CharacterEmotionState[] {
    if (!Array.isArray(value) || value.length === 0) {
      throw new EmotionParseError('Missing or invalid "characterStates" field.', rawResponse);
    }

    const seenIds = new Set<EntityId>();
    return value.map((entry) => {
      const raw = this.expectRawCharacterEmotionState(entry, rawResponse);
      const characterId = this.expectString(raw.characterId, "characterId", rawResponse);

      if (!knownCharacterIds.has(characterId)) {
        throw new EmotionParseError(
          `characterStates references unknown characterId: ${characterId}`,
          rawResponse
        );
      }
      if (seenIds.has(characterId)) {
        throw new EmotionParseError(
          `Duplicate characterStates entry for characterId "${characterId}".`,
          rawResponse
        );
      }
      seenIds.add(characterId);

      return {
        characterId,
        emotion: this.expectEmotion(raw.emotion, "emotion", rawResponse),
        intensity: this.expectIntensity(raw.intensity, "intensity", rawResponse),
        notes: this.expectOptionalString(raw.notes),
      };
    });
  }

  /**
   * Generates a stable, human-readable, persistent, collision-free emotion
   * plan ID derived from the scene number it belongs to.
   */
  private generateEmotionPlanId(sceneNumber: number, usedIds: Set<EntityId>): EntityId {
    let candidate: EntityId = `emo-scene-${sceneNumber}`;
    let suffix = 1;
    while (usedIds.has(candidate)) {
      candidate = `emo-scene-${sceneNumber}-${suffix}`;
      suffix += 1;
    }

    usedIds.add(candidate);
    return candidate;
  }

  private expectRawEmotionPlan(value: unknown, rawResponse: string): RawEmotionPlan {
    if (typeof value !== "object" || value === null) {
      throw new EmotionParseError("Invalid emotion plan entry.", rawResponse);
    }
    return value as RawEmotionPlan;
  }

  private expectRawCharacterEmotionState(
    value: unknown,
    rawResponse: string
  ): RawCharacterEmotionState {
    if (typeof value !== "object" || value === null) {
      throw new EmotionParseError("Invalid characterStates entry.", rawResponse);
    }
    return value as RawCharacterEmotionState;
  }

  private expectString(value: unknown, field: string, rawResponse: string): string {
    if (typeof value !== "string" || value.trim().length === 0) {
      throw new EmotionParseError(`Missing or invalid "${field}" field.`, rawResponse);
    }
    return value;
  }

  private expectOptionalString(value: unknown): string | undefined {
    return typeof value === "string" && value.trim().length > 0 ? value : undefined;
  }

  private expectPositiveInteger(value: unknown, field: string, rawResponse: string): number {
    if (typeof value !== "number" || !Number.isInteger(value) || value < 1) {
      throw new EmotionParseError(`Missing or invalid "${field}" field.`, rawResponse);
    }
    return value;
  }

  private expectIntensity(value: unknown, field: string, rawResponse: string): number {
    if (typeof value !== "number" || !Number.isInteger(value) || value < 1 || value > 10) {
      throw new EmotionParseError(
        `Missing or invalid "${field}" field (expected integer 1-10).`,
        rawResponse
      );
    }
    return value;
  }

  private expectEmotion(value: unknown, field: string, rawResponse: string): Emotion {
    if (typeof value !== "string" || !VALID_EMOTIONS.has(value)) {
      throw new EmotionParseError(`Missing or invalid "${field}" field.`, rawResponse);
    }
    return value as Emotion;
  }

  private expectTransition(value: unknown, rawResponse: string): EmotionTransition {
    if (typeof value !== "string" || !VALID_TRANSITIONS.has(value)) {
      throw new EmotionParseError('Missing or invalid "transition" field.', rawResponse);
    }
    return value as EmotionTransition;
  }
}
