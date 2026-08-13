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
 * A single image or video asset passed by reference (a fetchable URL) or
 * by value (base64-encoded bytes) — never both. Provider-neutral: a
 * provider adapter is responsible for translating this into whatever
 * shape its own SDK needs (e.g. Google's `Image`/`Video` types, which
 * take gcsUri/imageBytes or uri/videoBytes — a close enough match that
 * the translation is mechanical, not lossy).
 */
export interface RenderAssetInput {
  url?: string;
  /** Base64-encoded bytes. Mutually exclusive with `url` — a caller supplies one or the other. */
  base64?: string;
  mimeType?: string;
}

/**
 * Provider-agnostic render request. Deliberately the same shape as
 * VeoRequest (services/ai/providers/google/VeoService.ts) — every
 * provider implemented so far adapts to/from exactly this — but declared
 * independently so this contract never depends on that provider-specific
 * module.
 *
 * VGE-02 additions (image/lastFrame/extendVideo/requiresAudio) are all
 * optional so LTX — which supports none of them — needs no changes and
 * simply never reads these fields. A ShotRequirement (services/rendering/
 * ShotRequirement.ts) is the AI Director's decision; a provider adapter
 * (e.g. GoogleVeoProvider) translates that decision into these fields —
 * this type itself makes no decisions, it only carries them.
 */
export interface RenderRequest {
  prompt: string;
  negativePrompt?: string;
  aspectRatio?: string;
  durationSeconds?: number;
  quality?: string;
  /** Starting frame for image-to-video, when the provider supports it. */
  image?: RenderAssetInput;
  /** Final frame for first/last-frame interpolation — only meaningful alongside `image`, when the provider supports it. */
  lastFrame?: RenderAssetInput;
  /** Persistent reference assets (character/product identity, or overall visual style) distinct from a single starting frame — providers that support this (Veo) use it for continuity across shots rather than animating from the image itself. */
  referenceImages?: { asset: RenderAssetInput; type: "ASSET" | "STYLE" }[];
  /** A previously-generated video to extend, when the provider supports it. Mutually exclusive with `image` on providers that model it that way (Veo does). */
  extendVideo?: RenderAssetInput;
  /** Whether the caller wants synchronized audio generated, when the provider supports it. Providers without native audio ignore this rather than erroring. */
  requiresAudio?: boolean;
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
