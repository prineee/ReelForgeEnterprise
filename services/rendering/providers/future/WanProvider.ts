/**
 * WanProvider.ts
 *
 * Placeholder for a future Wan model integration. Registered in
 * ProviderRegistry under "WAN" today purely so the provider roster is
 * complete ahead of the real implementation — see
 * docs/architecture/render-orchestrator.md. Every method throws until a
 * real implementation replaces this class; nothing currently selects
 * "WAN" (see ProviderSelector.ts).
 */

import { NotImplementedRenderProvider } from "../NotImplementedRenderProvider";

export class WanProvider extends NotImplementedRenderProvider {
  readonly name = "WAN";
}
