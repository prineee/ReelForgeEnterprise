/**
 * CameraDirector.test.ts
 *
 * Run with: npx tsx --test services/ai/director/CameraDirector.test.ts
 * (no test framework is configured in this repo — see package.json; this
 * uses Node's built-in node:test/node:assert, transpiled by tsx, so it
 * adds no new dependency.)
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { CameraDirector, CameraPlanParseError, normalizeCameraMovement } from "./CameraDirector";
import { CameraMovement, Genre } from "./OutputSchema";
import type { StoryBlueprint, LanguageModelProvider } from "./StoryAnalyzer";

const ALL_CANONICAL_MOVEMENTS = Object.values(CameraMovement);

describe("normalizeCameraMovement — pure function", () => {
  test("every existing canonical value passes through unchanged", () => {
    for (const value of ALL_CANONICAL_MOVEMENTS) {
      assert.equal(normalizeCameraMovement(value), value);
    }
  });

  test("new Gemini vocabulary maps to its documented canonical default", () => {
    assert.equal(normalizeCameraMovement("TRACKING_SHOT"), CameraMovement.DollyIn);
    assert.equal(normalizeCameraMovement("SLOW_ZOOM"), CameraMovement.ZoomIn);
    assert.equal(normalizeCameraMovement("DOLLY_ZOOM"), CameraMovement.DollyIn);
  });

  test("an explicit direction token overrides the default", () => {
    assert.equal(normalizeCameraMovement("TRACKING_SHOT_OUT"), CameraMovement.DollyOut);
    assert.equal(normalizeCameraMovement("SLOW_ZOOM_OUT"), CameraMovement.ZoomOut);
    assert.equal(normalizeCameraMovement("DOLLY_ZOOM_OUT"), CameraMovement.DollyOut);
    // Explicit "_IN" is the same as the default, but exercises the token path itself.
    assert.equal(normalizeCameraMovement("TRACKING_SHOT_IN"), CameraMovement.DollyIn);
    assert.equal(normalizeCameraMovement("SLOW_ZOOM_IN"), CameraMovement.ZoomIn);
    assert.equal(normalizeCameraMovement("DOLLY_ZOOM_IN"), CameraMovement.DollyIn);
  });

  test("casing variation is handled", () => {
    assert.equal(normalizeCameraMovement("tracking_shot"), CameraMovement.DollyIn);
    assert.equal(normalizeCameraMovement("Slow_Zoom"), CameraMovement.ZoomIn);
    assert.equal(normalizeCameraMovement("static"), CameraMovement.Static);
    assert.equal(normalizeCameraMovement("Dolly_In"), CameraMovement.DollyIn);
  });

  test("whitespace/hyphen variation is handled", () => {
    assert.equal(normalizeCameraMovement("TRACKING SHOT"), CameraMovement.DollyIn);
    assert.equal(normalizeCameraMovement("  dolly zoom  "), CameraMovement.DollyIn);
    assert.equal(normalizeCameraMovement("tracking-shot"), CameraMovement.DollyIn);
    assert.equal(normalizeCameraMovement(" static "), CameraMovement.Static);
  });

  test("unknown values are rejected, not silently defaulted", () => {
    assert.equal(normalizeCameraMovement("completely_invalid_movement"), undefined);
    assert.equal(normalizeCameraMovement("PAN_UP"), undefined); // plausible-sounding but not real
    assert.equal(normalizeCameraMovement("SOMETHING_IN"), undefined); // ends in a direction token but isn't a known synonym
  });

  test("non-string input is rejected", () => {
    assert.equal(normalizeCameraMovement(undefined), undefined);
    assert.equal(normalizeCameraMovement(null), undefined);
    assert.equal(normalizeCameraMovement(42), undefined);
    assert.equal(normalizeCameraMovement({ movement: "STATIC" }), undefined);
  });

  test("is pure — repeated calls with the same input return the same output", () => {
    const a = normalizeCameraMovement("tracking_shot");
    const b = normalizeCameraMovement("tracking_shot");
    assert.equal(a, b);
    assert.equal(a, CameraMovement.DollyIn);
  });
});

// ── Integration tests through the real parser ───────────────────────────

const STORY: StoryBlueprint = {
  title: "Test Story",
  genre: [Genre.Drama],
  theme: "letting go",
  targetAudience: "general",
  estimatedDuration: 60,
  estimatedSceneCount: 3,
  conflict: "grief vs acceptance",
  endingStyle: "bittersweet",
  emotionalArc: ["sad", "hopeful"],
  visualStyle: "gothic naturalism",
};

function fakeProvider(response: string): LanguageModelProvider {
  return { generate: async () => response };
}

function rawPlan(sceneNumber: number, movement: string) {
  return {
    sceneNumber,
    shot: "WIDE_SHOT",
    movement,
    angle: 0,
    lens: "35mm",
    framing: "centered",
    lighting: "DAYLIGHT",
    cameraHeight: "EYE_LEVEL",
    focusSubject: "the protagonist",
    transitionToNext: "CUT",
    cinematicPurpose: "establish the scene",
    durationSeconds: 8,
  };
}

describe("CameraDirector.planCamera — end to end", () => {
  test("existing camera plans using only canonical movements are unchanged", async () => {
    const cameraPlans = [
      rawPlan(1, "STATIC"),
      rawPlan(2, "DOLLY_IN"),
      rawPlan(3, "HANDHELD"),
    ];
    const director = new CameraDirector(fakeProvider(JSON.stringify({ cameraPlans })));
    const plans = await director.planCamera(STORY);

    assert.equal(plans.length, 3);
    assert.equal(plans[0].movement, CameraMovement.Static);
    assert.equal(plans[1].movement, CameraMovement.DollyIn);
    assert.equal(plans[2].movement, CameraMovement.Handheld);
  });

  test("the exact production failure (TRACKING_SHOT/SLOW_ZOOM/DOLLY_ZOOM) now succeeds", async () => {
    const cameraPlans = [
      rawPlan(1, "TRACKING_SHOT"),
      rawPlan(2, "SLOW_ZOOM"),
      rawPlan(3, "DOLLY_ZOOM"),
    ];
    const director = new CameraDirector(fakeProvider(JSON.stringify({ cameraPlans })));
    const plans = await director.planCamera(STORY);

    assert.equal(plans.length, 3);
    assert.equal(plans[0].movement, CameraMovement.DollyIn);
    assert.equal(plans[1].movement, CameraMovement.ZoomIn);
    assert.equal(plans[2].movement, CameraMovement.DollyIn);
  });

  test("a genuinely invalid movement value still fails clearly", async () => {
    const cameraPlans = [
      rawPlan(1, "STATIC"),
      rawPlan(2, "completely_invalid_movement"),
      rawPlan(3, "STATIC"),
    ];
    const director = new CameraDirector(fakeProvider(JSON.stringify({ cameraPlans })));

    await assert.rejects(
      () => director.planCamera(STORY),
      (err: unknown) => {
        assert.ok(err instanceof CameraPlanParseError);
        assert.equal(err.message, 'Missing or invalid "movement" field.');
        return true;
      }
    );
  });
});
