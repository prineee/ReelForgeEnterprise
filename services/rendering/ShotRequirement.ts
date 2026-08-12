/**
 * ShotRequirement.ts
 *
 * VGE-01 (Generative Video Engine V1, foundation phase): a provider-neutral
 * description of what one shot needs, independent of which provider will
 * eventually render it. The AI Director (services/ai/director/*) is the
 * intended producer of these — it already decides camera movement, pacing,
 * and commercial intent (see CameraDirector/EmotionDirector/ScenePlanner)
 * and remains the single source of those creative decisions; a
 * ShotRequirement is just that decision, restated in the vocabulary a
 * provider router can act on.
 *
 * VGE-01 defines this type and nothing else: no router, no provider
 * selection, no AI Director changes. A future router consumes
 * ShotRequirement + ProviderCapabilities.PROVIDER_DESCRIPTORS to choose a
 * provider per shot; that logic doesn't exist yet, deliberately.
 */

import type { CameraMovement } from "../ai/director/OutputSchema";
import type { QualityTier } from "../orchestrator/OrchestratorTypes";

/**
 * How much a shot's commercial context should weigh in provider/quality
 * tradeoffs — e.g. a hero product shot for a paid ad campaign warrants a
 * higher-cost, higher-fidelity provider than a background/transition shot.
 * No equivalent concept exists elsewhere in this codebase yet (QualityTier,
 * reused above, describes rendering fidelity, not commercial stakes).
 */
export type CommercialImportance = "standard" | "high" | "critical";

export interface ShotRequirement {
  durationSeconds: number;
  aspectRatio: string;
  /** Reuses AI Director's own CameraMovement enum (services/ai/director/OutputSchema.ts) rather than a parallel string type — this is meant to be a direct restatement of a CameraPlan's decision, not a new vocabulary. Undefined means no specific camera movement was required. */
  cameraMovement?: CameraMovement;
  requiresAudio: boolean;
  requiresImageReference: boolean;
  requiresFirstLastFrame: boolean;
  requiresExtension: boolean;
  qualityTier: QualityTier;
  commercialImportance: CommercialImportance;
}

export class ShotRequirementValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ShotRequirementValidationError";
  }
}

const QUALITY_TIERS: readonly QualityTier[] = ["draft", "standard", "high"];
const COMMERCIAL_IMPORTANCE_LEVELS: readonly CommercialImportance[] = ["standard", "high", "critical"];

/**
 * Validates a plain object against ShotRequirement's shape and invariants
 * (positive duration, non-empty aspect ratio, known enum values). Used by
 * both serialize() (to fail fast on a malformed value before it's
 * persisted) and deserialize() (to fail fast on malformed input rather
 * than silently accepting a shape a future router would choke on later).
 */
export function validateShotRequirement(value: ShotRequirement): void {
  if (!Number.isFinite(value.durationSeconds) || value.durationSeconds <= 0) {
    throw new ShotRequirementValidationError(
      `ShotRequirement.durationSeconds must be a positive number, got ${value.durationSeconds}.`
    );
  }
  if (!value.aspectRatio || !value.aspectRatio.trim()) {
    throw new ShotRequirementValidationError("ShotRequirement.aspectRatio must be a non-empty string.");
  }
  if (!QUALITY_TIERS.includes(value.qualityTier)) {
    throw new ShotRequirementValidationError(
      `ShotRequirement.qualityTier must be one of ${QUALITY_TIERS.join(", ")}, got "${value.qualityTier}".`
    );
  }
  if (!COMMERCIAL_IMPORTANCE_LEVELS.includes(value.commercialImportance)) {
    throw new ShotRequirementValidationError(
      `ShotRequirement.commercialImportance must be one of ${COMMERCIAL_IMPORTANCE_LEVELS.join(", ")}, got "${value.commercialImportance}".`
    );
  }
  for (const [field, val] of Object.entries({
    requiresAudio: value.requiresAudio,
    requiresImageReference: value.requiresImageReference,
    requiresFirstLastFrame: value.requiresFirstLastFrame,
    requiresExtension: value.requiresExtension,
  })) {
    if (typeof val !== "boolean") {
      throw new ShotRequirementValidationError(`ShotRequirement.${field} must be a boolean, got ${typeof val}.`);
    }
  }
}

/** Validates, then serializes a ShotRequirement to a JSON string. */
export function serializeShotRequirement(value: ShotRequirement): string {
  validateShotRequirement(value);
  return JSON.stringify(value);
}

/** Parses and validates a JSON string back into a ShotRequirement. Throws ShotRequirementValidationError on malformed shape/values, or a SyntaxError on malformed JSON. */
export function deserializeShotRequirement(json: string): ShotRequirement {
  const parsed = JSON.parse(json) as ShotRequirement;
  validateShotRequirement(parsed);
  return parsed;
}
