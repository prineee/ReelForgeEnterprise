/**
 * ProviderRegistry.test.ts
 *
 * Run with: npx tsx --test services/rendering/ProviderRegistry.test.ts
 * (no test framework is configured in this repo — see CameraDirector.test.ts's
 * file header for the established convention this follows.)
 *
 * Deliberately never calls resolve("LTX")/resolve("GOOGLE") on
 * createDefaultProviderRegistry() — that would construct a real,
 * credential-backed LTXCloudProvider/GoogleVeoProvider and, per VGE-01's
 * "do not run a real AI video generation," this suite stays at the
 * registration/lookup level instead of instantiating live provider
 * clients.
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { ProviderRegistry, UnknownProviderError, createDefaultProviderRegistry } from "./ProviderRegistry";
import type { RenderProvider, RenderRequest } from "./interfaces/RenderProvider";
import type { RenderResult } from "./interfaces/RenderResult";

function fakeProvider(name: string): RenderProvider {
  return {
    name,
    async generate(_request: RenderRequest): Promise<RenderResult> {
      return { jobId: "fake-job", status: "COMPLETED", provider: name };
    },
    async checkStatus(jobId: string): Promise<RenderResult> {
      return { jobId, status: "COMPLETED", provider: name };
    },
    async download(jobId: string): Promise<RenderResult> {
      return { jobId, status: "COMPLETED", provider: name };
    },
  };
}

describe("ProviderRegistry — backward compatibility (register/resolve/has/list)", () => {
  test("register + resolve returns the constructed instance", () => {
    const registry = new ProviderRegistry();
    registry.register("LTX", () => fakeProvider("fake-ltx"));
    const instance = registry.resolve("LTX");
    assert.equal(instance.name, "fake-ltx");
  });

  test("resolve caches — the factory only runs once per id", () => {
    const registry = new ProviderRegistry();
    let calls = 0;
    registry.register("GOOGLE", () => {
      calls += 1;
      return fakeProvider("fake-google");
    });
    const first = registry.resolve("GOOGLE");
    const second = registry.resolve("GOOGLE");
    assert.equal(calls, 1);
    assert.equal(first, second);
  });

  test("resolve throws a plain Error for an id with no registered factory", () => {
    const registry = new ProviderRegistry();
    assert.throws(() => registry.resolve("LTX"), /No provider registered for id "LTX"/);
  });

  test("has()/list() reflect exactly what's been registered", () => {
    const registry = new ProviderRegistry();
    assert.equal(registry.has("LTX"), false);
    registry.register("LTX", () => fakeProvider("fake-ltx"));
    assert.equal(registry.has("LTX"), true);
    assert.deepEqual(registry.list(), ["LTX"]);
  });

  test("re-registering an id clears its cached instance", () => {
    const registry = new ProviderRegistry();
    registry.register("LTX", () => fakeProvider("first"));
    const first = registry.resolve("LTX");
    registry.register("LTX", () => fakeProvider("second"));
    const second = registry.resolve("LTX");
    assert.notEqual(first, second);
    assert.equal(second.name, "second");
  });
});

describe("ProviderRegistry — provider registry lookup", () => {
  test("getDescriptor returns the declarative capability data for a known id", () => {
    const registry = new ProviderRegistry();
    const descriptor = registry.getDescriptor("LTX");
    assert.equal(descriptor.id, "LTX");
    assert.equal(descriptor.capabilities.textToVideo, true);
  });

  test("listAvailable includes only AVAILABLE providers, not placeholders", () => {
    const registry = new ProviderRegistry();
    const available = registry.listAvailable().map((d) => d.id);
    assert.ok(available.includes("LTX"));
    assert.ok(available.includes("GOOGLE"));
    assert.ok(!available.includes("WAN"));
    assert.ok(!available.includes("LOCAL_GPU"));
  });
});

describe("ProviderRegistry — unknown provider rejection", () => {
  test("resolveId throws UnknownProviderError for an unrecognized id", () => {
    const registry = new ProviderRegistry();
    assert.throws(() => registry.resolveId("RUNWAY"), UnknownProviderError);
    assert.throws(() => registry.resolveId("LUMA"), UnknownProviderError);
  });

  test("resolveId succeeds for a known id regardless of casing", () => {
    const registry = new ProviderRegistry();
    assert.equal(registry.resolveId("ltx"), "LTX");
    assert.equal(registry.resolveId("Google"), "GOOGLE");
  });
});

describe("createDefaultProviderRegistry — existing LTX lookup", () => {
  test("LTX is registered", () => {
    assert.equal(createDefaultProviderRegistry().has("LTX"), true);
  });

  test("LTX's descriptor is available with textToVideo capability", () => {
    const descriptor = createDefaultProviderRegistry().getDescriptor("LTX");
    assert.equal(descriptor.availability, "AVAILABLE");
    assert.equal(descriptor.capabilities.textToVideo, true);
  });
});

describe("createDefaultProviderRegistry — existing Veo lookup", () => {
  test("GOOGLE is registered", () => {
    assert.equal(createDefaultProviderRegistry().has("GOOGLE"), true);
  });

  test("GOOGLE's descriptor is available with textToVideo capability", () => {
    const descriptor = createDefaultProviderRegistry().getDescriptor("GOOGLE");
    assert.equal(descriptor.availability, "AVAILABLE");
    assert.equal(descriptor.capabilities.textToVideo, true);
  });
});

describe("createDefaultProviderRegistry — full existing roster preserved", () => {
  test("every previously-registered id is still registered", () => {
    const registry = createDefaultProviderRegistry();
    for (const id of ["LTX", "GOOGLE", "LOCAL_GPU", "GPU_CLUSTER", "WAN", "HUNYUAN", "COGVIDEO"] as const) {
      assert.equal(registry.has(id), true, `expected "${id}" to still be registered`);
    }
  });
});
