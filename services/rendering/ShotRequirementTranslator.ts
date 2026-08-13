/**
 * ShotRequirementTranslator.ts
 *
 * VGE-02: pure vocabulary translation from a ShotRequirement (the AI
 * Director's decision — see ShotRequirement.ts) into a provider-neutral
 * RenderRequest. This is deliberately NOT Veo-specific — RenderRequest is
 * the same contract every RenderProvider (LTX, Google, future providers)
 * already implements, so this translation happens once, upstream of any
 * particular provider, not inside GoogleVeoProvider.
 *
 * Makes no creative decisions: cameraMovement becomes descriptive prompt
 * text (the only channel Veo's API actually exposes for camera intent —
 * see VGE-02's audit; there is no structured camera parameter to set
 * instead), nothing is invented or overridden. Mirrors
 * services/ai/production/PromptComposer.ts's existing humanize() convention
 * (DOLLY_IN -> "dolly in") for consistency with how this codebase already
 * renders CameraMovement into prompt text elsewhere — not a new style.
 *
 * image/lastFrame/extendVideo/referenceImages are intentionally NOT
 * populated here: ShotRequirement's requiresImageReference/
 * requiresFirstLastFrame/requiresExtension only record that a shot NEEDS
 * one of these — the actual asset (a reference image's real bytes, a
 * prior video's real URI) doesn't exist inside a pure decision record.
 * Attaching the real asset is the caller's job, once one exists.
 */

import type { ShotRequirement } from "./ShotRequirement";
import type { RenderRequest } from "./interfaces/RenderProvider";

/** Matches PromptComposer.ts's private humanize() convention exactly, so Veo prompt text stays consistent regardless of which layer produced it. */
function humanizeCameraMovement(movement: ShotRequirement["cameraMovement"]): string | undefined {
  if (!movement) return undefined;
  return movement.toLowerCase().replace(/_/g, " ");
}

export interface ShotRequirementTranslationOptions {
  negativePrompt?: string;
}

/**
 * Translates a ShotRequirement + the scene's base prompt text into a
 * RenderRequest any RenderProvider can consume. `prompt` is expected to
 * already describe subject/action/environment/lighting/emotion/style
 * (PromptComposer.ts's job for Movie Studio's full pipeline) — this
 * function only appends camera-movement text and carries duration/aspect
 * ratio/resolution/audio through, it does not compose the scene prompt
 * itself.
 */
export function shotRequirementToRenderRequest(
  shot: ShotRequirement,
  prompt: string,
  options?: ShotRequirementTranslationOptions
): RenderRequest {
  const cameraPhrase = humanizeCameraMovement(shot.cameraMovement);
  const composedPrompt = cameraPhrase ? `${prompt}\nCamera movement: ${cameraPhrase}.` : prompt;

  return {
    prompt: composedPrompt,
    negativePrompt: options?.negativePrompt,
    aspectRatio: shot.aspectRatio,
    durationSeconds: shot.durationSeconds,
    // Reuses RenderRequest.quality as the resolution tier — the same
    // convention GoogleGenAIVeoClient now applies (VGE-02's audit found
    // "quality" had no real SDK counterpart before this; resolution is
    // the closest real, caller-controllable field) — not a new field.
    quality: shot.qualityTier === "high" ? "1080p" : "720p",
    requiresAudio: shot.requiresAudio,
  };
}
