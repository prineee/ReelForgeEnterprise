/**
 * Universal Video Provider
 *
 * This interface is implemented by every video generation provider
 * (Google Veo, LTX, Hunyuan, Kling, Runway, etc.)
 *
 * MovieProductionService never talks directly to Google or LTX.
 * It only talks to this interface.
 */

export type VideoJobStatus =
  | "QUEUED"
  | "PENDING"
  | "PROCESSING"
  | "COMPLETED"
  | "FAILED"
  | "CANCELLED";

export interface VideoGenerationRequest {
  prompt: string;
  negativePrompt?: string;
  aspectRatio?: string;
  durationSeconds?: number;
  quality?: string;
}

export interface VideoGenerationOperation {
  operationId: string;
  status: VideoJobStatus;
}

export interface GeneratedVideo {
  url: string;
  thumbnailUrl?: string;
  durationSeconds?: number;
  resolution?: string;
}

export interface VideoProvider {
  /**
   * Submit a new generation job.
   */
  generate(
    request: VideoGenerationRequest
  ): Promise<VideoGenerationOperation>;

  /**
   * Check current job status.
   */
  check(
    operationId: string
  ): Promise<VideoGenerationOperation>;

  /**
   * Download completed video.
   */
  download(
    operationId: string
  ): Promise<GeneratedVideo>;
}