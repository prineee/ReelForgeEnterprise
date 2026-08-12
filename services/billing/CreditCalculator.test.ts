/**
 * CreditCalculator.test.ts
 *
 * Run with: npx tsx --test services/billing/CreditCalculator.test.ts
 * (no test framework is configured in this repo — see CameraDirector.test.ts's
 * file header for the established convention this follows.)
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { CreditCalculator } from "./CreditCalculator";
import { UsageCategory } from "./BillingTypes";

describe("CreditCalculator — billing provider ID mapping (VGE-01)", () => {
  test("GOOGLE prices video at the same multiplier VEO always did (1.1x) — no behavior change for the Veo path", () => {
    const calculator = new CreditCalculator();
    const result = calculator.calculate({ category: UsageCategory.Videos, providerId: "GOOGLE", videoLengthSeconds: 10 });
    // 10 seconds * 1 credit/sec baseline * 1.1x multiplier = 11
    assert.equal(result.credits, 11);
  });

  test("LTX prices video at the neutral default (1x), not VEO's 1.1x — this is the actual bug fix", () => {
    const calculator = new CreditCalculator();
    const result = calculator.calculate({ category: UsageCategory.Videos, providerId: "LTX", videoLengthSeconds: 10 });
    // 10 seconds * 1 credit/sec baseline * 1x multiplier = 10, not 11
    assert.equal(result.credits, 10);
  });

  test("an entirely unknown providerId still prices via DEFAULT_PROVIDER_MULTIPLIER rather than throwing", () => {
    const calculator = new CreditCalculator();
    assert.doesNotThrow(() =>
      calculator.calculate({ category: UsageCategory.Videos, providerId: "SOME_FUTURE_PROVIDER", videoLengthSeconds: 5 })
    );
  });

  test("non-video categories are unaffected by the VGE-01 change — GEMINI/IMAGEN/ELEVENLABS/CLOUDINARY multipliers unchanged", () => {
    const calculator = new CreditCalculator();
    assert.equal(calculator.calculate({ category: UsageCategory.StoryGeneration, providerId: "GEMINI" }).credits, 1);
    assert.equal(
      calculator.calculate({ category: UsageCategory.Images, providerId: "IMAGEN", imageCount: 3 }).credits,
      6
    );
  });
});
