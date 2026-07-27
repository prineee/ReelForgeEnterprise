/**
 * BaseVeoClientProvider.ts
 *
 * Shared translation layer for any cloud RenderProvider whose real
 * implementation already speaks the existing VeoClient contract
 * (services/ai/providers/google/VeoService.ts): submit a prompt, get an
 * operationId back, poll it, download once complete. Both
 * LTXCloudProvider and GoogleVeoProvider delegate here instead of each
 * duplicating the RenderRequest -> VeoRequest and VeoResponse/
 * GeneratedVideo -> RenderResult mapping.
 *
 * This class contains no provider-specific knowledge (no endpoints, no
 * auth, no SDK calls) — that all stays inside the injected VeoClient,
 * exactly as it does today for LTXVideoClient and GoogleGenAIVeoClient.
 * "No provider-specific return values should leak outside" (see
 * RenderResult.ts) is enforced right here, once, for every VeoClient-
 * backed provider.
 */

import type { RenderProvider, RenderRequest } from "../../interfaces/RenderProvider";
import type { RenderResult } from "../../interfaces/RenderResult";
import type {
  VeoClient,
  VeoResponse,
  GeneratedVideo,
} from "@/services/ai/providers/google/VeoService";

export abstract class BaseVeoClientProvider implements RenderProvider {
  abstract readonly name: string;

  constructor(protected readonly client: VeoClient) {}

  async generate(request: RenderRequest): Promise<RenderResult> {
    const response = await this.client.generate({
      prompt: request.prompt,
      negativePrompt: request.negativePrompt,
      aspectRatio: request.aspectRatio,
      durationSeconds: request.durationSeconds,
      quality: request.quality,
    });

    return this.toRenderResult(response);
  }

  async checkStatus(jobId: string): Promise<RenderResult> {
    const response = await this.client.checkStatus(jobId);
    return this.toRenderResult(response);
  }

  async download(jobId: string): Promise<RenderResult> {
    const video = await this.client.download(jobId);
    return this.toRenderResult({ operationId: jobId, status: "COMPLETED" }, video);
  }

  private toRenderResult(response: VeoResponse, video?: GeneratedVideo): RenderResult {
    return {
      jobId: response.operationId,
      status: response.status,
      provider: this.name,
      videoUrl: video?.url,
      thumbnail: video?.thumbnailUrl,
      duration: video?.durationSeconds,
      resolution: video?.resolution,
      metadata: {},
    };
  }
}
