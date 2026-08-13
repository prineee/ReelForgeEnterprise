/**
 * RenderOrchestrator.test.ts
 *
 * Run with: npx tsx --test services/rendering/RenderOrchestrator.test.ts
 * (no test framework is configured in this repo — see CameraDirector.test.ts's
 * file header for the established convention this follows.)
 *
 * C1 regression suite (post-VGE-02 review): proves renderAndWait() returns
 * a FAILED RenderResult — never throws — when a provider's checkStatus()
 * or download() rejects. Before the C1 fix, these tests would fail with
 * an uncaught rejection instead of a returned FAILED result.
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { RenderOrchestrator } from "./RenderOrchestrator";
import { ProviderRegistry } from "./ProviderRegistry";
import { ProviderSelector } from "./ProviderSelector";
import type { RenderProvider, RenderRequest } from "./interfaces/RenderProvider";
import type { RenderResult } from "./interfaces/RenderResult";
import { VeoProviderError } from "./providers/cloud/VeoProviderError";

/** Deterministically selects GOOGLE regardless of VIDEO_PROVIDER, so this suite never depends on/mutates that env var. */
class FixedProviderSelector extends ProviderSelector {
  select(): "GOOGLE" {
    return "GOOGLE";
  }
}

class ScriptedProvider implements RenderProvider {
  readonly name = "GOOGLE";
  constructor(
    private readonly script: {
      generate?: () => Promise<RenderResult>;
      checkStatus?: () => Promise<RenderResult>;
      download?: () => Promise<RenderResult>;
    }
  ) {}
  async generate(_request: RenderRequest): Promise<RenderResult> {
    return this.script.generate ? this.script.generate() : { jobId: "provider-job-1", status: "PENDING", provider: "GOOGLE" };
  }
  async checkStatus(_jobId: string): Promise<RenderResult> {
    if (this.script.checkStatus) return this.script.checkStatus();
    return { jobId: "provider-job-1", status: "PROCESSING", provider: "GOOGLE" };
  }
  async download(_jobId: string): Promise<RenderResult> {
    if (this.script.download) return this.script.download();
    return { jobId: "provider-job-1", status: "COMPLETED", provider: "GOOGLE", videoUrl: "https://example.com/v.mp4" };
  }
}

function buildOrchestrator(provider: RenderProvider): RenderOrchestrator {
  const registry = new ProviderRegistry();
  registry.register("GOOGLE", () => provider);
  return new RenderOrchestrator(registry, new FixedProviderSelector());
}

describe("RenderOrchestrator — renderAndWait() when checkStatus() throws (C1 regression)", () => {
  test("returns a FAILED RenderResult instead of throwing", async () => {
    const provider = new ScriptedProvider({
      checkStatus: async () => {
        throw new VeoProviderError("POLLING_FAILED", "Veo polling failed: transient network error");
      },
    });
    const orchestrator = buildOrchestrator(provider);

    const result = await orchestrator.renderAndWait({ prompt: "test" }, undefined, { pollIntervalMs: 1, maxAttempts: 1 });

    assert.equal(result.status, "FAILED");
    assert.equal(result.provider, "GOOGLE");
  });

  test("preserves the provider error code and a useful message", async () => {
    const provider = new ScriptedProvider({
      checkStatus: async () => {
        throw new VeoProviderError("POLLING_FAILED", "Veo polling failed: transient network error");
      },
    });
    const orchestrator = buildOrchestrator(provider);

    const result = await orchestrator.renderAndWait({ prompt: "test" }, undefined, { pollIntervalMs: 1, maxAttempts: 1 });

    assert.match(result.error ?? "", /POLLING_FAILED/);
    assert.match(result.error ?? "", /transient network error/);
    assert.equal(result.metadata?.errorCode, "POLLING_FAILED");
  });

  test("does not retry and does not fall back to a different provider", async () => {
    let checkStatusCalls = 0;
    const provider = new ScriptedProvider({
      checkStatus: async () => {
        checkStatusCalls += 1;
        throw new VeoProviderError("POLLING_FAILED", "boom");
      },
    });
    const orchestrator = buildOrchestrator(provider);

    const result = await orchestrator.renderAndWait({ prompt: "test" }, undefined, { pollIntervalMs: 1, maxAttempts: 5 });

    assert.equal(checkStatusCalls, 1, "a single checkStatus failure must return FAILED immediately, not retry");
    assert.equal(result.provider, "GOOGLE", "must not fall back to a different provider (e.g. LTX)");
  });
});

describe("RenderOrchestrator — renderAndWait() when download() throws (C1 regression)", () => {
  test("returns a FAILED RenderResult instead of throwing, when generate() completes synchronously", async () => {
    const provider = new ScriptedProvider({
      generate: async () => ({ jobId: "provider-job-1", status: "COMPLETED", provider: "GOOGLE" }), // COMPLETED with no videoUrl yet -> ensureDownloaded() calls download()
      download: async () => {
        throw new VeoProviderError("DOWNLOAD_FAILED", "Veo operation reported done but returned no video URI.");
      },
    });
    const orchestrator = buildOrchestrator(provider);

    const result = await orchestrator.renderAndWait({ prompt: "test" });

    assert.equal(result.status, "FAILED");
    assert.match(result.error ?? "", /DOWNLOAD_FAILED/);
    assert.equal(result.metadata?.errorCode, "DOWNLOAD_FAILED");
  });

  test("returns a FAILED RenderResult instead of throwing, when download() is reached via the poll loop", async () => {
    const provider = new ScriptedProvider({
      checkStatus: async () => ({ jobId: "provider-job-1", status: "COMPLETED", provider: "GOOGLE" }),
      download: async () => {
        throw new VeoProviderError("DOWNLOAD_FAILED", "no video URI");
      },
    });
    const orchestrator = buildOrchestrator(provider);

    const result = await orchestrator.renderAndWait({ prompt: "test" }, undefined, { pollIntervalMs: 1, maxAttempts: 3 });

    assert.equal(result.status, "FAILED");
    assert.equal(result.metadata?.errorCode, "DOWNLOAD_FAILED");
  });
});

describe("RenderOrchestrator — checkStatus()/download() called directly (not just via renderAndWait)", () => {
  test("checkStatus() itself returns FAILED rather than throwing", async () => {
    const provider = new ScriptedProvider({
      checkStatus: async () => {
        throw new VeoProviderError("POLLING_FAILED", "boom");
      },
    });
    const orchestrator = buildOrchestrator(provider);

    const submitted = await orchestrator.render({ prompt: "test" });
    const result = await orchestrator.checkStatus(submitted.jobId);

    assert.equal(result.status, "FAILED");
    assert.equal(result.metadata?.errorCode, "POLLING_FAILED");
  });

  test("download() itself returns FAILED rather than throwing", async () => {
    const provider = new ScriptedProvider({
      download: async () => {
        throw new VeoProviderError("DOWNLOAD_FAILED", "boom");
      },
    });
    const orchestrator = buildOrchestrator(provider);

    const submitted = await orchestrator.render({ prompt: "test" });
    const result = await orchestrator.download(submitted.jobId);

    assert.equal(result.status, "FAILED");
    assert.equal(result.metadata?.errorCode, "DOWNLOAD_FAILED");
  });

  test("a non-VeoProviderError (plain Error) is still converted to a FAILED result, with no errorCode metadata", async () => {
    const provider = new ScriptedProvider({
      checkStatus: async () => {
        throw new Error("plain unexpected error");
      },
    });
    const orchestrator = buildOrchestrator(provider);

    const submitted = await orchestrator.render({ prompt: "test" });
    const result = await orchestrator.checkStatus(submitted.jobId);

    assert.equal(result.status, "FAILED");
    assert.match(result.error ?? "", /plain unexpected error/);
    assert.equal(result.metadata?.errorCode, undefined);
  });
});

describe("RenderOrchestrator — render() failure path is unaffected by the C1 fix (regression check)", () => {
  test("generate() throwing still returns a FAILED RenderResult (pre-existing behavior, unchanged)", async () => {
    const provider = new ScriptedProvider({
      generate: async () => {
        throw new VeoProviderError("GENERATION_FAILED", "boom");
      },
    });
    const orchestrator = buildOrchestrator(provider);

    const result = await orchestrator.render({ prompt: "test" });
    assert.equal(result.status, "FAILED");
    assert.equal(result.metadata?.errorCode, "GENERATION_FAILED");
  });
});
