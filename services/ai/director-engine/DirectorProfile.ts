/**
 * DirectorProfile.ts
 *
 * A named, deterministic style preset — the "director profile" every other
 * module in this directory consumes to bias its otherwise-neutral output
 * (pacing, prompt style, camera bias, emotional intensity). This is
 * deliberately data, not a persona prompt: the old services/movie/
 * directorPrompt.ts pattern ("You are simultaneously Christopher Nolan,
 * James Cameron...") asked a language model to roleplay a director inside
 * one giant unstructured prompt. This sprint explicitly forbids new AI
 * model calls, and a fixed parameter set is more predictable and testable
 * than a persona prompt anyway — every profile below is a plain object,
 * consumed by pure functions elsewhere in this directory.
 *
 * No AI model calls, no network access, no randomness.
 */

import { CameraShot, CameraMovement } from "../director/OutputSchema";

export type PacingLevel = "SLOW" | "MEDIUM" | "FAST";

export interface DirectorProfile {
  id: string;
  name: string;
  description: string;
  pacing: PacingLevel;
  /** Appended to every composed positive prompt (see DirectorPromptPipeline.ts). */
  promptStyleModifiers: string[];
  /** Appended to every composed negative prompt. */
  negativePromptModifiers: string[];
  /** Optional bias — SceneContinuityEngine/SceneSequencer may flag or note when actual camera direction diverges strongly, but never overrides already-planned CameraPlans (those came from the real, LLM-backed CameraDirector). */
  preferredCameraShots?: CameraShot[];
  preferredCameraMovements?: CameraMovement[];
  /** Added to each scene's EmotionPlan.intensity when computing sequencing/prompt emphasis (see SceneSequencer.ts) — clamped to the valid 1-10 range there, never mutates the original EmotionPlan. */
  emotionalIntensityBias: number;
  /** Seconds added to each scene's computed target duration (see SceneSequencer.ts). */
  sceneDurationBiasSeconds: number;
}

export class DirectorProfileError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DirectorProfileError";
  }
}

/**
 * A small, real starter set — not exhaustive, easy to extend by adding
 * another entry (or calling DirectorProfileRegistry.register() with a
 * custom one at runtime).
 */
export const DIRECTOR_PROFILE_PRESETS: Readonly<Record<string, DirectorProfile>> = {
  CINEMATIC_DRAMA: {
    id: "CINEMATIC_DRAMA",
    name: "Cinematic Drama",
    description: "Measured pacing, naturalistic performance, classical composition.",
    pacing: "MEDIUM",
    promptStyleModifiers: ["cinematic composition", "naturalistic lighting", "35mm film grain"],
    negativePromptModifiers: ["oversaturated colors", "cartoonish rendering"],
    preferredCameraShots: [CameraShot.MediumShot, CameraShot.CloseUp],
    preferredCameraMovements: [CameraMovement.Static, CameraMovement.DollyIn],
    emotionalIntensityBias: 0,
    sceneDurationBiasSeconds: 0,
  },
  FAST_PACED_ACTION: {
    id: "FAST_PACED_ACTION",
    name: "Fast-Paced Action",
    description: "Quick cuts, high energy, kinetic camera work.",
    pacing: "FAST",
    promptStyleModifiers: ["high contrast", "dynamic motion blur", "kinetic energy"],
    negativePromptModifiers: ["static composition", "slow motion"],
    preferredCameraShots: [CameraShot.TrackingShot, CameraShot.DroneShot],
    preferredCameraMovements: [CameraMovement.Handheld, CameraMovement.ZoomIn],
    emotionalIntensityBias: 1,
    sceneDurationBiasSeconds: -2,
  },
  INTIMATE_INDIE: {
    id: "INTIMATE_INDIE",
    name: "Intimate Indie",
    description: "Slow, quiet, character-focused — long held shots, minimal camera movement.",
    pacing: "SLOW",
    promptStyleModifiers: ["soft natural light", "handheld intimacy", "shallow depth of field"],
    negativePromptModifiers: ["overproduced sheen", "artificial studio lighting"],
    preferredCameraShots: [CameraShot.CloseUp, CameraShot.ExtremeCloseUp],
    preferredCameraMovements: [CameraMovement.Static],
    emotionalIntensityBias: -1,
    sceneDurationBiasSeconds: 3,
  },
};

/**
 * A small in-memory registry (matching this codebase's established
 * "in-memory now, real store later" pattern) — starts pre-populated with
 * DIRECTOR_PROFILE_PRESETS, register() adds/overrides.
 */
export class DirectorProfileRegistry {
  private readonly profiles = new Map<string, DirectorProfile>(Object.entries(DIRECTOR_PROFILE_PRESETS));

  register(profile: DirectorProfile): void {
    this.profiles.set(profile.id, profile);
  }

  get(id: string): DirectorProfile {
    const profile = this.profiles.get(id);
    if (!profile) {
      throw new DirectorProfileError(`Unknown director profile: "${id}".`);
    }
    return profile;
  }

  list(): readonly DirectorProfile[] {
    return Array.from(this.profiles.values());
  }
}
