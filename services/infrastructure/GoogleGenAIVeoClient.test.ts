/**
 * GoogleGenAIVeoClient.test.ts
 *
 * Run with: npx tsx --test services/infrastructure/GoogleGenAIVeoClient.test.ts
 * (no test framework is configured in this repo — see CameraDirector.test.ts's
 * file header for the established convention this follows.)
 *
 * Every test injects a fake `ai` object shaped like GoogleGenAI (models.generateVideos,
 * operations.getVideosOperation) — no real @google/genai network call is
 * ever made, per VGE-02's "tests must not consume real paid Veo generations."
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { GoogleGenAIVeoClient } from "./MovieProductionFactory";
import { VeoProviderError } from "../rendering/providers/cloud/VeoProviderError";
import type { VeoRequest } from "../ai/providers/google/VeoService";

function fakeAi(generateVideosImpl: (params: unknown) => Promise<{ name?: string; done?: boolean }>) {
  return {
    models: { generateVideos: generateVideosImpl },
    operations: { getVideosOperation: async () => ({ done: true }) },
  };
}

function baseRequest(overrides: Partial<VeoRequest> = {}): VeoRequest {
  return { prompt: "A young woman discovers a mysterious door in an ancient jungle.", ...overrides };
}

describe("GoogleGenAIVeoClient — text-to-video request translation", () => {
  test("sends model/prompt/aspectRatio/durationSeconds/resolution with defaults applied", async () => {
    let captured: any;
    const client = new GoogleGenAIVeoClient(fakeAi(async (params) => {
      captured = params;
      return { name: "op-1", done: false };
    }) as any);

    await client.generate(baseRequest());

    assert.equal(captured.model, "veo-3.1-generate-preview");
    assert.equal(captured.prompt, "A young woman discovers a mysterious door in an ancient jungle.");
    assert.equal(captured.config.aspectRatio, "9:16");
    assert.equal(captured.config.durationSeconds, 8);
    assert.equal(captured.config.resolution, "720p");
    assert.equal(captured.config.numberOfVideos, 1);
    assert.equal(captured.image, undefined);
    assert.equal(captured.video, undefined);
  });

  test("passes negativePrompt through (previously silently dropped — see VGE-02 audit)", async () => {
    let captured: any;
    const client = new GoogleGenAIVeoClient(fakeAi(async (params) => {
      captured = params;
      return { name: "op-1", done: false };
    }) as any);

    await client.generate(baseRequest({ negativePrompt: "no text overlays, no watermarks" }));
    assert.equal(captured.config.negativePrompt, "no text overlays, no watermarks");
  });

  test("passes requiresAudio through as generateAudio", async () => {
    let captured: any;
    const client = new GoogleGenAIVeoClient(fakeAi(async (params) => {
      captured = params;
      return { name: "op-1", done: false };
    }) as any);

    await client.generate(baseRequest({ requiresAudio: true }));
    assert.equal(captured.config.generateAudio, true);
  });

  test("honors an explicit 1080p resolution request via quality", async () => {
    let captured: any;
    const client = new GoogleGenAIVeoClient(fakeAi(async (params) => {
      captured = params;
      return { name: "op-1", done: false };
    }) as any);

    await client.generate(baseRequest({ quality: "1080p", durationSeconds: 8 }));
    assert.equal(captured.config.resolution, "1080p");
  });
});

describe("GoogleGenAIVeoClient — image-to-video request translation", () => {
  test("sends a base64 image at the top level", async () => {
    let captured: any;
    const client = new GoogleGenAIVeoClient(fakeAi(async (params) => {
      captured = params;
      return { name: "op-1", done: false };
    }) as any);

    await client.generate(baseRequest({ image: { base64: "ZmFrZS1ieXRlcw==", mimeType: "image/png" } }));
    assert.deepEqual(captured.image, { imageBytes: "ZmFrZS1ieXRlcw==", mimeType: "image/png" });
  });

  test("sends a gs:// image URL as gcsUri", async () => {
    let captured: any;
    const client = new GoogleGenAIVeoClient(fakeAi(async (params) => {
      captured = params;
      return { name: "op-1", done: false };
    }) as any);

    await client.generate(baseRequest({ image: { url: "gs://reelforge-assets/ref.png" } }));
    assert.equal(captured.image.gcsUri, "gs://reelforge-assets/ref.png");
  });

  test("rejects a plain HTTPS image URL — Veo's Image type does not accept arbitrary URLs", async () => {
    const client = new GoogleGenAIVeoClient(fakeAi(async () => ({ name: "op-1", done: false })) as any);

    await assert.rejects(
      () => client.generate(baseRequest({ image: { url: "https://res.cloudinary.com/demo/ref.png" } })),
      (error: unknown) => error instanceof VeoProviderError && error.code === "UNSUPPORTED_CAPABILITY"
    );
  });

  test("sends lastFrame alongside image for first/last-frame interpolation, forcing duration to 8", async () => {
    let captured: any;
    const client = new GoogleGenAIVeoClient(fakeAi(async (params) => {
      captured = params;
      return { name: "op-1", done: false };
    }) as any);

    await client.generate(
      baseRequest({
        image: { base64: "Zmly", mimeType: "image/png" },
        lastFrame: { base64: "bGFzdA==", mimeType: "image/png" },
        durationSeconds: 8,
      })
    );
    assert.deepEqual(captured.config.lastFrame, { imageBytes: "bGFzdA==", mimeType: "image/png" });
  });
});

describe("GoogleGenAIVeoClient — duration validation", () => {
  test("rejects an unsupported duration", async () => {
    const client = new GoogleGenAIVeoClient(fakeAi(async () => ({ name: "op-1", done: false })) as any);
    await assert.rejects(
      () => client.generate(baseRequest({ durationSeconds: 5 })),
      (error: unknown) => error instanceof VeoProviderError && error.code === "INVALID_DURATION"
    );
  });

  test("accepts every documented duration (4/6/8)", async () => {
    for (const durationSeconds of [4, 6, 8]) {
      const client = new GoogleGenAIVeoClient(fakeAi(async () => ({ name: "op-1", done: false })) as any);
      await assert.doesNotReject(() => client.generate(baseRequest({ durationSeconds })));
    }
  });

  test("rejects lastFrame with a non-8 duration (Veo requires exactly 8s for interpolation)", async () => {
    const client = new GoogleGenAIVeoClient(fakeAi(async () => ({ name: "op-1", done: false })) as any);
    await assert.rejects(
      () =>
        client.generate(
          baseRequest({
            image: { base64: "Zmly" },
            lastFrame: { base64: "bGFzdA==" },
            durationSeconds: 6,
          })
        ),
      (error: unknown) => error instanceof VeoProviderError && error.code === "INVALID_DURATION"
    );
  });

  test("rejects 1080p with a non-8 duration", async () => {
    const client = new GoogleGenAIVeoClient(fakeAi(async () => ({ name: "op-1", done: false })) as any);
    await assert.rejects(
      () => client.generate(baseRequest({ quality: "1080p", durationSeconds: 4 })),
      (error: unknown) => error instanceof VeoProviderError && error.code === "INVALID_DURATION"
    );
  });
});

describe("GoogleGenAIVeoClient — unsupported capability rejection", () => {
  test("rejects image + extendVideo together (mutually exclusive per SDK)", async () => {
    const client = new GoogleGenAIVeoClient(fakeAi(async () => ({ name: "op-1", done: false })) as any);
    await assert.rejects(
      () =>
        client.generate(
          baseRequest({
            image: { base64: "Zmly" },
            extendVideo: { base64: "dmlkZW8=" },
          })
        ),
      (error: unknown) => error instanceof VeoProviderError && error.code === "INVALID_REQUEST"
    );
  });

  test("rejects lastFrame without image", async () => {
    const client = new GoogleGenAIVeoClient(fakeAi(async () => ({ name: "op-1", done: false })) as any);
    await assert.rejects(
      () => client.generate(baseRequest({ lastFrame: { base64: "bGFzdA==" } })),
      (error: unknown) => error instanceof VeoProviderError && error.code === "INVALID_REQUEST"
    );
  });

  test("rejects referenceImages combined with image", async () => {
    const client = new GoogleGenAIVeoClient(fakeAi(async () => ({ name: "op-1", done: false })) as any);
    await assert.rejects(
      () =>
        client.generate(
          baseRequest({
            image: { base64: "Zmly" },
            referenceImages: [{ asset: { base64: "cmVm" }, type: "ASSET" }],
          })
        ),
      (error: unknown) => error instanceof VeoProviderError && error.code === "INVALID_REQUEST"
    );
  });

  test("rejects more than 3 ASSET reference images", async () => {
    const client = new GoogleGenAIVeoClient(fakeAi(async () => ({ name: "op-1", done: false })) as any);
    await assert.rejects(
      () =>
        client.generate(
          baseRequest({
            referenceImages: [
              { asset: { base64: "YQ==" }, type: "ASSET" },
              { asset: { base64: "Yg==" }, type: "ASSET" },
              { asset: { base64: "Yw==" }, type: "ASSET" },
              { asset: { base64: "ZA==" }, type: "ASSET" },
            ],
          })
        ),
      (error: unknown) => error instanceof VeoProviderError && error.code === "UNSUPPORTED_CAPABILITY"
    );
  });

  test("rejects an unsupported aspect ratio", async () => {
    const client = new GoogleGenAIVeoClient(fakeAi(async () => ({ name: "op-1", done: false })) as any);
    await assert.rejects(
      () => client.generate(baseRequest({ aspectRatio: "1:1" })),
      (error: unknown) => error instanceof VeoProviderError && error.code === "INVALID_REQUEST"
    );
  });

  test("rejects an unsupported resolution", async () => {
    const client = new GoogleGenAIVeoClient(fakeAi(async () => ({ name: "op-1", done: false })) as any);
    await assert.rejects(
      () => client.generate(baseRequest({ quality: "4k" })),
      (error: unknown) => error instanceof VeoProviderError && error.code === "INVALID_RESOLUTION"
    );
  });
});

describe("GoogleGenAIVeoClient — error normalization", () => {
  test("wraps a thrown SDK error as GENERATION_FAILED by default", async () => {
    const client = new GoogleGenAIVeoClient(fakeAi(async () => {
      throw new Error("internal server error");
    }) as any);

    await assert.rejects(
      () => client.generate(baseRequest()),
      (error: unknown) => error instanceof VeoProviderError && error.code === "GENERATION_FAILED"
    );
  });

  test("classifies an API-key-flavored SDK error as AUTHENTICATION_FAILED", async () => {
    const client = new GoogleGenAIVeoClient(fakeAi(async () => {
      throw new Error("Request had invalid API key.");
    }) as any);

    await assert.rejects(
      () => client.generate(baseRequest()),
      (error: unknown) => error instanceof VeoProviderError && error.code === "AUTHENTICATION_FAILED"
    );
  });

  test("does not double-wrap a VeoProviderError thrown by validation", async () => {
    const client = new GoogleGenAIVeoClient(fakeAi(async () => ({ name: "op-1", done: false })) as any);
    try {
      await client.generate(baseRequest({ durationSeconds: 3 }));
      assert.fail("expected a throw");
    } catch (error) {
      assert.ok(error instanceof VeoProviderError);
      assert.equal((error as VeoProviderError).code, "INVALID_DURATION");
    }
  });
});
