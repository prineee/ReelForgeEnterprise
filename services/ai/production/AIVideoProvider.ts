/**
 * AIVideoProvider.ts
 *
 * Abstraction over any future video generation backend. Defines the
 * contract a video generation provider must implement — starting a
 * generation job, polling its progress, downloading the finished result,
 * and cancelling it — without naming or depending on any specific vendor.
 *
 * This file is interfaces only. It contains no implementation, no vendor
 * SDK code, and no network logic; a concrete provider (Veo, or any other
 * backend) implements VideoGenerationProvider elsewhere and is injected
 * into whatever orchestrates video generation.
 */

/**
 * A single character reference image to anchor visual consistency during
 * generation.
 */
export interface VideoReferenceImage {
  characterId: string;
  url: string;
}

/**
 * Everything a video generation provider needs to start rendering one
 * scene.
 */
export interface VideoGenerationRequest {
  sceneId: string;
  prompt: string;
  negativePrompt: string;
  referenceImages: VideoReferenceImage[];
  duration: number;
  aspectRatio: string;
  quality: string;
  outputFormat: string;
}

/**
 * Lifecycle status of a video generation job, as reported by the provider.
 */
export type VideoGenerationStatus = "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED" | "CANCELLED";

/**
 * A point-in-time progress snapshot for a running video generation job.
 */
export interface VideoGenerationProgress {
  operationId: string;
  status: VideoGenerationStatus;
  progressPercent: number;
  estimatedRemainingSeconds?: number;
}

/**
 * The finished output of a completed video generation job.
 */
export interface VideoGenerationResult {
  sceneId: string;
  operationId: string;
  videoUrl: string;
  thumbnailUrl: string;
  duration: number;
  resolution: string;
  completedAt: string;
}

/**
 * Contract for any video generation backend. Implementations own their own
 * vendor SDK, authentication, and network transport — none of which this
 * interface knows about.
 */
export interface VideoGenerationProvider {
  /**
   * Starts an asynchronous video generation job for one scene and returns
   * its operationId.
   */
  startGeneration(request: VideoGenerationRequest): Promise<string>;

  /**
   * Returns the current progress of a previously started generation job.
   */
  checkProgress(operationId: string): Promise<VideoGenerationProgress>;

  /**
   * Downloads the finished result of a completed generation job.
   */
  downloadResult(operationId: string): Promise<VideoGenerationResult>;

  /**
   * Cancels a running generation job.
   */
  cancelGeneration(operationId: string): Promise<void>;
}
