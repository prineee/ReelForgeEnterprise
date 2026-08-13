/**
 * ShotRequirementTranslator.test.ts
 *
 * Run with: npx tsx --test services/rendering/ShotRequirementTranslator.test.ts
 * (no test framework is configured in this repo — see CameraDirector.test.ts's
 * file header for the established convention this follows.)
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { shotRequirementToRenderRequest } from "./ShotRequirementTranslator";
import type { ShotRequirement } from "./ShotRequirement";
import { CameraMovement } from "../ai/director/OutputSchema";

function baseShot(overrides: Partial<ShotRequirement> = {}): ShotRequirement {
  return {
    durationSeconds: 8,
    aspectRatio: "9:16",
    requiresAudio: false,
    requiresImageReference: false,
    requiresFirstLastFrame: false,
    requiresExtension: false,
    qualityTier: "standard",
    commercialImportance: "standard",
    ...overrides,
  };
}

describe("shotRequirementToRenderRequest — camera movement translation", () => {
  test("DollyIn becomes descriptive prompt text, not a decision override", () => {
    const request = shotRequirementToRenderRequest(baseShot({ cameraMovement: CameraMovement.DollyIn }), "A hero shot of the product.");
    assert.match(request.prompt, /Camera movement: dolly in\.$/);
    assert.match(request.prompt, /^A hero shot of the product\./);
  });

  test("every CameraMovement enum value translates to lowercase, underscore-free text (matches PromptComposer's humanize convention)", () => {
    for (const movement of Object.values(CameraMovement)) {
      const request = shotRequirementToRenderRequest(baseShot({ cameraMovement: movement }), "Base prompt.");
      assert.ok(!request.prompt.includes("_"), `expected no underscores for ${movement}`);
      assert.ok(request.prompt.includes(movement.toLowerCase().replace(/_/g, " ")));
    }
  });

  test("no camera movement means the prompt is passed through unchanged", () => {
    const request = shotRequirementToRenderRequest(baseShot(), "Base prompt, no camera direction.");
    assert.equal(request.prompt, "Base prompt, no camera direction.");
  });

  test("does not invent a different movement than what was given (no creative decision-making)", () => {
    const request = shotRequirementToRenderRequest(baseShot({ cameraMovement: CameraMovement.PanRight }), "Base prompt.");
    assert.ok(request.prompt.includes("pan right"));
    assert.ok(!request.prompt.includes("dolly"));
    assert.ok(!request.prompt.includes("orbit"));
  });
});

describe("shotRequirementToRenderRequest — general translation", () => {
  test("carries duration, aspect ratio, and audio requirement through unchanged", () => {
    const request = shotRequirementToRenderRequest(baseShot({ durationSeconds: 6, aspectRatio: "16:9", requiresAudio: true }), "p");
    assert.equal(request.durationSeconds, 6);
    assert.equal(request.aspectRatio, "16:9");
    assert.equal(request.requiresAudio, true);
  });

  test("high qualityTier maps to 1080p, standard/draft map to 720p", () => {
    assert.equal(shotRequirementToRenderRequest(baseShot({ qualityTier: "high" }), "p").quality, "1080p");
    assert.equal(shotRequirementToRenderRequest(baseShot({ qualityTier: "standard" }), "p").quality, "720p");
    assert.equal(shotRequirementToRenderRequest(baseShot({ qualityTier: "draft" }), "p").quality, "720p");
  });

  test("passes negativePrompt through from options", () => {
    const request = shotRequirementToRenderRequest(baseShot(), "p", { negativePrompt: "no watermark" });
    assert.equal(request.negativePrompt, "no watermark");
  });

  test("does not populate image/lastFrame/extendVideo/referenceImages — those require real assets the caller must attach separately", () => {
    const request = shotRequirementToRenderRequest(
      baseShot({ requiresImageReference: true, requiresFirstLastFrame: true, requiresExtension: true }),
      "p"
    );
    assert.equal(request.image, undefined);
    assert.equal(request.lastFrame, undefined);
    assert.equal(request.extendVideo, undefined);
    assert.equal(request.referenceImages, undefined);
  });
});
