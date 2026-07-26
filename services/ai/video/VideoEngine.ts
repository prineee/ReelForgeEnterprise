import type {
  GeneratedVideo,
  VeoOptions,
  VeoResponse,
} from "@/services/ai/providers/google/VeoService";

import { IVideoProvider } from "./IVideoProvider";

/**
 * Universal Video Engine.
 *
 * MovieProductionService never talks
 * directly to Google, LTX or any provider.
 *
 * It only communicates with VideoEngine.
 */
export class VideoEngine {
  constructor(
    private readonly provider: IVideoProvider
  ) {}

  /**
   * Submit generation.
   */
  async generate(
    prompt: string,
    options?: VeoOptions
  ): Promise<GeneratedVideo> {
    return this.provider.generate(prompt, options);
  }

  /**
   * Check generation.
   */
  async check(
    operationId: string
  ): Promise<VeoResponse> {
    return this.provider.check(operationId);
  }

  /**
   * Download generated video.
   */
  async download(
    operationId: string
  ): Promise<GeneratedVideo> {
    return this.provider.download(operationId);
  }
}