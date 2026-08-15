/**
 * ScenePlanner.test.ts
 *
 * Covers the bounded characterIds-retry hardening added to ScenePlanner
 * after production fa1c3b2c-4991-40fe-a075-10d2ed7c0082 failed when Gemini
 * omitted "characterIds" on a scene.
 *
 * Run with: npx tsx --test services/ai/director/ScenePlanner.test.ts
 * (no test framework is configured in this repo — see package.json; this
 * uses Node's built-in node:test/node:assert, transpiled by tsx, matching
 * CameraDirector.test.ts.)
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { ScenePlanner, ScenePlannerParseError } from "./ScenePlanner";
import {
  CameraShot,
  CameraHeight,
  Emotion,
  EmotionTransition,
  Genre,
  Lighting,
  SceneTransition,
  TimeOfDay,
} from "./OutputSchema";
import type { Character, Environment, CameraPlan, EmotionPlan } from "./OutputSchema";
import type { StoryBlueprint, LanguageModelProvider } from "./StoryAnalyzer";

const STORY: StoryBlueprint = {
  title: "Test Story",
  genre: [Genre.Drama],
  theme: "letting go",
  targetAudience: "general",
  estimatedDuration: 60,
  estimatedSceneCount: 1,
  conflict: "grief vs acceptance",
  endingStyle: "bittersweet",
  emotionalArc: ["sad", "hopeful"],
  visualStyle: "gothic naturalism",
};

const CHARACTERS: Character[] = [
  {
    id: "char-1",
    name: "Ava",
    description: "a young explorer",
    appearance: {},
    personality: ["curious"],
    emotionalBaseline: Emotion.Determination,
    wardrobe: ["field jacket"],
    physicalTraits: [],
    voiceProfile: { id: "voice-1" },
    referenceImages: [],
  },
];

const ENVIRONMENTS: Environment[] = [
  {
    id: "env-1",
    name: "Jungle Clearing",
    description: "a dense clearing",
    location: "unknown jungle",
    architecture: "none",
    atmosphere: "eerie",
    props: [],
    ambientSound: "insects",
    dominantColors: ["#0b3d0b"],
    timeOfDay: TimeOfDay.Dusk,
  },
];

const CAMERA_PLANS: CameraPlan[] = [
  {
    id: "cam-1",
    sceneNumber: 1,
    shot: CameraShot.WideShot,
    angle: 0,
    lens: "35mm",
    framing: "centered",
    lighting: Lighting.BlueHour,
    cameraHeight: CameraHeight.EyeLevel,
    focusSubject: { description: "Ava" },
    transitionToNext: SceneTransition.Cut,
    cinematicPurpose: "establish the clearing",
  },
];

const EMOTION_PLANS: EmotionPlan[] = [
  {
    id: "emo-1",
    sceneNumber: 1,
    dominantEmotion: Emotion.Fear,
    intensity: 5,
    transition: EmotionTransition.Rising,
    audienceTarget: "unease",
    pacingNotes: "slow build",
    characterStates: [],
  },
];

function validRawScene() {
  return {
    sceneNumber: 1,
    title: "Into the Jungle",
    summary: "Ava finds a mysterious clearing.",
    characterIds: ["char-1"],
    environmentId: "env-1",
    dialogue: [],
    estimatedRenderCost: 10,
    estimatedRenderTime: 30,
  };
}

function validResponse() {
  return JSON.stringify({ scenes: [validRawScene()] });
}

function missingCharacterIdsResponse() {
  const scene = validRawScene() as Record<string, unknown>;
  delete scene.characterIds;
  return JSON.stringify({ scenes: [scene] });
}

/** A provider whose generate() returns each response in order, once per call. */
function sequencedProvider(responses: string[]): LanguageModelProvider & { callCount: number } {
  let call = 0;
  return {
    get callCount() {
      return call;
    },
    generate: async () => {
      const response = responses[call];
      call += 1;
      return response;
    },
  };
}

describe("ScenePlanner.planScenes — end to end", () => {
  test("existing canonical valid output still passes on the first attempt", async () => {
    const provider = sequencedProvider([validResponse()]);
    const planner = new ScenePlanner(provider);

    const scenes = await planner.planScenes(STORY, CHARACTERS, ENVIRONMENTS, CAMERA_PLANS, EMOTION_PLANS);

    assert.equal(scenes.length, 1);
    assert.equal(scenes[0].characterIds.length, 1);
    assert.equal(scenes[0].characterIds[0], "char-1");
    assert.equal(provider.callCount, 1);
  });

  test("a first malformed characterIds response followed by a valid one succeeds via the bounded retry", async () => {
    const provider = sequencedProvider([missingCharacterIdsResponse(), validResponse()]);
    const planner = new ScenePlanner(provider);

    const scenes = await planner.planScenes(STORY, CHARACTERS, ENVIRONMENTS, CAMERA_PLANS, EMOTION_PLANS);

    assert.equal(scenes.length, 1);
    assert.deepEqual(scenes[0].characterIds, ["char-1"]);
    assert.equal(provider.callCount, 2, "expected exactly one retry (2 total attempts)");
  });

  test("two consecutive malformed characterIds responses fail cleanly with a diagnostic error, never exceeding 2 attempts", async () => {
    const provider = sequencedProvider([missingCharacterIdsResponse(), missingCharacterIdsResponse()]);
    const planner = new ScenePlanner(provider);

    await assert.rejects(
      () => planner.planScenes(STORY, CHARACTERS, ENVIRONMENTS, CAMERA_PLANS, EMOTION_PLANS),
      (err: unknown) => {
        assert.ok(err instanceof ScenePlannerParseError);
        assert.match(err.message, /still invalid after one retry/);
        assert.match(err.message, /characterIds/);
        return true;
      }
    );
    assert.equal(provider.callCount, 2, "must not attempt a third call");
  });

  test("an unknown/fabricated characterId is rejected, not silently accepted, on the retry attempt too", async () => {
    const fabricated = validRawScene();
    fabricated.characterIds = ["char-does-not-exist"];
    const provider = sequencedProvider([
      missingCharacterIdsResponse(),
      JSON.stringify({ scenes: [fabricated] }),
    ]);
    const planner = new ScenePlanner(provider);

    await assert.rejects(
      () => planner.planScenes(STORY, CHARACTERS, ENVIRONMENTS, CAMERA_PLANS, EMOTION_PLANS),
      (err: unknown) => {
        assert.ok(err instanceof ScenePlannerParseError);
        assert.match(err.message, /Unknown characterId referenced: char-does-not-exist/);
        return true;
      }
    );
    assert.equal(provider.callCount, 2);
  });

  test("a non-characterIds failure (e.g. invalid JSON) is not retried at all", async () => {
    const provider = sequencedProvider(["not valid json", validResponse()]);
    const planner = new ScenePlanner(provider);

    await assert.rejects(
      () => planner.planScenes(STORY, CHARACTERS, ENVIRONMENTS, CAMERA_PLANS, EMOTION_PLANS),
      (err: unknown) => {
        assert.ok(err instanceof ScenePlannerParseError);
        assert.match(err.message, /not valid JSON/);
        return true;
      }
    );
    assert.equal(provider.callCount, 1, "non-characterIds failures must fail on the first attempt");
  });
});
