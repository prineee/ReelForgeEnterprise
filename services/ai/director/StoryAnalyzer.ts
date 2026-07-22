/**
 * StoryAnalyzer.ts
 *
 * Turns a free-form user idea into a structured StoryBlueprint. The actual
 * language-model call is abstracted behind an injected LanguageModelProvider,
 * so this module contains no provider-specific code and makes no network
 * calls itself.
 */

import { Genre } from "./OutputSchema";

/**
 * Structured creative blueprint produced by analyzing a raw user idea.
 * Serves as the seed input for downstream Movie/Scene generation.
 */
export interface StoryBlueprint {
  title: string;
  genre: Genre[];
  theme: string;
  targetAudience: string;
  /** Estimated total runtime, in seconds. */
  estimatedDuration: number;
  estimatedSceneCount: number;
  conflict: string;
  endingStyle: string;
  /** Ordered beats describing how tone/intensity shifts across the story. */
  emotionalArc: string[];
  visualStyle: string;
  productionNotes?: string;
}

/**
 * Minimal contract for a language model capable of turning a text prompt
 * into a text completion. StoryAnalyzer is provider-agnostic — any
 * implementation (a hosted LLM API, a local model, a test double) can be
 * injected without this module knowing which one it is.
 */
export interface LanguageModelProvider {
  generate(prompt: string): Promise<string>;
}

/**
 * Raw, unvalidated shape expected back from the language model as JSON text,
 * before it is parsed and validated into a StoryBlueprint.
 */
interface RawStoryBlueprint {
  title?: unknown;
  genre?: unknown;
  theme?: unknown;
  targetAudience?: unknown;
  estimatedDuration?: unknown;
  estimatedSceneCount?: unknown;
  conflict?: unknown;
  endingStyle?: unknown;
  emotionalArc?: unknown;
  visualStyle?: unknown;
  productionNotes?: unknown;
}

/**
 * Thrown when the language model's response cannot be parsed into a valid
 * StoryBlueprint.
 */
export class StoryBlueprintParseError extends Error {
  constructor(message: string, public readonly rawResponse: string) {
    super(message);
    this.name = "StoryBlueprintParseError";
  }
}

const VALID_GENRES = new Set<string>(Object.values(Genre));

/**
 * Analyzes a free-form user idea and produces a structured StoryBlueprint by
 * delegating language generation to an injected LanguageModelProvider.
 */
export class StoryAnalyzer {
  constructor(private readonly provider: LanguageModelProvider) {}

  /**
   * Turns a raw user idea into a structured, validated StoryBlueprint.
   */
  async analyze(userIdea: string): Promise<StoryBlueprint> {
    try {
      console.log("A1 before buildPrompt");
      const prompt = this.buildPrompt(userIdea);
      console.log("A2 after buildPrompt");

      console.log("A3 before provider.generate");
      const raw = await this.provider.generate(prompt);
      console.log("A4 after provider.generate");

      console.log("A5 before parseResponse");
      const result = this.parseResponse(raw);
      console.log("A6 after parseResponse");

      return result;
    } catch (error) {
      console.error("========== STORY ANALYZER ERROR ==========");
      console.error(error);
      if (error instanceof Error) {
        console.error(error.stack);
      }
      console.error("==========================================");

      throw error;
    }
  }

  /**
   * Builds the structured prompt instructing the language model to return a
   * StoryBlueprint as a single JSON object.
   */
  private buildPrompt(userIdea: string): string {
    return [
      "You are a professional film story analyst.",
      "Analyze the user's idea below and produce a structured story blueprint.",
      "Respond with ONLY a single valid JSON object — no markdown, no commentary.",
      "",
      "The JSON object must have exactly these fields:",
      '  "title": string',
      `  "genre": string[] (each value one of: ${Array.from(VALID_GENRES).join(", ")})`,
      '  "theme": string',
      '  "targetAudience": string',
      '  "estimatedDuration": number (total runtime in seconds)',
      '  "estimatedSceneCount": number',
      '  "conflict": string',
      '  "endingStyle": string',
      '  "emotionalArc": string[] (ordered emotional beats across the story)',
      '  "visualStyle": string',
      '  "productionNotes": string (optional)',
      "",
      "User idea:",
      userIdea,
    ].join("\n");
  }

  /**
   * Parses and validates the language model's raw text response into a
   * strongly typed StoryBlueprint.
   */
  private parseResponse(rawResponse: string): StoryBlueprint {
    let parsed: RawStoryBlueprint;

    try {
      parsed = JSON.parse(rawResponse) as RawStoryBlueprint;
    } catch {
      throw new StoryBlueprintParseError(
        "Language model response is not valid JSON.",
        rawResponse
      );
    }

    return {
      title: this.expectString(parsed.title, "title", rawResponse),
      genre: this.expectGenreArray(parsed.genre, rawResponse),
      theme: this.expectString(parsed.theme, "theme", rawResponse),
      targetAudience: this.expectString(parsed.targetAudience, "targetAudience", rawResponse),
      estimatedDuration: this.expectNumber(parsed.estimatedDuration, "estimatedDuration", rawResponse),
      estimatedSceneCount: this.expectNumber(parsed.estimatedSceneCount, "estimatedSceneCount", rawResponse),
      conflict: this.expectString(parsed.conflict, "conflict", rawResponse),
      endingStyle: this.expectString(parsed.endingStyle, "endingStyle", rawResponse),
      emotionalArc: this.expectStringArray(parsed.emotionalArc, "emotionalArc", rawResponse),
      visualStyle: this.expectString(parsed.visualStyle, "visualStyle", rawResponse),
      productionNotes:
        typeof parsed.productionNotes === "string" ? parsed.productionNotes : undefined,
    };
  }

  private expectString(value: unknown, field: string, rawResponse: string): string {
    if (typeof value !== "string" || value.trim().length === 0) {
      throw new StoryBlueprintParseError(`Missing or invalid "${field}" field.`, rawResponse);
    }
    return value;
  }

  private expectNumber(value: unknown, field: string, rawResponse: string): number {
    if (typeof value !== "number" || Number.isNaN(value)) {
      throw new StoryBlueprintParseError(`Missing or invalid "${field}" field.`, rawResponse);
    }
    return value;
  }

  private expectStringArray(value: unknown, field: string, rawResponse: string): string[] {
    if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
      throw new StoryBlueprintParseError(`Missing or invalid "${field}" field.`, rawResponse);
    }
    return value as string[];
  }

  private expectGenreArray(value: unknown, rawResponse: string): Genre[] {
    if (!Array.isArray(value) || value.length === 0) {
      throw new StoryBlueprintParseError('Missing or invalid "genre" field.', rawResponse);
    }

    return value.map((item) => {
      if (typeof item !== "string" || !VALID_GENRES.has(item)) {
        throw new StoryBlueprintParseError(`Invalid genre value: ${String(item)}`, rawResponse);
      }
      return item as Genre;
    });
  }
}
