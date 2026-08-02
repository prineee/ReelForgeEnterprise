/**
 * EnvironmentDirector.ts
 *
 * Extracts a persistent, deduplicated list of Environments (locations) from
 * a StoryBlueprint, targeting OutputSchema v2. The actual language-model
 * call is abstracted behind an injected LanguageModelProvider (the same
 * interface used by StoryAnalyzer and CharacterDirector), so this module
 * contains no provider-specific code and makes no network calls itself.
 */

import type { Environment, EntityId, Weather, Lighting, TimeOfDay } from "./OutputSchema";
import {
  Weather as WeatherEnum,
  Lighting as LightingEnum,
  TimeOfDay as TimeOfDayEnum,
} from "./OutputSchema";
import type { StoryBlueprint, LanguageModelProvider } from "./StoryAnalyzer";

/**
 * Raw, unvalidated shape of a single environment as expected back from the
 * language model, before it is parsed and validated into an Environment.
 */
interface RawEnvironment {
  name?: unknown;
  description?: unknown;
  location?: unknown;
  architecture?: unknown;
  weather?: unknown;
  lighting?: unknown;
  timeOfDay?: unknown;
  atmosphere?: unknown;
  props?: unknown;
  ambientSound?: unknown;
  dominantColors?: unknown;
  continuityNotes?: unknown;
}

/**
 * Raw, unvalidated top-level shape expected back from the language model.
 */
interface RawEnvironmentResponse {
  environments?: unknown;
}

/**
 * Thrown when the language model's response cannot be parsed into a valid
 * set of Environments.
 */
export class EnvironmentParseError extends Error {
  constructor(message: string, public readonly rawResponse: string) {
    super(message);
    this.name = "EnvironmentParseError";
  }
}

const VALID_WEATHER = new Set<string>(Object.values(WeatherEnum));
const VALID_LIGHTING = new Set<string>(Object.values(LightingEnum));
const VALID_TIME_OF_DAY = new Set<string>(Object.values(TimeOfDayEnum));

/**
 * Extracts a complete, persistent list of Environments from a
 * StoryBlueprint by delegating language generation to an injected
 * LanguageModelProvider. Populates OutputSchema v2's typed Environment
 * fields directly — architecture, atmosphere, props, ambient sound,
 * dominant colors, and time of day are real fields, not text folded into
 * `description`/`continuityNotes`.
 */
export class EnvironmentDirector {
  constructor(private readonly provider: LanguageModelProvider) {}

  /**
   * Extracts a deduplicated list of Environments from the given story,
   * assigning each a stable, persistent ID.
   */
  async extractEnvironments(story: StoryBlueprint): Promise<Environment[]> {
    console.log("E1 before buildPrompt");
    const prompt = this.buildPrompt(story);
    console.log("E2 after buildPrompt");

    console.log("E3 before provider.generate");
    let rawResponse: string;
    try {
      rawResponse = await this.provider.generate(prompt);
    } catch (error) {
      console.error("ENVIRONMENT DIRECTOR ERROR:");
      console.error(error);
      if (error instanceof Error) console.error(error.stack);
      throw error;
    }
    console.log("E4 after provider.generate");

    console.log("E5 before parseResponse");
    const result = this.parseResponse(rawResponse);
    console.log("E6 after parseResponse");

    return result;
  }

  /**
   * Builds the structured prompt instructing the language model to return
   * the story's locations as a single JSON object.
   */
  private buildPrompt(story: StoryBlueprint): string {
    return [
      "You are a professional production designer for film.",
      "Given the story blueprint below, extract every distinct location the",
      "story takes place in. Do not list the same location more than once.",
      "Respond with ONLY a single valid JSON object — no markdown, no commentary.",
      "",
      'The JSON object must have exactly one field, "environments", an array',
      "where each item has exactly these fields:",
      '  "name": string',
      '  "description": string (what the place looks and feels like)',
      '  "location": string (geographic/setting context)',
      '  "architecture": string (structural/architectural style)',
      '  "atmosphere": string (mood/ambience)',
      '  "props": string[] (notable set pieces/objects)',
      '  "ambientSound": string (background/ambient sound of the place)',
      '  "dominantColors": string[] (dominant color palette, names or hex)',
      `  "timeOfDay": string (one of: ${Array.from(VALID_TIME_OF_DAY).join(", ")})`,
      `  "weather": string (optional, one of: ${Array.from(VALID_WEATHER).join(", ")})`,
      `  "lighting": string (optional, one of: ${Array.from(VALID_LIGHTING).join(", ")})`,
      '  "continuityNotes": string (optional, details that must stay consistent)',
      "",
      "Story blueprint:",
      `Title: ${story.title}`,
      `Theme: ${story.theme}`,
      `Conflict: ${story.conflict}`,
      `Visual style: ${story.visualStyle}`,
      `Ending style: ${story.endingStyle}`,
      `Emotional arc: ${story.emotionalArc.join(" -> ")}`,
    ].join("\n");
  }

  /**
   * Parses and validates the language model's raw text response into a
   * deduplicated, strongly typed Environment array.
   */
  private parseResponse(rawResponse: string): Environment[] {
    let parsed: RawEnvironmentResponse;

    try {
      parsed = JSON.parse(rawResponse) as RawEnvironmentResponse;
    } catch {
      throw new EnvironmentParseError(
        "Language model response is not valid JSON.",
        rawResponse
      );
    }

    if (!Array.isArray(parsed.environments)) {
      throw new EnvironmentParseError(
        'Missing or invalid "environments" field.',
        rawResponse
      );
    }

    const seenNames = new Set<string>();
    const usedIds = new Set<EntityId>();
    const environments: Environment[] = [];

    for (const item of parsed.environments) {
      const raw = this.expectRawEnvironment(item, rawResponse);
      const name = this.expectString(raw.name, "name", rawResponse);
      const normalizedName = name.trim().toLowerCase();

      // Never duplicate locations.
      if (seenNames.has(normalizedName)) {
        continue;
      }
      seenNames.add(normalizedName);

      const id = this.generateEnvironmentId(name, usedIds);
      environments.push(this.buildEnvironment(id, name, raw, rawResponse));
    }

    if (environments.length === 0) {
      throw new EnvironmentParseError(
        "No valid environments found in response.",
        rawResponse
      );
    }

    return environments;
  }

  /**
   * Normalizes a single validated raw environment entry into a complete,
   * strongly typed Environment using only OutputSchema v2 fields.
   */
  private buildEnvironment(
    id: EntityId,
    name: string,
    raw: RawEnvironment,
    rawResponse: string
  ): Environment {
    return {
      id,
      name,
      description: this.expectString(raw.description, "description", rawResponse),
      location: this.expectString(raw.location, "location", rawResponse),
      architecture: this.expectString(raw.architecture, "architecture", rawResponse),
      atmosphere: this.expectString(raw.atmosphere, "atmosphere", rawResponse),
      props: this.expectStringArray(raw.props, "props", rawResponse),
      ambientSound: this.expectString(raw.ambientSound, "ambientSound", rawResponse),
      dominantColors: this.expectStringArray(raw.dominantColors, "dominantColors", rawResponse),
      timeOfDay: this.expectTimeOfDay(raw.timeOfDay, rawResponse),
      weather: this.expectOptionalWeather(raw.weather, rawResponse),
      lighting: this.expectOptionalLighting(raw.lighting, rawResponse),
      continuityNotes: this.expectOptionalString(raw.continuityNotes),
      referenceImages: [],
    };
  }

  /**
   * Generates a stable, human-readable, persistent, collision-free
   * environment ID derived from the location's name.
   */
  private generateEnvironmentId(name: string, usedIds: Set<EntityId>): EntityId {
    const slug =
      name
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "") || "environment";

    let candidate: EntityId = `env-${slug}`;
    let suffix = 1;
    while (usedIds.has(candidate)) {
      candidate = `env-${slug}-${suffix}`;
      suffix += 1;
    }

    usedIds.add(candidate);
    return candidate;
  }

  private expectRawEnvironment(value: unknown, rawResponse: string): RawEnvironment {
    if (typeof value !== "object" || value === null) {
      throw new EnvironmentParseError("Invalid environment entry.", rawResponse);
    }
    return value as RawEnvironment;
  }

  private expectString(value: unknown, field: string, rawResponse: string): string {
    if (typeof value !== "string" || value.trim().length === 0) {
      throw new EnvironmentParseError(`Missing or invalid "${field}" field.`, rawResponse);
    }
    return value;
  }

  private expectOptionalString(value: unknown): string | undefined {
    return typeof value === "string" && value.trim().length > 0 ? value : undefined;
  }

  /**
   * Validates an optional string array field, defaulting to an empty array
   * when absent so callers can rely on OutputSchema v2's non-optional
   * array fields (e.g. Environment.props) always being real arrays.
   */
  private expectStringArray(value: unknown, field: string, rawResponse: string): string[] {
    if (value === undefined || value === null) return [];
    if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
      throw new EnvironmentParseError(`Invalid "${field}" field.`, rawResponse);
    }
    return value as string[];
  }

  private expectOptionalWeather(value: unknown, rawResponse: string): Weather | undefined {
    if (value === undefined || value === null) return undefined;
    if (typeof value !== "string" || !VALID_WEATHER.has(value)) {
      throw new EnvironmentParseError(`Invalid weather value: ${String(value)}`, rawResponse);
    }
    return value as Weather;
  }

  private expectOptionalLighting(value: unknown, rawResponse: string): Lighting | undefined {
    if (value === undefined || value === null) return undefined;
    if (typeof value !== "string" || !VALID_LIGHTING.has(value)) {
      throw new EnvironmentParseError(`Invalid lighting value: ${String(value)}`, rawResponse);
    }
    return value as Lighting;
  }

  private expectTimeOfDay(value: unknown, rawResponse: string): TimeOfDay {
    if (typeof value !== "string" || !VALID_TIME_OF_DAY.has(value)) {
      throw new EnvironmentParseError(`Missing or invalid "timeOfDay" field.`, rawResponse);
    }
    return value as TimeOfDay;
  }
}
