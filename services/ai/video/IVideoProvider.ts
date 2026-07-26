import type {
  GeneratedVideo,
  VeoOptions,
  VeoResponse,
} from "@/services/ai/providers/google/VeoService";

/**
 * Universal interface implemented by every video provider.
 *
 * Google
 * LTX
 * Kling
 * Hunyuan
 * Runway
 * Pika
 * CogVideo
 */
export interface IVideoProvider {
  /**
   * Submit a new generation request.
   */
  generate(
    prompt: string,
    options?: VeoOptions
  ): Promise<GeneratedVideo>;

  /**
   * Check generation status.
   */
  check(
    operationId: string
  ): Promise<VeoResponse>;

  /**
   * Download finished video.
   */
  download(
    operationId: string
  ): Promise<GeneratedVideo>;
}