/**
 * CharacterConsistencyEngine.ts
 *
 * Second module of the Production Engine. Given a MovieBlueprint,
 * deterministically derives a CharacterConsistencyPack — one consistency
 * profile per character, summarizing every trait that must stay identical
 * across every generated frame, plus a ready-to-use reference-image
 * generation prompt for each character.
 *
 * Pure string/data composition over already-generated data. No network
 * calls, no language model calls, no randomness: given the same
 * MovieBlueprint, buildConsistencyPack always produces the same pack.
 *
 * Design note: composeReferencePrompt(characterId) takes only an ID, so it
 * cannot rebuild a prompt from nothing — the engine caches the characters
 * from the most recent buildConsistencyPack() call and composeReferencePrompt
 * queries that cache. This makes the engine "build once, query many," but
 * every computation involved remains deterministic and side-effect-free.
 *
 * Note on schema gaps: Character (OutputSchema v2.1) has no dedicated
 * "accessories" or "colorPalette" field.
 *   - accessories: there is no way to distinguish "accessory" items from
 *     general clothing within Character.wardrobe without guessing, so
 *     accessories is left as an empty array rather than misclassifying
 *     wardrobe entries.
 *   - colorPalette: derived from the character's own real color-bearing
 *     fields (hairColor, eyeColor, skinTone) rather than invented — not a
 *     designed wardrobe palette, but the actual colors already on record.
 */

import type { Character, EntityId } from "../director/OutputSchema";
import type { MovieBlueprint } from "../director/DirectorEngine";

/**
 * Thrown when composeReferencePrompt is called for a characterId that
 * hasn't been loaded via a prior buildConsistencyPack() call.
 */
export class CharacterConsistencyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CharacterConsistencyError";
  }
}

/**
 * The full consistency profile for a single character — every trait that
 * must remain identical across every scene and every generated frame.
 */
export interface CharacterConsistencyEntry {
  uniqueCharacterId: EntityId;
  masterDescription: string;
  appearanceSummary: string;
  wardrobeSummary: string;
  faceSummary: string;
  hairstyleSummary: string;
  bodySummary: string;
  accessories: string[];
  colorPalette: string[];
  prohibitedChanges: string[];
  referencePrompt: string;
}

/**
 * The complete set of per-character consistency profiles for one Movie.
 */
export interface CharacterConsistencyPack {
  movieId: EntityId;
  characters: CharacterConsistencyEntry[];
}

/**
 * Derives deterministic character-consistency data from a MovieBlueprint.
 * Pure data/string composition — no AI calls, no network access, no
 * randomness.
 */
export class CharacterConsistencyEngine {
  private characterCache = new Map<EntityId, Character>();

  /**
   * Builds the full CharacterConsistencyPack for a movie, and caches its
   * characters so composeReferencePrompt(characterId) can be called
   * afterward for any of them individually.
   */
  buildConsistencyPack(movie: MovieBlueprint): CharacterConsistencyPack {
    this.characterCache = new Map(movie.characters.map((character) => [character.id, character]));

    return {
      movieId: movie.movie.id,
      characters: movie.characters.map((character) => this.buildEntry(character)),
    };
  }

  /**
   * Returns the optimal reference-image generation prompt for a character
   * previously loaded via buildConsistencyPack(). Throws
   * CharacterConsistencyError if no pack has been built, or the character
   * is unknown.
   */
  composeReferencePrompt(characterId: EntityId): string {
    const character = this.characterCache.get(characterId);
    if (!character) {
      throw new CharacterConsistencyError(
        `Unknown characterId: ${characterId}. Call buildConsistencyPack() first.`
      );
    }
    return this.buildReferencePrompt(character);
  }

  // ── Entry assembly ─────────────────────────────────────────────────────

  private buildEntry(character: Character): CharacterConsistencyEntry {
    return {
      uniqueCharacterId: character.id,
      masterDescription: this.composeMasterDescription(character),
      appearanceSummary: this.composeAppearanceSummary(character),
      wardrobeSummary: this.composeWardrobeSummary(character),
      faceSummary: this.composeFaceSummary(character),
      hairstyleSummary: this.composeHairstyleSummary(character),
      bodySummary: this.composeBodySummary(character),
      accessories: this.composeAccessories(),
      colorPalette: this.composeColorPalette(character),
      prohibitedChanges: this.composeProhibitedChanges(character),
      referencePrompt: this.buildReferencePrompt(character),
    };
  }

  // ── Summary composers ──────────────────────────────────────────────────

  private composeMasterDescription(character: Character): string {
    return `${character.name} — ${character.description}`;
  }

  private composeAppearanceSummary(character: Character): string {
    const a = character.appearance;
    const parts: string[] = [];
    if (a.age !== undefined) parts.push(`${a.age}-year-old`);
    if (a.gender) parts.push(a.gender);
    if (a.build) parts.push(`${a.build} build`);
    if (a.hairColor || a.hairStyle) {
      parts.push(`${[a.hairColor, a.hairStyle].filter(Boolean).join(" ")} hair`);
    }
    if (a.eyeColor) parts.push(`${a.eyeColor} eyes`);
    if (a.skinTone) parts.push(`${a.skinTone} skin`);
    if (character.physicalTraits.length > 0) {
      parts.push(`notable traits: ${character.physicalTraits.join(", ")}`);
    }
    return parts.length > 0
      ? this.capitalize(parts.join(", ")) + "."
      : "No detailed appearance recorded — maintain consistent identity from reference images.";
  }

  private composeWardrobeSummary(character: Character): string {
    return character.wardrobe.length > 0
      ? `Signature wardrobe: ${character.wardrobe.join(", ")}.`
      : "No signature wardrobe recorded.";
  }

  private composeFaceSummary(character: Character): string {
    const a = character.appearance;
    const parts: string[] = [];
    if (a.eyeColor) parts.push(`${a.eyeColor} eyes`);
    if (a.skinTone) parts.push(`${a.skinTone} skin tone`);
    return parts.length > 0
      ? this.capitalize(parts.join(", ")) + "."
      : "No specific facial coloring recorded — maintain consistent facial identity from reference images.";
  }

  private composeHairstyleSummary(character: Character): string {
    const a = character.appearance;
    if (!a.hairColor && !a.hairStyle) {
      return "No hairstyle recorded — maintain consistent hair from reference images.";
    }
    const color = a.hairColor ? `${a.hairColor} ` : "";
    const style = a.hairStyle ? `styled as ${a.hairStyle}` : "hair";
    return this.capitalize(`${color}hair, ${style}.`);
  }

  private composeBodySummary(character: Character): string {
    const a = character.appearance;
    const parts: string[] = [];
    if (a.build) parts.push(`${a.build} build`);
    if (character.physicalTraits.length > 0) {
      parts.push(`physical traits: ${character.physicalTraits.join(", ")}`);
    }
    return parts.length > 0
      ? this.capitalize(parts.join(", ")) + "."
      : "No detailed body description recorded — maintain consistent physique from reference images.";
  }

  /**
   * Character has no dedicated accessories field distinct from wardrobe;
   * left empty rather than guessing which wardrobe entries are accessories.
   */
  private composeAccessories(): string[] {
    return [];
  }

  /**
   * Aggregates the character's own real color-bearing fields (not an
   * invented palette).
   */
  private composeColorPalette(character: Character): string[] {
    const a = character.appearance;
    return [a.hairColor, a.eyeColor, a.skinTone].filter(
      (value): value is string => typeof value === "string" && value.trim().length > 0
    );
  }

  /**
   * One deterministic prohibition per populated identity attribute, plus a
   * standing facial-identity rule that always applies.
   */
  private composeProhibitedChanges(character: Character): string[] {
    const a = character.appearance;
    const rules: string[] = [];

    if (a.age !== undefined) rules.push("Do not alter apparent age.");
    if (a.gender) rules.push("Do not alter gender presentation.");
    if (a.build) rules.push("Do not alter body build or physique.");
    if (a.hairColor || a.hairStyle) rules.push("Do not alter hair color or hairstyle.");
    if (a.eyeColor) rules.push("Do not alter eye color.");
    if (a.skinTone) rules.push("Do not alter skin tone.");
    if (character.wardrobe.length > 0) {
      rules.push("Do not add, remove, or substitute signature wardrobe items.");
    }
    if (character.physicalTraits.length > 0) {
      rules.push("Do not remove or alter the character's distinguishing physical traits.");
    }
    rules.push("Maintain identical facial structure and identity across all frames and scenes.");

    return rules;
  }

  // ── Reference prompt ───────────────────────────────────────────────────

  private buildReferencePrompt(character: Character): string {
    const sections = [
      `CHARACTER REFERENCE SHEET: ${character.name}`,
      this.composeMasterDescription(character),
      `Face: ${this.composeFaceSummary(character)}`,
      `Hair: ${this.composeHairstyleSummary(character)}`,
      `Body: ${this.composeBodySummary(character)}`,
      `Wardrobe: ${this.composeWardrobeSummary(character)}`,
      "Pose: neutral standing pose, arms relaxed at sides, facing camera.",
      "Composition: full-body turnaround plus a separate close-up facial portrait, plain neutral background, even studio lighting.",
      "Purpose: canonical visual reference for maintaining character consistency across every subsequent generated scene.",
    ];

    return sections.join("\n");
  }

  // ── Formatting utilities ───────────────────────────────────────────────

  private capitalize(value: string): string {
    return value.length > 0 ? value.charAt(0).toUpperCase() + value.slice(1) : value;
  }
}
