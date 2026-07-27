/**
 * CogVideoProvider.ts
 *
 * Placeholder for a future CogVideo model integration. Registered in
 * ProviderRegistry under "COGVIDEO" today purely so the provider roster
 * is complete ahead of the real implementation — see
 * docs/architecture/render-orchestrator.md. Every method throws until a
 * real implementation replaces this class; nothing currently selects
 * "COGVIDEO" (see ProviderSelector.ts).
 */

import { NotImplementedRenderProvider } from "../NotImplementedRenderProvider";

export class CogVideoProvider extends NotImplementedRenderProvider {
  readonly name = "COGVIDEO";
}
