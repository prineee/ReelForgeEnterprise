/**
 * PromptComposer.ts
 *
 * First module of the Production Engine. Given a MovieBlueprint (the
 * completed output of the Director Layer) and a scene ID, deterministically
 * composes a single cinematic text-to-video production prompt — pure
 * string formatting over already-generated data, suitable as input to a
 * Veo 3.1-class video generation model.
 *
 * This module makes no network calls, calls no language model, and
 * contains no randomness: the same MovieBlueprint and sceneId always
 * produce the exact same prompt string.
 *
 * Note on schema gaps: Scene (OutputSchema v2.1) has no dedicated
 * "objective" field, only `description` — `description` is used as the
 * scene's objective below, consistent with how it was populated by
 * ScenePlanner.
 */

import { Emotion } from "../director/OutputSchema";
import type {
  Character,
  Environment,
  CameraPlan,
  EmotionPlan,
  Scene,
} from "../director/OutputSchema";
import type { MovieBlueprint } from "../director/DirectorEngine";

/**
 * Thrown when the given sceneId does not exist on the MovieBlueprint, or
 * when a scene references an entity (Environment, CameraPlan, EmotionPlan,
 * Character) that isn't present in the blueprint.
 */
export class PromptComposerError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PromptComposerError";
  }
}

/**
 * Deterministic, per-emotion facial expression and body-language cues used
 * to describe how a character should be performed in a given scene.
 */
const EMOTION_CUES: Record<Emotion, { expression: string; bodyLanguage: string }> = {
  [Emotion.Joy]: {
    expression: "bright, genuine smile with eyes crinkled in warmth",
    bodyLanguage: "relaxed, open posture with animated gestures",
  },
  [Emotion.Sadness]: {
    expression: "downturned eyes and a subtle frown, tension around the mouth",
    bodyLanguage: "slumped shoulders, slow movements, arms drawn inward",
  },
  [Emotion.Anger]: {
    expression: "furrowed brow, clenched jaw, narrowed eyes",
    bodyLanguage: "rigid stance, clenched fists, sharp abrupt movements",
  },
  [Emotion.Fear]: {
    expression: "widened eyes, parted lips, pale complexion",
    bodyLanguage: "tense, defensive posture, pulling or backing away",
  },
  [Emotion.Surprise]: {
    expression: "raised eyebrows, widened eyes, slightly open mouth",
    bodyLanguage: "sudden stillness or a startled recoil",
  },
  [Emotion.Disgust]: {
    expression: "wrinkled nose, curled lip, narrowed eyes",
    bodyLanguage: "leaning away, arms crossed defensively",
  },
  [Emotion.Love]: {
    expression: "soft gaze, gentle smile, relaxed brow",
    bodyLanguage: "leaning in, open and inviting posture",
  },
  [Emotion.Tension]: {
    expression: "tight jaw, fixed unblinking stare",
    bodyLanguage: "stiff posture, restrained, controlled movement",
  },
  [Emotion.Calm]: {
    expression: "relaxed features, steady even gaze",
    bodyLanguage: "loose, unhurried, deliberate movements",
  },
  [Emotion.Excitement]: {
    expression: "wide bright eyes, energetic smile",
    bodyLanguage: "animated, forward-leaning, energetic gestures",
  },
  [Emotion.Melancholy]: {
    expression: "distant gaze, faint downturned mouth",
    bodyLanguage: "slow, withdrawn, low-energy movement",
  },
  [Emotion.Determination]: {
    expression: "set jaw, focused and steady eyes",
    bodyLanguage: "forward-leaning stance, purposeful, deliberate stride",
  },
};

/**
 * Deterministic 1-10 intensity bucketing used to modulate emotion cues.
 */
function intensityWord(intensity: number): string {
  if (intensity <= 3) return "subtly";
  if (intensity <= 6) return "noticeably";
  if (intensity <= 8) return "strongly";
  return "intensely";
}

/**
 * Composes deterministic, Veo 3.1-ready cinematic production prompts from
 * a MovieBlueprint's Scenes. Pure string composition — no AI calls, no
 * network access, no randomness.
 */
export class PromptComposer {
  /**
   * Composes the full production prompt for one scene, covering character
   * appearance/wardrobe, environment, lighting, camera direction, emotional
   * performance, dialogue context, and production/negative quality
   * directives.
   */
  composeScenePrompt(movie: MovieBlueprint, sceneId: string): string {
    const scene = this.resolveScene(movie, sceneId);
    const environment = this.resolveEnvironment(movie, scene);
    const cameraPlan = this.resolveCameraPlan(movie, scene);
    const emotionPlan = this.resolveEmotionPlan(movie, scene);
    const characters = this.resolveCharacters(movie, scene);

    const sections = [
      this.composeHeaderPrompt(movie, scene),
      this.composeCharacterPrompt(characters),
      this.composeEnvironmentPrompt(environment),
      this.composeLightingPrompt(environment, cameraPlan, scene),
      this.composeCameraPrompt(cameraPlan, movie),
      this.composeEmotionPrompt(emotionPlan, characters, scene),
      this.composeDialoguePrompt(scene, characters),
      this.composeQualityPrompt(movie),
      this.composeNegativePrompt(),
    ];

    return sections.filter((section) => section.trim().length > 0).join("\n\n");
  }

  // ── Entity resolution ─────────────────────────────────────────────────

  private resolveScene(movie: MovieBlueprint, sceneId: string): Scene {
    const scene = movie.scenes.find((s) => s.id === sceneId);
    if (!scene) {
      throw new PromptComposerError(`Scene not found: ${sceneId}`);
    }
    return scene;
  }

  private resolveEnvironment(movie: MovieBlueprint, scene: Scene): Environment {
    const environment = movie.environments.find((e) => e.id === scene.environmentId);
    if (!environment) {
      throw new PromptComposerError(
        `Environment not found for scene ${scene.id}: ${scene.environmentId}`
      );
    }
    return environment;
  }

  private resolveCameraPlan(movie: MovieBlueprint, scene: Scene): CameraPlan {
    const cameraPlan = movie.cameraPlans.find((p) => p.id === scene.cameraPlanId);
    if (!cameraPlan) {
      throw new PromptComposerError(
        `CameraPlan not found for scene ${scene.id}: ${scene.cameraPlanId}`
      );
    }
    return cameraPlan;
  }

  private resolveEmotionPlan(movie: MovieBlueprint, scene: Scene): EmotionPlan {
    const emotionPlan = movie.emotionPlans.find((p) => p.id === scene.emotionPlanId);
    if (!emotionPlan) {
      throw new PromptComposerError(
        `EmotionPlan not found for scene ${scene.id}: ${scene.emotionPlanId}`
      );
    }
    return emotionPlan;
  }

  private resolveCharacters(movie: MovieBlueprint, scene: Scene): Character[] {
    if (scene.characterIds.length === 0) {
      throw new PromptComposerError(`Scene ${scene.id} has no characters.`);
    }
    return scene.characterIds.map((id) => {
      const character = movie.characters.find((c) => c.id === id);
      if (!character) {
        throw new PromptComposerError(`Character not found for scene ${scene.id}: ${id}`);
      }
      return character;
    });
  }

  // ── Section composers ─────────────────────────────────────────────────

  private composeHeaderPrompt(movie: MovieBlueprint, scene: Scene): string {
    const title = scene.title ?? `Scene ${scene.sceneNumber}`;
    return [
      `SCENE ${scene.sceneNumber} — "${title}" (from "${movie.movie.title}")`,
      `Objective: ${scene.description}`,
    ].join("\n");
  }

  private composeCharacterPrompt(characters: Character[]): string {
    const lines = characters.map((character) => {
      const appearance = this.formatAppearance(character);
      const traits =
        character.physicalTraits.length > 0
          ? `Notable physical traits: ${character.physicalTraits.join(", ")}.`
          : "";
      const wardrobe =
        character.wardrobe.length > 0 ? `Wearing: ${character.wardrobe.join(", ")}.` : "";

      return [`- ${character.name}: ${character.description}`, appearance, traits, wardrobe]
        .filter((part) => part.trim().length > 0)
        .join(" ");
    });

    return ["CHARACTERS:", ...lines].join("\n");
  }

  private formatAppearance(character: Character): string {
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
    return parts.length > 0 ? `Appearance: ${parts.join(", ")}.` : "";
  }

  private composeEnvironmentPrompt(environment: Environment): string {
    const parts = [
      `${environment.name} — ${environment.description}`,
      `Location: ${environment.location}.`,
      `Architecture: ${environment.architecture}.`,
      `Atmosphere: ${environment.atmosphere}.`,
    ];
    if (environment.props.length > 0) {
      parts.push(`Notable props: ${environment.props.join(", ")}.`);
    }
    if (environment.dominantColors.length > 0) {
      parts.push(`Dominant colors: ${environment.dominantColors.join(", ")}.`);
    }
    if (environment.ambientSound) {
      parts.push(`Ambient sound: ${environment.ambientSound}.`);
    }
    if (environment.continuityNotes) {
      parts.push(`Continuity: ${environment.continuityNotes}.`);
    }
    return ["ENVIRONMENT:", parts.join(" ")].join("\n");
  }

  private composeLightingPrompt(environment: Environment, cameraPlan: CameraPlan, scene: Scene): string {
    const timeOfDay = scene.timeOfDay ?? environment.timeOfDay;
    const parts = [`Time of day: ${this.humanize(timeOfDay)}.`];

    if (environment.weather) {
      parts.push(`Weather: ${this.humanize(environment.weather)}.`);
    }
    parts.push(`Lighting: ${this.humanize(cameraPlan.lighting)}.`);
    if (environment.lighting && environment.lighting !== cameraPlan.lighting) {
      parts.push(`Ambient location lighting: ${this.humanize(environment.lighting)}.`);
    }

    return ["LIGHTING:", parts.join(" ")].join("\n");
  }

  private composeCameraPrompt(cameraPlan: CameraPlan, movie: MovieBlueprint): string {
    const focusCharacter = cameraPlan.focusSubject.characterId
      ? movie.characters.find((c) => c.id === cameraPlan.focusSubject.characterId)
      : undefined;
    const focusDescription = focusCharacter
      ? `${focusCharacter.name} — ${cameraPlan.focusSubject.description}`
      : cameraPlan.focusSubject.description;

    const styleSuffix =
      movie.movie.genres.length > 0 ? ` (${movie.movie.genres.join(", ")} genre visual language)` : "";

    const parts = [
      `Shot: ${this.humanize(cameraPlan.shot)}.`,
      cameraPlan.movement ? `Camera movement: ${this.humanize(cameraPlan.movement)}.` : "",
      `Lens: ${cameraPlan.lens}.`,
      `Camera height: ${this.humanize(cameraPlan.cameraHeight)}.`,
      `Framing: ${cameraPlan.framing}.`,
      `Focus subject: ${focusDescription}.`,
      `Cinematic style: ${cameraPlan.cinematicPurpose}${styleSuffix}.`,
      `Transition hint: ${this.humanize(cameraPlan.transitionToNext)} into the next scene.`,
    ].filter((part) => part.trim().length > 0);

    return ["CAMERA:", parts.join(" ")].join("\n");
  }

  private composeEmotionPrompt(emotionPlan: EmotionPlan, characters: Character[], scene: Scene): string {
    const sceneCharacterIds = new Set(scene.characterIds);
    const relevantStates = emotionPlan.characterStates.filter((state) =>
      sceneCharacterIds.has(state.characterId)
    );

    const stateLines = characters.map((character) => {
      const state = relevantStates.find((s) => s.characterId === character.id);
      const emotion = state?.emotion ?? character.emotionalBaseline;
      const intensity = state?.intensity ?? 5;
      const cue = EMOTION_CUES[emotion];
      return `- ${character.name}: ${intensityWord(intensity)} ${this.humanize(emotion)} — expression: ${cue.expression}; body language: ${cue.bodyLanguage}.`;
    });

    const dominantCue = EMOTION_CUES[emotionPlan.dominantEmotion];

    return [
      "EMOTION:",
      `Dominant scene emotion: ${this.humanize(emotionPlan.dominantEmotion)} at intensity ${emotionPlan.intensity}/10 — overall mood: ${dominantCue.expression}.`,
      `Emotional transition: ${this.humanize(emotionPlan.transition)}.`,
      `Audience target: ${emotionPlan.audienceTarget}.`,
      `Pacing: ${emotionPlan.pacingNotes}.`,
      ...stateLines,
    ].join("\n");
  }

  private composeDialoguePrompt(scene: Scene, characters: Character[]): string {
    if (!scene.dialogue || scene.dialogue.length === 0) {
      return ["DIALOGUE CONTEXT:", "Silent scene — no dialogue."].join("\n");
    }

    const characterById = new Map(characters.map((c) => [c.id, c]));
    const lines = scene.dialogue.map((line) => {
      const name = characterById.get(line.characterId)?.name ?? line.characterId;
      return `${name}: "${line.text}"`;
    });

    return ["DIALOGUE CONTEXT:", ...lines].join("\n");
  }

  private composeQualityPrompt(movie: MovieBlueprint): string {
    return [
      "PRODUCTION QUALITY:",
      "Optimized for Veo 3.1 text-to-video generation.",
      "Photorealistic, cinematic color grading, professional feature-film production value.",
      "High resolution, sharp focus, smooth and physically accurate motion, temporally consistent character and environment appearance across frames.",
      `Content rating: ${this.humanize(movie.movie.contentRating)}.`,
    ].join("\n");
  }

  private composeNegativePrompt(): string {
    return [
      "AVOID:",
      "Distorted anatomy, extra or missing limbs, warped faces, flickering, morphing geometry, " +
        "inconsistent character appearance between frames, text overlays, watermarks, logos, " +
        "low resolution, blurry or unnatural motion, jarring artifacts.",
    ].join("\n");
  }

  // ── Formatting utilities ──────────────────────────────────────────────

  private humanize(value: string): string {
    return value.toLowerCase().replace(/_/g, " ");
  }
}
