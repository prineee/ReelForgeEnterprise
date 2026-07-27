/**
 * ProviderRegistry.ts
 *
 * Registers a lazy factory per ProviderId and constructs + caches the
 * real RenderProvider instance on first resolve() — the same lazy-thunk
 * pattern already used by ai/providers/ProviderFactory.ts, so a provider
 * whose credentials aren't configured (e.g. no LTX_API_KEY) only throws
 * if it is actually selected and resolved, never merely because it's
 * registered. Once resolved, the same instance is reused for every
 * subsequent call for that id — required for the Google/LTX adapters,
 * whose underlying VeoClient caches in-flight operations by id (see
 * GoogleGenAIVeoClient in MovieProductionFactory.ts).
 *
 * createDefaultProviderRegistry() registers every provider named in
 * SPRINT 1: LTX and GOOGLE are real, credential-backed adapters; every
 * other id is a documented placeholder (see providers/gpu/ and
 * providers/future/) that exists so the full roster is addressable today
 * even though only two ids currently do real work — see
 * docs/architecture/render-orchestrator.md.
 */

import type { ProviderId, RenderProvider } from "./interfaces/RenderProvider";
import { LTXCloudProvider } from "./providers/cloud/LTXCloudProvider";
import { GoogleVeoProvider } from "./providers/cloud/GoogleVeoProvider";
import { LocalGPUProvider } from "./providers/gpu/LocalGPUProvider";
import { GPUClusterProvider } from "./providers/gpu/GPUClusterProvider";
import { WanProvider } from "./providers/future/WanProvider";
import { HunyuanProvider } from "./providers/future/HunyuanProvider";
import { CogVideoProvider } from "./providers/future/CogVideoProvider";

type RenderProviderFactory = () => RenderProvider;

export class ProviderRegistry {
  private readonly factories = new Map<ProviderId, RenderProviderFactory>();
  private readonly instances = new Map<ProviderId, RenderProvider>();

  /** Registers (or replaces) the factory for a ProviderId. Does not construct anything. */
  register(id: ProviderId, factory: RenderProviderFactory): void {
    this.factories.set(id, factory);
    this.instances.delete(id);
  }

  /** Returns the cached instance for `id`, constructing it via its factory on first call. */
  resolve(id: ProviderId): RenderProvider {
    const cached = this.instances.get(id);
    if (cached) return cached;

    const factory = this.factories.get(id);
    if (!factory) {
      throw new Error(`No provider registered for id "${id}".`);
    }

    const instance = factory();
    this.instances.set(id, instance);
    return instance;
  }

  has(id: ProviderId): boolean {
    return this.factories.has(id);
  }

  list(): ProviderId[] {
    return Array.from(this.factories.keys());
  }
}

/**
 * Builds the default registry used by RenderOrchestrator when no registry
 * is explicitly injected. See the file-level comment for which ids are
 * real vs. placeholder today.
 */
export function createDefaultProviderRegistry(): ProviderRegistry {
  const registry = new ProviderRegistry();

  // Real, credential-backed adapters.
  registry.register("LTX", () => new LTXCloudProvider());
  registry.register("GOOGLE", () => new GoogleVeoProvider());

  // Self-hosted GPU placeholders — see docs/architecture/render-orchestrator.md.
  registry.register("LOCAL_GPU", () => new LocalGPUProvider());
  registry.register("GPU_CLUSTER", () => new GPUClusterProvider());

  // Future model provider placeholders.
  registry.register("WAN", () => new WanProvider());
  registry.register("HUNYUAN", () => new HunyuanProvider());
  registry.register("COGVIDEO", () => new CogVideoProvider());

  return registry;
}
