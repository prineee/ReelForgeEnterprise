import type {
  GeneratedVideo,
  VeoOptions,
  VeoResponse,
  VeoService,
} from "@/services/ai/providers/google/VeoService";

import { IVideoProvider } from "@/services/ai/video/IVideoProvider";

/**
 * Google provider adapter.
 *
 * Wraps the existing VeoService without changing
 * any Google implementation.
 */
export class GoogleVideoProvider implements IVideoProvider {
  constructor(
    private readonly veoService: VeoService
  ) {}

  async generate(
    prompt: string,
    options?: VeoOptions
  ): Promise<GeneratedVideo> {
    return this.veoService.generateVideo(
      prompt,
      options
    );
  }

  async check(
    operationId: string
  ): Promise<VeoResponse> {
    return this.veoService.checkGeneration(
      operationId
    );
  }

  async download(
    operationId: string
  ): Promise<GeneratedVideo> {
    return this.veoService.downloadVideo(
      operationId
    );
  }
}