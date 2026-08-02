/**
 * CharacterDirector.ts
 *
 * Extracts a persistent, deduplicated cast of Characters from a
 * StoryBlueprint, targeting OutputSchema v2. The actual language-model call
 * is abstracted behind an injected LanguageModelProvider (the same pattern
 * used by StoryAnalyzer), so this module contains no provider-specific code
 * and makes no network calls itself.
 */

import type { Character, AppearanceProfile, VoiceProfile, Emotion, EntityId } from "./OutputSchema";
import { Emotion as EmotionEnum } from "./OutputSchema";
import type { StoryBlueprint, LanguageModelProvider } from "./StoryAnalyzer";

/**
 * Raw, unvalidated shape of a single character as expected back from the
 * language model, before it is parsed and validated into a Character.
 */
interface RawCharacter {
  name?: unknown;
  description?: unknown;
  age?: unknown;
  gender?: unknown;
  build?: unknown;
  hairColor?: unknown;
  hairStyle?: unknown;
  eyeColor?: unknown;
  skinTone?: unknown;
  physicalTraits?: unknown;
  wardrobe?: unknown;
  personality?: unknown;
  emotionalBaseline?: unknown;
  voiceName?: unknown;
  voiceTone?: unknown;
  voiceLanguage?: unknown;
}

/**
 * Raw, unvalidated top-level shape expected back from the language model.
 */
interface RawCharacterResponse {
  characters?: unknown;
}

/**
 * Thrown when the language model's response cannot be parsed into a valid
 * set of Characters.
 */
export class CharacterParseError extends Error {
  constructor(message: string, public readonly rawResponse: string) {
    super(message);
    this.name = "CharacterParseError";
  }
}

const VALID_EMOTIONS = new Set<string>(Object.values(EmotionEnum));

/**
 * Extracts a complete, persistent cast of Characters from a StoryBlueprint
 * by delegating language generation to an injected LanguageModelProvider.
 * Populates OutputSchema v2's typed Character fields directly — personality,
 * emotional baseline, wardrobe, and physical traits are real fields, not
 * text folded into `description`.
 */
export class CharacterDirector {
  constructor(private readonly provider: LanguageModelProvider) {}

  /**
   * Extracts a deduplicated list of Characters from the given story,
   * assigning each a stable, persistent ID.
   */
  async extractCharacters(story: StoryBlueprint): Promise<Character[]> {
    try {
      console.log("C1 before buildPrompt");
      const prompt = this.buildPrompt(story);
      console.log("C2 after buildPrompt");

      console.log("C3 before provider.generate");
      const rawResponse = await this.provider.generate(prompt);
      console.log("C4 after provider.generate");

      console.log("C5 before parseResponse");
      const result = this.parseResponse(rawResponse);
      console.log("C6 after parseResponse");

      return result;
    } catch (error) {
      console.error("========== CHARACTER DIRECTOR ERROR ==========");
      console.error(error);
      if (error instanceof Error) console.error(error.stack);
      console.error("==============================================");

      throw error;
    }
  }

  /**
   * Builds the structured prompt instructing the language model to return
   * the story's cast as a single JSON object.
   */
  private buildPrompt(story: StoryBlueprint): string {
    return [
      "You are a professional casting and character designer for film.",
      "Given the story blueprint below, extract every distinct character who",
      "appears in the story. Do not list the same character more than once.",
      "Respond with ONLY a single valid JSON object — no markdown, no commentary.",
      "",
      'The JSON object must have exactly one field, "characters", an array',
      "where each item has exactly these fields:",
      '  "name": string',
      '  "description": string (narrative role/backstory summary)',
      '  "age": number (optional)',
      '  "gender": string (optional)',
      '  "build": string (optional)',
      '  "hairColor": string (optional)',
      '  "hairStyle": string (optional)',
      '  "eyeColor": string (optional)',
      '  "skinTone": string (optional)',
      '  "physicalTraits": string[] (notable physical traits)',
      '  "wardrobe": string[] (signature wardrobe items)',
      '  "personality": string[] (defining personality traits)',
      `  "emotionalBaseline": string (one of: ${Array.from(VALID_EMOTIONS).join(", ")})`,
      '  "voiceName": string (optional, a descriptive voice name)',
      '  "voiceTone": string (optional, e.g. "warm", "gravelly")',
      '  "voiceLanguage": string (optional, ISO 639-1 code, e.g. "en")',
      "",
      "Story blueprint:",
      `Title: ${story.title}`,
      `Theme: ${story.theme}`,
      `Target audience: ${story.targetAudience}`,
      `Conflict: ${story.conflict}`,
      `Ending style: ${story.endingStyle}`,
      `Visual style: ${story.visualStyle}`,
      `Emotional arc: ${story.emotionalArc.join(" -> ")}`,
    ].join("\n");
  }

  /**
   * Parses and validates the language model's raw text response into a
   * deduplicated, strongly typed Character array.
   */
  private parseResponse(rawResponse: string): Character[] {
    let parsed: RawCharacterResponse;

    try {
      parsed = JSON.parse(rawResponse) as RawCharacterResponse;
    } catch {
      throw new CharacterParseError(
        "Language model response is not valid JSON.",
        rawResponse
      );
    }

    if (!Array.isArray(parsed.characters)) {
      throw new CharacterParseError(
        'Missing or invalid "characters" field.',
        rawResponse
      );
    }

    const seenNames = new Set<string>();
    const usedIds = new Set<EntityId>();
    const characters: Character[] = [];

    for (const item of parsed.characters) {
      const raw = this.expectRawCharacter(item, rawResponse);
      const name = this.expectString(raw.name, "name", rawResponse);
      const normalizedName = name.trim().toLowerCase();

      // Never duplicate the same character.
      if (seenNames.has(normalizedName)) {
        continue;
      }
      seenNames.add(normalizedName);

      const id = this.generateCharacterId(name, usedIds);
      characters.push(this.buildCharacter(id, name, raw, rawResponse));
    }

    if (characters.length === 0) {
      throw new CharacterParseError(
        "No valid characters found in response.",
        rawResponse
      );
    }

    return characters;
  }

  /**
   * Normalizes a single validated raw character entry into a complete,
   * strongly typed Character profile using only OutputSchema v2 fields.
   */
  private buildCharacter(
    id: EntityId,
    name: string,
    raw: RawCharacter,
    rawResponse: string
  ): Character {
    const appearance: AppearanceProfile = {
      age: this.expectOptionalNumber(raw.age),
      gender: this.expectOptionalString(raw.gender),
      build: this.expectOptionalString(raw.build),
      hairColor: this.expectOptionalString(raw.hairColor),
      hairStyle: this.expectOptionalString(raw.hairStyle),
      eyeColor: this.expectOptionalString(raw.eyeColor),
      skinTone: this.expectOptionalString(raw.skinTone),
      consistencySeed: id,
    };

    const voiceProfile: VoiceProfile = {
      id: `${id}-voice`,
      voiceName: this.expectOptionalString(raw.voiceName),
      tone: this.expectOptionalString(raw.voiceTone),
      language: this.expectOptionalString(raw.voiceLanguage),
    };

    return {
      id,
      name,
      description: this.expectString(raw.description, "description", rawResponse),
      appearance,
      personality: this.expectStringArray(raw.personality, "personality", rawResponse),
      emotionalBaseline: this.expectEmotion(raw.emotionalBaseline, rawResponse),
      wardrobe: this.expectStringArray(raw.wardrobe, "wardrobe", rawResponse),
      physicalTraits: this.expectStringArray(raw.physicalTraits, "physicalTraits", rawResponse),
      voiceProfile,
      referenceImages: [],
    };
  }

  /**
   * Generates a stable, human-readable, persistent, collision-free
   * character ID derived from the character's name.
   */
  private generateCharacterId(name: string, usedIds: Set<EntityId>): EntityId {
    const slug =
      name
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "") || "character";

    let candidate: EntityId = `char-${slug}`;
    let suffix = 1;
    while (usedIds.has(candidate)) {
      candidate = `char-${slug}-${suffix}`;
      suffix += 1;
    }

    usedIds.add(candidate);
    return candidate;
  }

  private expectRawCharacter(value: unknown, rawResponse: string): RawCharacter {
    if (typeof value !== "object" || value === null) {
      throw new CharacterParseError("Invalid character entry.", rawResponse);
    }
    return value as RawCharacter;
  }

  private expectString(value: unknown, field: string, rawResponse: string): string {
    if (typeof value !== "string" || value.trim().length === 0) {
      throw new CharacterParseError(`Missing or invalid "${field}" field.`, rawResponse);
    }
    return value;
  }

  private expectOptionalString(value: unknown): string | undefined {
    return typeof value === "string" && value.trim().length > 0 ? value : undefined;
  }

  private expectOptionalNumber(value: unknown): number | undefined {
    return typeof value === "number" && !Number.isNaN(value) ? value : undefined;
  }

  /**
   * Validates an optional string array field, defaulting to an empty array
   * when absent so callers can rely on OutputSchema v2's non-optional
   * array fields (e.g. Character.personality) always being real arrays.
   */
  private expectStringArray(value: unknown, field: string, rawResponse: string): string[] {
    if (value === undefined || value === null) return [];
    if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
      throw new CharacterParseError(`Invalid "${field}" field.`, rawResponse);
    }
    return value as string[];
  }

  private expectEmotion(value: unknown, rawResponse: string): Emotion {
    if (typeof value !== "string" || !VALID_EMOTIONS.has(value)) {
      throw new CharacterParseError(
        `Missing or invalid "emotionalBaseline" field.`,
        rawResponse
      );
    }
    return value as Emotion;
  }
}
