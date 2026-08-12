/**
 * ShotRequirement.test.ts
 *
 * Run with: npx tsx --test services/rendering/ShotRequirement.test.ts
 * (no test framework is configured in this repo — see CameraDirector.test.ts's
 * file header for the established convention this follows.)
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  serializeShotRequirement,
  deserializeShotRequirement,
  validateShotRequirement,
  ShotRequirementValidationError,
} from "./ShotRequirement";
import type { ShotRequirement } from "./ShotRequirement";
import { CameraMovement } from "../ai/director/OutputSchema";

function validRequirement(overrides: Partial<ShotRequirement> = {}): ShotRequirement {
  return {
    durationSeconds: 8,
    aspectRatio: "9:16",
    cameraMovement: CameraMovement.DollyIn,
    requiresAudio: false,
    requiresImageReference: false,
    requiresFirstLastFrame: false,
    requiresExtension: false,
    qualityTier: "standard",
    commercialImportance: "standard",
    ...overrides,
  };
}

describe("ShotRequirement — serialization", () => {
  test("round-trips through serialize/deserialize unchanged", () => {
    const original = validRequirement();
    const json = serializeShotRequirement(original);
    const restored = deserializeShotRequirement(json);
    assert.deepEqual(restored, original);
  });

  test("serialize produces valid JSON", () => {
    const json = serializeShotRequirement(validRequirement());
    assert.doesNotThrow(() => JSON.parse(json));
  });

  test("cameraMovement is optional and round-trips as undefined when omitted", () => {
    const original = validRequirement();
    delete original.cameraMovement;
    const restored = deserializeShotRequirement(serializeShotRequirement(original));
    assert.equal(restored.cameraMovement, undefined);
  });

  test("deserialize rejects malformed JSON", () => {
    assert.throws(() => deserializeShotRequirement("{not json"), SyntaxError);
  });

  test("deserialize rejects well-formed JSON with an invalid shape", () => {
    assert.throws(
      () => deserializeShotRequirement(JSON.stringify({ durationSeconds: -1 })),
      ShotRequirementValidationError
    );
  });
});

describe("ShotRequirement — validation", () => {
  test("accepts a well-formed requirement", () => {
    assert.doesNotThrow(() => validateShotRequirement(validRequirement()));
  });

  test("rejects non-positive duration", () => {
    assert.throws(() => validateShotRequirement(validRequirement({ durationSeconds: 0 })), ShotRequirementValidationError);
    assert.throws(() => validateShotRequirement(validRequirement({ durationSeconds: -5 })), ShotRequirementValidationError);
  });

  test("rejects an empty aspect ratio", () => {
    assert.throws(() => validateShotRequirement(validRequirement({ aspectRatio: "" })), ShotRequirementValidationError);
  });

  test("rejects an unknown qualityTier", () => {
    assert.throws(
      () => validateShotRequirement(validRequirement({ qualityTier: "cinema" as ShotRequirement["qualityTier"] })),
      ShotRequirementValidationError
    );
  });

  test("rejects an unknown commercialImportance", () => {
    assert.throws(
      () =>
        validateShotRequirement(
          validRequirement({ commercialImportance: "urgent" as ShotRequirement["commercialImportance"] })
        ),
      ShotRequirementValidationError
    );
  });

  test("rejects a non-boolean requires* flag", () => {
    assert.throws(
      () => validateShotRequirement(validRequirement({ requiresAudio: "yes" as unknown as boolean })),
      ShotRequirementValidationError
    );
  });

  test("accepts every declared qualityTier and commercialImportance value", () => {
    for (const qualityTier of ["draft", "standard", "high"] as const) {
      assert.doesNotThrow(() => validateShotRequirement(validRequirement({ qualityTier })));
    }
    for (const commercialImportance of ["standard", "high", "critical"] as const) {
      assert.doesNotThrow(() => validateShotRequirement(validRequirement({ commercialImportance })));
    }
  });
});
