/**
 * LocalModelBackend.ts
 *
 * The pluggable local video-generation model contract. GPUWorker is
 * constructed with exactly one of these and never hardcodes a specific
 * model. Every future local model — Wan 2.2, Hunyuan Video, CogVideoX,
 * LTX Local, or any future open-source model — implements this same
 * interface and can replace today's implementation
 * (SyntheticTestPatternBackend.ts) without any change to GPUWorker,
 * LocalGPURenderAPI, or LocalGPUProvider.
 */

import type { RenderRequest } from "@/services/rendering/interfaces/RenderProvider";

export interface LocalRenderOutput {
  /** Absolute filesystem path to the produced video file. */
  filePath: string;
  /** Publicly servable URL for the same file (see SyntheticTestPatternBackend.ts for how this is made servable without any new API route). */
  publicUrl: string;
  /** The video's real, measured duration — not just an echo of the request. */
  durationSeconds: number;
  /** The video's real, measured resolution ("WxH") — not just an echo of the request. */
  resolution: string;
  thumbnailUrl?: string;
}

export interface LocalModelBackend {
  /** Identifies which model produced (or will produce) a render — surfaced in RenderResult.metadata, never as a top-level field (see interfaces/RenderResult.ts). */
  readonly modelName: string;

  /** `signal` is honored for real cancellation — see GPUWorker.cancel() and SyntheticTestPatternBackend's ffmpeg process handling. */
  generate(request: RenderRequest, signal: AbortSignal): Promise<LocalRenderOutput>;
}
