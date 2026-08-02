/**
 * RenderProvider.ts
 *
 * The common interface every render backend implements — today's real
 * cloud APIs (LTX, Google Veo), tomorrow's self-hosted GPU backends
 * (local GPU, GPU cluster), and any future model provider (Wan, Hunyuan,
 * CogVideo, ...). ProviderRegistry stores instances of this interface;
 * ProviderSelector picks a ProviderId; RenderOrchestrator is the only
 * caller that invokes these methods directly. Nothing above
 * RenderOrchestrator (MovieProductionService, Movie Studio, Cartoon
 * Studio, Cinema Studio, Marketing Studio) ever sees a RenderProvider or
 * a ProviderId — see docs/architecture/render-orchestrator.md.
 */

import type { RenderResult } from "./RenderResult";

/**
 * Every id ProviderRegistry can register a provider under. LTX and GOOGLE
 * are real today; every other value is a documented placeholder (see
 * services/rendering/providers/gpu/ and services/rendering/providers/future/)
 * registered so the architecture is in place before the backend is.
 */
export type ProviderId =
  | "LTX"
  | "GOOGLE"
  | "LOCAL_GPU"
  | "GPU_CLUSTER"
  | "WAN"
  | "HUNYUAN"
  | "COGVIDEO";

/**
 * Provider-agnostic render request. Deliberately the same shape as
 * VeoRequest (services/ai/providers/google/VeoService.ts) — every
 * provider implemented so far adapts to/from exactly this — but declared
 * independently so this contract never depends on that provider-specific
 * module.
 */
export interface RenderRequest {
  prompt: string;
  negativePrompt?: string;
  aspectRatio?: string;
  durationSeconds?: number;
  quality?: string;
}

/**
 * Minimal contract a render backend must implement to be registered in
 * ProviderRegistry. generate() submits a new job; checkStatus() and
 * download() both take the jobId a prior generate()/checkStatus() call
 * returned. All three return the same RenderResult shape — no
 * provider-specific type ever crosses this boundary.
 */
export interface RenderProvider {
  /** Stable identifier for logs/metrics — matches the ProviderId this instance is registered under. */
  readonly name: string;

  generate(request: RenderRequest): Promise<RenderResult>;

  checkStatus(jobId: string): Promise<RenderResult>;

  download(jobId: string): Promise<RenderResult>;
}
