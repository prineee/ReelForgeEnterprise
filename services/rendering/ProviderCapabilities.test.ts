/**
 * ProviderCapabilities.test.ts
 *
 * Run with: npx tsx --test services/rendering/ProviderCapabilities.test.ts
 * (no test framework is configured in this repo — see CameraDirector.test.ts's
 * file header for the established convention this follows.)
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  PROVIDER_DESCRIPTORS,
  normalizeProviderId,
  resolveActiveVideoProviderId,
  ProviderAvailabilityStatus,
} from "./ProviderCapabilities";

describe("PROVIDER_DESCRIPTORS — capability declaration", () => {
  test("every rendering ProviderId has a descriptor", () => {
    const expectedIds = ["LTX", "GOOGLE", "LOCAL_GPU", "GPU_CLUSTER", "WAN", "HUNYUAN", "COGVIDEO"];
    for (const id of expectedIds) {
      assert.ok(PROVIDER_DESCRIPTORS[id as keyof typeof PROVIDER_DESCRIPTORS], `missing descriptor for "${id}"`);
    }
  });

  test("LTX is declared available with textToVideo only", () => {
    const ltx = PROVIDER_DESCRIPTORS.LTX;
    assert.equal(ltx.availability, ProviderAvailabilityStatus.Available);
    assert.equal(ltx.capabilities.textToVideo, true);
    assert.equal(ltx.capabilities.imageToVideo, false);
    assert.equal(ltx.capabilities.firstLastFrame, false);
  });

  test("GOOGLE is declared available with textToVideo only (image-to-video not yet wired in this codebase's client)", () => {
    const google = PROVIDER_DESCRIPTORS.GOOGLE;
    assert.equal(google.availability, ProviderAvailabilityStatus.Available);
    assert.equal(google.capabilities.textToVideo, true);
    assert.equal(google.capabilities.imageToVideo, false);
    assert.equal(google.capabilities.nativeAudio, false);
  });

  test("placeholder providers declare no capabilities and PLACEHOLDER availability", () => {
    for (const id of ["LOCAL_GPU", "GPU_CLUSTER", "WAN", "HUNYUAN", "COGVIDEO"] as const) {
      const descriptor = PROVIDER_DESCRIPTORS[id];
      assert.equal(descriptor.availability, ProviderAvailabilityStatus.Placeholder);
      assert.equal(descriptor.capabilities.textToVideo, false);
      assert.deepEqual(descriptor.supportedDurations, []);
    }
  });
});

describe("normalizeProviderId — provider ID normalization", () => {
  test("accepts exact-case known ids", () => {
    assert.equal(normalizeProviderId("LTX"), "LTX");
    assert.equal(normalizeProviderId("GOOGLE"), "GOOGLE");
  });

  test("accepts lowercase and mixed-case input", () => {
    assert.equal(normalizeProviderId("ltx"), "LTX");
    assert.equal(normalizeProviderId("GoOgLe"), "GOOGLE");
  });

  test("trims surrounding whitespace", () => {
    assert.equal(normalizeProviderId("  ltx  "), "LTX");
  });

  test("returns undefined for an unknown id, never throws", () => {
    assert.equal(normalizeProviderId("RUNWAY"), undefined);
    assert.equal(normalizeProviderId("LUMA"), undefined);
    assert.equal(normalizeProviderId(""), undefined);
  });
});

describe("resolveActiveVideoProviderId", () => {
  test("defaults to GOOGLE when VIDEO_PROVIDER is unset", () => {
    const original = process.env.VIDEO_PROVIDER;
    delete process.env.VIDEO_PROVIDER;
    try {
      assert.equal(resolveActiveVideoProviderId(), "GOOGLE");
    } finally {
      if (original === undefined) delete process.env.VIDEO_PROVIDER;
      else process.env.VIDEO_PROVIDER = original;
    }
  });

  test("resolves to LTX when VIDEO_PROVIDER=ltx (case-insensitive)", () => {
    const original = process.env.VIDEO_PROVIDER;
    process.env.VIDEO_PROVIDER = "ltx";
    try {
      assert.equal(resolveActiveVideoProviderId(), "LTX");
    } finally {
      if (original === undefined) delete process.env.VIDEO_PROVIDER;
      else process.env.VIDEO_PROVIDER = original;
    }
  });
});

describe("PROVIDER_DESCRIPTORS — no mutation of provider capability definitions", () => {
  test("the top-level table is frozen", () => {
    assert.ok(Object.isFrozen(PROVIDER_DESCRIPTORS));
  });

  test("each descriptor is frozen", () => {
    for (const descriptor of Object.values(PROVIDER_DESCRIPTORS)) {
      assert.ok(Object.isFrozen(descriptor), `descriptor "${descriptor.id}" is not frozen`);
    }
  });

  test("each descriptor's capabilities object is frozen", () => {
    for (const descriptor of Object.values(PROVIDER_DESCRIPTORS)) {
      assert.ok(Object.isFrozen(descriptor.capabilities), `capabilities for "${descriptor.id}" is not frozen`);
    }
  });

  test("attempting to mutate a capability flag does not change it", () => {
    const google = PROVIDER_DESCRIPTORS.GOOGLE;
    try {
      // @ts-expect-error — intentionally violating readonly to prove the runtime freeze holds too.
      google.capabilities.imageToVideo = true;
    } catch {
      // Whether this throws depends on strict-mode context, which the test
      // runner doesn't guarantee here — the freeze's actual guarantee is
      // that the value doesn't change either way, asserted below.
    }
    assert.equal(PROVIDER_DESCRIPTORS.GOOGLE.capabilities.imageToVideo, false);
  });

  test("attempting to add a new key to the top-level table does not change it", () => {
    try {
      // @ts-expect-error — intentionally violating the frozen table to prove the runtime freeze holds too.
      PROVIDER_DESCRIPTORS.RUNWAY = PROVIDER_DESCRIPTORS.LTX;
    } catch {
      // See the note above — freeze's guarantee is the value never changes.
    }
    assert.equal("RUNWAY" in PROVIDER_DESCRIPTORS, false);
  });
});
