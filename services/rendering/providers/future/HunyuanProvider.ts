/**
 * HunyuanProvider.ts
 *
 * Placeholder for a future Hunyuan model integration. Registered in
 * ProviderRegistry under "HUNYUAN" today purely so the provider roster is
 * complete ahead of the real implementation — see
 * docs/architecture/render-orchestrator.md. Every method throws until a
 * real implementation replaces this class; nothing currently selects
 * "HUNYUAN" (see ProviderSelector.ts).
 */

import { NotImplementedRenderProvider } from "../NotImplementedRenderProvider";

export class HunyuanProvider extends NotImplementedRenderProvider {
  readonly name = "HUNYUAN";
}
