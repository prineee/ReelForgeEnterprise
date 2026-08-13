/**
 * GoogleVeoProvider.test.ts
 *
 * Run with: npx tsx --test services/rendering/providers/cloud/GoogleVeoProvider.test.ts
 * (no test framework is configured in this repo — see CameraDirector.test.ts's
 * file header for the established convention this follows.)
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { GoogleVeoProvider } from "./GoogleVeoProvider";
import { BaseVeoClientProvider } from "./BaseVeoClientProvider";
import { VeoProviderError } from "./VeoProviderError";
import type { VeoClient, VeoRequest, VeoResponse, GeneratedVideo } from "../../../ai/providers/google/VeoService";

describe("GoogleVeoProvider — construction", () => {
  test("constructs successfully with an explicit API key", () => {
    assert.doesNotThrow(() => new GoogleVeoProvider("fake-key"));
  });

  test("constructs successfully by falling back to GEMINI_API_KEY", () => {
    const original = process.env.GEMINI_API_KEY;
    process.env.GEMINI_API_KEY = "fake-env-key";
    try {
      assert.doesNotThrow(() => new GoogleVeoProvider());
    } finally {
      if (original === undefined) delete process.env.GEMINI_API_KEY;
      else process.env.GEMINI_API_KEY = original;
    }
  });
});

describe("GoogleVeoProvider — missing API key", () => {
  test("throws MISSING_API_KEY when neither an explicit key nor GEMINI_API_KEY is available", () => {
    const original = process.env.GEMINI_API_KEY;
    delete process.env.GEMINI_API_KEY;
    try {
      assert.throws(
        () => new GoogleVeoProvider(),
        (error: unknown) => error instanceof VeoProviderError && error.code === "MISSING_API_KEY"
      );
    } finally {
      if (original === undefined) delete process.env.GEMINI_API_KEY;
      else process.env.GEMINI_API_KEY = original;
    }
  });

  test("throws MISSING_API_KEY when an explicit empty string is passed", () => {
    assert.throws(
      () => new GoogleVeoProvider(""),
      (error: unknown) => error instanceof VeoProviderError && error.code === "MISSING_API_KEY"
    );
  });
});

describe("GoogleVeoProvider — provider ID", () => {
  test("name is the canonical rendering-layer id GOOGLE, matching ProviderCapabilities/CreditCalculator", () => {
    const provider = new GoogleVeoProvider("fake-key");
    assert.equal(provider.name, "GOOGLE");
  });
});

// Fake VeoClient — no real @google/genai call, per VGE-02's "must not consume real paid Veo generations."
class FakeVeoClient implements VeoClient {
  constructor(
    private readonly responses: {
      generate?: VeoResponse;
      checkStatus?: VeoResponse;
      download?: GeneratedVideo;
    }
  ) {}
  async generate(_request: VeoRequest): Promise<VeoResponse> {
    return this.responses.generate ?? { operationId: "op-1", status: "PENDING" };
  }
  async checkStatus(_operationId: string): Promise<VeoResponse> {
    return this.responses.checkStatus ?? { operationId: "op-1", status: "PROCESSING" };
  }
  async download(_operationId: string): Promise<GeneratedVideo> {
    return this.responses.download ?? { url: "https://example.com/video.mp4" };
  }
}

class TestVeoProvider extends BaseVeoClientProvider {
  readonly name = "GOOGLE";
}

describe("BaseVeoClientProvider — RenderResult compatibility", () => {
  test("generate() maps a COMPLETED VeoResponse into a RenderResult with the provider's name", async () => {
    const provider = new TestVeoProvider(new FakeVeoClient({ generate: { operationId: "op-42", status: "COMPLETED" } }));
    const result = await provider.generate({ prompt: "test" });
    assert.equal(result.jobId, "op-42");
    assert.equal(result.status, "COMPLETED");
    assert.equal(result.provider, "GOOGLE");
  });

  test("checkStatus() propagates a FAILED status with its error message", async () => {
    const provider = new TestVeoProvider(
      new FakeVeoClient({ checkStatus: { operationId: "op-1", status: "FAILED", error: "Veo operation failed: quota exceeded" } })
    );
    const result = await provider.checkStatus("op-1");
    assert.equal(result.status, "FAILED");
    assert.equal(result.error, "Veo operation failed: quota exceeded");
  });

  test("download() maps GeneratedVideo fields into RenderResult", async () => {
    const provider = new TestVeoProvider(
      new FakeVeoClient({
        download: { url: "https://example.com/video.mp4", thumbnailUrl: "https://example.com/thumb.jpg", durationSeconds: 8, resolution: "720p" },
      })
    );
    const result = await provider.download("op-1");
    assert.equal(result.videoUrl, "https://example.com/video.mp4");
    assert.equal(result.thumbnail, "https://example.com/thumb.jpg");
    assert.equal(result.duration, 8);
    assert.equal(result.resolution, "720p");
    assert.equal(result.status, "COMPLETED");
  });

  test("RenderResult always carries jobId/status/provider even with a minimal VeoResponse", async () => {
    const provider = new TestVeoProvider(new FakeVeoClient({ generate: { operationId: "op-1", status: "PENDING" } }));
    const result = await provider.generate({ prompt: "test" });
    assert.equal(typeof result.jobId, "string");
    assert.equal(typeof result.status, "string");
    assert.equal(typeof result.provider, "string");
  });
});
