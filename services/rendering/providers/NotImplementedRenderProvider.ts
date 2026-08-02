
/**
 * NotImplementedRenderProvider.ts
 *
 * Shared base for every placeholder provider registered in
 * ProviderRegistry ahead of its real backend existing (self-hosted GPU,
 * GPU cluster, and future model providers — see providers/gpu/ and
 * providers/future/). Registering these today, all throwing the same
 * explicit error, is what lets ProviderRegistry/ProviderSelector already
 * reference a full provider roster without any placeholder being
 * accidentally selectable — see docs/architecture/render-orchestrator.md
 * for the GPU migration plan this exists to support.
 *
 * Concrete placeholders only need to set `name` — the identical
 * generate()/checkStatus()/download() bodies live here exactly once.
 */

import type { RenderProvider, RenderRequest } from "../interfaces/RenderProvider";
import type { RenderResult } from "../interfaces/RenderResult";

export abstract class NotImplementedRenderProvider implements RenderProvider {
  abstract readonly name: string;

  async generate(_request: RenderRequest): Promise<RenderResult> {
    throw new Error("Provider not implemented.");
  }

  async checkStatus(_jobId: string): Promise<RenderResult> {
    throw new Error("Provider not implemented.");
  }

  async download(_jobId: string): Promise<RenderResult> {
    throw new Error("Provider not implemented.");
  }
}
