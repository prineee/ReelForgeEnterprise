/**
 * ScenePlanner.ts
 *
 * Assembles one Scene per planned scene number, joining a StoryBlueprint's
 * cast and locations with an already-produced set of CameraPlans and
 * EmotionPlans. The actual language-model call is abstracted behind an
 * injected LanguageModelProvider (the same interface used by StoryAnalyzer,
 * CharacterDirector, EnvironmentDirector, CameraDirector, and
 * EmotionDirector), so this module contains no provider-specific code and
 * makes no network calls itself.
 *
 * Design note: CameraPlan and EmotionPlan already carry their own
 * `sceneNumber`, so ScenePlanner joins each Scene to its CameraPlan and
 * EmotionPlan by matching scene number rather than asking the language
 * model to invent or copy IDs — this makes "every CameraPlan/EmotionPlan
 * used exactly once" a structural guarantee instead of something the model
 * could get wrong. Likewise, voiceActors is derived from each selected
 * Character's own `voiceProfile.id` rather than requested from the model.
 */

import type {
  Scene,
  Character,
  Environment,
  CameraPlan,
  EmotionPlan,
  DialogueLine,
  VoiceActorAssignment,
  MusicCue,
  SoundEffectCue,
  EntityId,
} from "./OutputSchema";
import type { StoryBlueprint, LanguageModelProvider } from "./StoryAnalyzer";

/**
 * Raw, unvalidated shape of a single dialogue placeholder line as expected
 * back from the language model.
 */
interface RawDialogueLine {
  characterId?: unknown;
  text?: unknown;
}

/**
 * Raw, unvalidated shape of a background music placeholder as expected
 * back from the language model.
 */
interface RawMusicCue {
  style?: unknown;
  moodTags?: unknown;
}

/**
 * Raw, unvalidated shape of a single scene draft as expected back from the
 * language model, before it is parsed and validated into a Scene.
 */
interface RawScene {
  sceneNumber?: unknown;
  title?: unknown;
  summary?: unknown;
  characterIds?: unknown;
  environmentId?: unknown;
  dialogue?: unknown;
  backgroundMusic?: unknown;
  soundEffects?: unknown;
  estimatedRenderCost?: unknown;
  estimatedRenderTime?: unknown;
}

/**
 * Raw, unvalidated top-level shape expected back from the language model.
 */
interface RawScenePlannerResponse {
  scenes?: unknown;
}

/**
 * Thrown when the inputs to ScenePlanner are malformed/inconsistent, or
 * when the language model's response cannot be parsed into a valid set of
 * Scenes. `rawResponse` is an empty string for input-validation failures,
 * since those occur before any language-model call is made.
 */
export class ScenePlannerParseError extends Error {
  constructor(message: string, public readonly rawResponse: string) {
    super(message);
    this.name = "ScenePlannerParseError";
  }
}

/**
 * Assembles the final Scene list for a Movie by delegating language
 * generation to an injected LanguageModelProvider.
 */
export class ScenePlanner {
  constructor(private readonly provider: LanguageModelProvider) {}

  /**
   * Produces exactly one Scene per scene number shared by `cameraPlans` and
   * `emotionPlans`, referencing a CameraPlan, EmotionPlan, Environment, and
   * one or more Characters for each.
   */
  async planScenes(
    story: StoryBlueprint,
    characters: Character[],
    environments: Environment[],
    cameraPlans: CameraPlan[],
    emotionPlans: EmotionPlan[]
  ): Promise<Scene[]> {
    const sceneNumbers = this.validateInputs(characters, environments, cameraPlans, emotionPlans);

    const prompt = this.buildPrompt(story, characters, environments, sceneNumbers);
    const rawResponse = await this.provider.generate(prompt);

    const scenes = this.parseResponse(
      rawResponse,
      sceneNumbers,
      characters,
      environments,
      cameraPlans,
      emotionPlans
    );

    this.validateCoverage(scenes, characters, environments);

    return scenes;
  }

  /**
   * Validates the inputs before any language-model call: unique IDs, unique
   * scene numbers, and that CameraPlan/EmotionPlan cover exactly the same
   * set of scene numbers. Returns the sorted, shared scene numbers.
   */
  private validateInputs(
    characters: Character[],
    environments: Environment[],
    cameraPlans: CameraPlan[],
    emotionPlans: EmotionPlan[]
  ): number[] {
    if (characters.length === 0) {
      throw new ScenePlannerParseError("No characters provided.", "");
    }
    if (environments.length === 0) {
      throw new ScenePlannerParseError("No environments provided.", "");
    }
    if (cameraPlans.length === 0 || emotionPlans.length === 0) {
      throw new ScenePlannerParseError("No camera plans or emotion plans provided.", "");
    }

    this.assertUnique(characters.map((c) => c.id), "Character.id");
    this.assertUnique(environments.map((e) => e.id), "Environment.id");
    this.assertUnique(cameraPlans.map((p) => p.id), "CameraPlan.id");
    this.assertUnique(emotionPlans.map((p) => p.id), "EmotionPlan.id");

    const cameraSceneNumbers = cameraPlans.map((p) => p.sceneNumber);
    const emotionSceneNumbers = emotionPlans.map((p) => p.sceneNumber);
    this.assertUnique(cameraSceneNumbers, "CameraPlan.sceneNumber");
    this.assertUnique(emotionSceneNumbers, "EmotionPlan.sceneNumber");

    const cameraSet = new Set(cameraSceneNumbers);
    const emotionSet = new Set(emotionSceneNumbers);
    const cameraOnly = cameraSceneNumbers.filter((n) => !emotionSet.has(n));
    const emotionOnly = emotionSceneNumbers.filter((n) => !cameraSet.has(n));

    if (cameraOnly.length > 0 || emotionOnly.length > 0) {
      throw new ScenePlannerParseError(
        `CameraPlan and EmotionPlan scene numbers do not match. ` +
          `Camera-only: [${cameraOnly.join(", ")}]. Emotion-only: [${emotionOnly.join(", ")}].`,
        ""
      );
    }

    return [...cameraSet].sort((a, b) => a - b);
  }

  private assertUnique(values: Array<string | number>, label: string): void {
    const seen = new Set<string | number>();
    for (const value of values) {
      if (seen.has(value)) {
        throw new ScenePlannerParseError(`Duplicate ${label}: ${value}`, "");
      }
      seen.add(value);
    }
  }

  /**
   * Builds the structured prompt instructing the language model to return
   * one scene draft per scene number as a single JSON object.
   */
  private buildPrompt(
    story: StoryBlueprint,
    characters: Character[],
    environments: Environment[],
    sceneNumbers: number[]
  ): string {
    const characterLines = characters
      .map((c) => `  - id: "${c.id}", name: "${c.name}"`)
      .join("\n");
    const environmentLines = environments
      .map((e) => `  - id: "${e.id}", name: "${e.name}"`)
      .join("\n");

    return [
      "You are a professional script supervisor and scene planner for film.",
      `Given the story blueprint, cast, and locations below, draft exactly ${sceneNumbers.length}`,
      `scenes, one for each of these scene numbers: ${sceneNumbers.join(", ")}.`,
      "Respond with ONLY a single valid JSON object — no markdown, no commentary.",
      "",
      'The JSON object must have exactly one field, "scenes", an array where',
      "each item has exactly these fields:",
      `  "sceneNumber": number (one of: ${sceneNumbers.join(", ")}, unique)`,
      '  "title": string',
      '  "summary": string (what happens in the scene)',
      '  "characterIds": string[] (non-empty subset of the available character ids below)',
      '  "environmentId": string (one of the available environment ids below)',
      '  "dialogue": array of { "characterId": string, "text": string } placeholder lines',
      "    (characterId must be one of this scene's characterIds; [] if no dialogue)",
      '  "backgroundMusic": { "style": string, "moodTags": string[] } (placeholder direction, optional)',
      '  "soundEffects": string[] (placeholder sound effect names, optional)',
      '  "estimatedRenderCost": number (rough platform-credit estimate)',
      '  "estimatedRenderTime": number (rough wall-clock seconds estimate)',
      "",
      "Available characters:",
      characterLines,
      "",
      "Available environments:",
      environmentLines,
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
   * strongly typed, scene-ordered array of Scenes.
   */
  private parseResponse(
    rawResponse: string,
    sceneNumbers: number[],
    characters: Character[],
    environments: Environment[],
    cameraPlans: CameraPlan[],
    emotionPlans: EmotionPlan[]
  ): Scene[] {
    let parsed: RawScenePlannerResponse;

    try {
      parsed = JSON.parse(rawResponse) as RawScenePlannerResponse;
    } catch {
      throw new ScenePlannerParseError(
        "Language model response is not valid JSON.",
        rawResponse
      );
    }

    if (!Array.isArray(parsed.scenes)) {
      throw new ScenePlannerParseError('Missing or invalid "scenes" field.', rawResponse);
    }

    const characterIds = new Set(characters.map((c) => c.id));
    const environmentIds = new Set(environments.map((e) => e.id));
    const characterById = new Map(characters.map((c) => [c.id, c]));
    const cameraPlanByScene = new Map(cameraPlans.map((p) => [p.sceneNumber, p]));
    const emotionPlanByScene = new Map(emotionPlans.map((p) => [p.sceneNumber, p]));
    const expectedSceneNumbers = new Set(sceneNumbers);
    const seenSceneNumbers = new Set<number>();

    const scenes = parsed.scenes.map((item) =>
      this.buildScene(
        item,
        expectedSceneNumbers,
        seenSceneNumbers,
        characterIds,
        environmentIds,
        characterById,
        cameraPlanByScene,
        emotionPlanByScene,
        rawResponse
      )
    );

    const missing = sceneNumbers.filter((n) => !seenSceneNumbers.has(n));
    if (missing.length > 0) {
      throw new ScenePlannerParseError(
        `Missing scenes for scene number(s): ${missing.join(", ")}.`,
        rawResponse
      );
    }

    if (scenes.length !== sceneNumbers.length) {
      throw new ScenePlannerParseError(
        `Expected ${sceneNumbers.length} scenes but received ${scenes.length}.`,
        rawResponse
      );
    }

    return scenes.sort((a, b) => a.sceneNumber - b.sceneNumber);
  }

  /**
   * Validates a single raw scene entry and assembles it into a complete,
   * strongly typed Scene — joining in its CameraPlan/EmotionPlan by scene
   * number and deriving voiceActors from the selected characters.
   */
  private buildScene(
    item: unknown,
    expectedSceneNumbers: Set<number>,
    seenSceneNumbers: Set<number>,
    characterIds: Set<EntityId>,
    environmentIds: Set<EntityId>,
    characterById: Map<EntityId, Character>,
    cameraPlanByScene: Map<number, CameraPlan>,
    emotionPlanByScene: Map<number, EmotionPlan>,
    rawResponse: string
  ): Scene {
    const raw = this.expectRawScene(item, rawResponse);

    const sceneNumber = this.expectPositiveInteger(raw.sceneNumber, "sceneNumber", rawResponse);
    if (!expectedSceneNumbers.has(sceneNumber)) {
      throw new ScenePlannerParseError(
        `Unknown sceneNumber in response: ${sceneNumber}`,
        rawResponse
      );
    }
    if (seenSceneNumbers.has(sceneNumber)) {
      throw new ScenePlannerParseError(
        `Duplicate sceneNumber in response: ${sceneNumber}`,
        rawResponse
      );
    }
    seenSceneNumbers.add(sceneNumber);

    // Guarded by validateInputs (camera/emotion scene numbers match
    // expectedSceneNumbers exactly); re-checked defensively.
    const cameraPlan = cameraPlanByScene.get(sceneNumber);
    const emotionPlan = emotionPlanByScene.get(sceneNumber);
    if (!cameraPlan || !emotionPlan) {
      throw new ScenePlannerParseError(
        `No matching CameraPlan/EmotionPlan for sceneNumber ${sceneNumber}.`,
        rawResponse
      );
    }

    const sceneCharacterIds = this.expectCharacterIdArray(raw.characterIds, characterIds, rawResponse);
    const environmentId = this.expectKnownId(
      raw.environmentId,
      environmentIds,
      "environmentId",
      rawResponse
    );

    const voiceActors: VoiceActorAssignment[] = sceneCharacterIds.map((id) => ({
      characterId: id,
      voiceProfileId: characterById.get(id)!.voiceProfile.id,
    }));

    return {
      id: `scene-${sceneNumber}`,
      sceneNumber,
      title: this.expectString(raw.title, "title", rawResponse),
      description: this.expectString(raw.summary, "summary", rawResponse),
      environmentId,
      characterIds: sceneCharacterIds,
      cameraPlanId: cameraPlan.id,
      emotionPlanId: emotionPlan.id,
      dialogue: this.expectDialogue(raw.dialogue, new Set(sceneCharacterIds), rawResponse),
      voiceActors,
      backgroundMusic: this.expectOptionalMusicCue(raw.backgroundMusic, rawResponse),
      soundEffects: this.expectOptionalSoundEffects(raw.soundEffects, rawResponse),
      estimatedRenderCost: this.expectNumber(
        raw.estimatedRenderCost,
        "estimatedRenderCost",
        rawResponse
      ),
      estimatedRenderTime: this.expectNumber(
        raw.estimatedRenderTime,
        "estimatedRenderTime",
        rawResponse
      ),
    };
  }

  /**
   * Ensures every input Character and Environment is referenced by at
   * least one generated Scene.
   */
  private validateCoverage(scenes: Scene[], characters: Character[], environments: Environment[]): void {
    const usedCharacterIds = new Set(scenes.flatMap((s) => s.characterIds));
    const orphanedCharacters = characters.filter((c) => !usedCharacterIds.has(c.id));
    if (orphanedCharacters.length > 0) {
      throw new ScenePlannerParseError(
        `Orphaned character(s) never used in any scene: ${orphanedCharacters
          .map((c) => c.id)
          .join(", ")}.`,
        ""
      );
    }

    const usedEnvironmentIds = new Set(scenes.map((s) => s.environmentId));
    const orphanedEnvironments = environments.filter((e) => !usedEnvironmentIds.has(e.id));
    if (orphanedEnvironments.length > 0) {
      throw new ScenePlannerParseError(
        `Orphaned environment(s) never used in any scene: ${orphanedEnvironments
          .map((e) => e.id)
          .join(", ")}.`,
        ""
      );
    }
  }

  private expectRawScene(value: unknown, rawResponse: string): RawScene {
    if (typeof value !== "object" || value === null) {
      throw new ScenePlannerParseError("Invalid scene entry.", rawResponse);
    }
    return value as RawScene;
  }

  private expectRawDialogueLine(value: unknown, rawResponse: string): RawDialogueLine {
    if (typeof value !== "object" || value === null) {
      throw new ScenePlannerParseError("Invalid dialogue entry.", rawResponse);
    }
    return value as RawDialogueLine;
  }

  private expectString(value: unknown, field: string, rawResponse: string): string {
    if (typeof value !== "string" || value.trim().length === 0) {
      throw new ScenePlannerParseError(`Missing or invalid "${field}" field.`, rawResponse);
    }
    return value;
  }

  private expectOptionalString(value: unknown): string | undefined {
    return typeof value === "string" && value.trim().length > 0 ? value : undefined;
  }

  private expectOptionalStringArray(value: unknown): string[] | undefined {
    if (!Array.isArray(value)) return undefined;
    const strings = value.filter((item): item is string => typeof item === "string");
    return strings.length > 0 ? strings : undefined;
  }

  private expectNumber(value: unknown, field: string, rawResponse: string): number {
    if (typeof value !== "number" || Number.isNaN(value)) {
      throw new ScenePlannerParseError(`Missing or invalid "${field}" field.`, rawResponse);
    }
    return value;
  }

  private expectPositiveInteger(value: unknown, field: string, rawResponse: string): number {
    if (typeof value !== "number" || !Number.isInteger(value) || value < 1) {
      throw new ScenePlannerParseError(`Missing or invalid "${field}" field.`, rawResponse);
    }
    return value;
  }

  private expectKnownId(
    value: unknown,
    knownIds: Set<EntityId>,
    field: string,
    rawResponse: string
  ): EntityId {
    if (typeof value !== "string" || !knownIds.has(value)) {
      throw new ScenePlannerParseError(`Missing or invalid "${field}" field.`, rawResponse);
    }
    return value;
  }

  private expectCharacterIdArray(
    value: unknown,
    knownIds: Set<EntityId>,
    rawResponse: string
  ): EntityId[] {
    if (!Array.isArray(value) || value.length === 0 || value.some((v) => typeof v !== "string")) {
      throw new ScenePlannerParseError('Missing or invalid "characterIds" field.', rawResponse);
    }

    const ids = value as string[];
    if (new Set(ids).size !== ids.length) {
      throw new ScenePlannerParseError("Duplicate characterId within a single scene.", rawResponse);
    }
    for (const id of ids) {
      if (!knownIds.has(id)) {
        throw new ScenePlannerParseError(`Unknown characterId referenced: ${id}`, rawResponse);
      }
    }
    return ids;
  }

  private expectDialogue(
    value: unknown,
    sceneCharacterIds: Set<EntityId>,
    rawResponse: string
  ): DialogueLine[] {
    if (value === undefined || value === null) return [];
    if (!Array.isArray(value)) {
      throw new ScenePlannerParseError('Invalid "dialogue" field.', rawResponse);
    }

    return value.map((entry) => {
      const raw = this.expectRawDialogueLine(entry, rawResponse);
      const characterId = this.expectString(raw.characterId, "dialogue.characterId", rawResponse);
      if (!sceneCharacterIds.has(characterId)) {
        throw new ScenePlannerParseError(
          `Dialogue references characterId "${characterId}" not present in this scene.`,
          rawResponse
        );
      }
      return {
        characterId,
        text: this.expectString(raw.text, "dialogue.text", rawResponse),
      };
    });
  }

  private expectOptionalMusicCue(value: unknown, rawResponse: string): MusicCue | undefined {
    if (value === undefined || value === null) return undefined;
    if (typeof value !== "object") {
      throw new ScenePlannerParseError('Invalid "backgroundMusic" field.', rawResponse);
    }
    const raw = value as RawMusicCue;
    return {
      style: this.expectOptionalString(raw.style),
      moodTags: this.expectOptionalStringArray(raw.moodTags),
    };
  }

  private expectOptionalSoundEffects(value: unknown, rawResponse: string): SoundEffectCue[] | undefined {
    if (value === undefined || value === null) return undefined;
    if (!Array.isArray(value) || value.some((v) => typeof v !== "string")) {
      throw new ScenePlannerParseError('Invalid "soundEffects" field.', rawResponse);
    }
    return (value as string[]).map((name) => ({ name }));
  }
}
