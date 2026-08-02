/**
 * ShotLibrary.ts
 *
 * A catalog of reusable camera-shot presets, independent of any single
 * movie — unlike CharacterLibrary/LocationLibrary (which catalog
 * entities *derived from* specific movies), ShotLibrary starts
 * pre-populated with a fixed set of presets and matches them against
 * already-planned CameraPlans (services/ai/director/CameraDirector.ts's
 * real, LLM-backed output — untouched, not called here) or a
 * DirectorProfile's preferences (services/ai/director-engine/DirectorProfile.ts,
 * reused, not duplicated).
 *
 * No AI model calls, no network access.
 */

import { CameraShot, CameraMovement } from "../director/OutputSchema";
import type { CameraPlan } from "../director/OutputSchema";
import type { DirectorProfile } from "../director-engine/DirectorProfile";

export interface ShotPreset {
  id: string;
  name: string;
  shot: CameraShot;
  movement?: CameraMovement;
  description: string;
  bestFor: string[];
}

const DEFAULT_SHOT_PRESETS: readonly ShotPreset[] = [
  { id: "establishing-static", name: "Establishing Wide", shot: CameraShot.EstablishingShot, movement: CameraMovement.Static, description: "A static wide shot establishing location and scale.", bestFor: ["scene opening", "world-building"] },
  { id: "dialogue-medium", name: "Dialogue Medium", shot: CameraShot.MediumShot, movement: CameraMovement.Static, description: "A static medium shot framing one or two speaking characters.", bestFor: ["dialogue", "character introduction"] },
  { id: "emotional-closeup", name: "Emotional Close-Up", shot: CameraShot.CloseUp, movement: CameraMovement.Static, description: "A static close-up isolating a character's expression.", bestFor: ["emotional beats", "reaction shots"] },
  { id: "reveal-dolly", name: "Reveal Dolly-In", shot: CameraShot.MediumShot, movement: CameraMovement.DollyIn, description: "A slow dolly-in that draws focus toward a subject as it's revealed.", bestFor: ["reveal", "tension build"] },
  { id: "action-tracking", name: "Action Tracking", shot: CameraShot.TrackingShot, movement: CameraMovement.Handheld, description: "A handheld tracking shot following fast movement.", bestFor: ["action", "chase"] },
  { id: "aerial-establishing", name: "Aerial Establishing", shot: CameraShot.DroneShot, movement: CameraMovement.Static, description: "A drone shot establishing a location from above.", bestFor: ["scene opening", "scale", "location transition"] },
  { id: "pov-handheld", name: "POV Handheld", shot: CameraShot.PointOfView, movement: CameraMovement.Handheld, description: "A handheld point-of-view shot placing the audience in a character's perspective.", bestFor: ["immersion", "tension"] },
  { id: "intimate-extreme-closeup", name: "Intimate Extreme Close-Up", shot: CameraShot.ExtremeCloseUp, movement: CameraMovement.Static, description: "A static extreme close-up on a small, significant detail.", bestFor: ["intimacy", "detail emphasis"] },
];

export class ShotLibraryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ShotLibraryError";
  }
}

export class ShotLibrary {
  private readonly presets = new Map<string, ShotPreset>(DEFAULT_SHOT_PRESETS.map((p) => [p.id, p]));

  register(preset: ShotPreset): void {
    this.presets.set(preset.id, preset);
  }

  get(id: string): ShotPreset {
    const preset = this.presets.get(id);
    if (!preset) {
      throw new ShotLibraryError(`Unknown shot preset: "${id}".`);
    }
    return preset;
  }

  list(): readonly ShotPreset[] {
    return Array.from(this.presets.values());
  }

  /** Presets aligned with a DirectorProfile's preferred shots/movements. */
  recommendFor(profile: DirectorProfile): readonly ShotPreset[] {
    return this.list().filter(
      (preset) =>
        (profile.preferredCameraShots?.includes(preset.shot) ?? false) ||
        (preset.movement !== undefined && (profile.preferredCameraMovements?.includes(preset.movement) ?? false))
    );
  }

  /** The registered preset (if any) matching an already-planned CameraPlan's shot+movement — useful for tagging planned scenes with a known preset. */
  matchCameraPlan(cameraPlan: CameraPlan): ShotPreset | undefined {
    return this.list().find(
      (preset) => preset.shot === cameraPlan.shot && preset.movement === cameraPlan.movement
    );
  }
}
