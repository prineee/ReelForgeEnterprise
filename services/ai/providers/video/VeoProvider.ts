/**
 * VeoProvider.ts
 *
 * Implements VideoGenerationProvider by translating between the
 * vendor-neutral video generation contract and Google's Veo API shape.
 * This is the ONLY file in the codebase allowed to know that Veo exists —
 * every other module talks to VideoGenerationProvider and has no idea
 * which backend is behind it.
 *
 * This file contains no SDK imports, no API keys, no environment variable
 * access, and no network implementation: the actual Google client is
 * injected via the GoogleVideoClient interface, which the real caller of
 * this class is responsible for constructing (with whatever SDK,
 * credentials, and transport it needs). VeoProvider itself only translates
 * requests and responses between the two shapes.
 */

import type {
  VideoGenerationRequest,
  VideoGenerationProgress,
  VideoGenerationResult,
  VideoGenerationProvider,
} from "../../production/AIVideoProvider";

/**
 * The Veo model identifier this provider targets. Known only here — no
 * other file in the codebase references it.
 */
const VEO_MODEL = "veo-3.1-generate-preview";

/**
 * Request shape expected by the injected Google video client's generate()
 * method.
 */
export interface GoogleVideoGenerateRequest {
  model: string;
  prompt: string;
  negativePrompt?: string;
  aspectRatio: string;
  durationSeconds: number;
  quality: string;
  outputFormat: string;
  referenceImageUrls: string[];
}

/**
 * Operation status shape returned by the injected Google video client's
 * generate() and check() methods.
 */
export interface GoogleVideoOperation {
  name: string;
  done: boolean;
  error?: { message: string };
}

/**
 * Finished result shape returned by the injected Google video client's
 * download() method.
 */
export interface GoogleVideoDownloadResult {
  videoUri: string;
  thumbnailUri?: string;
  durationSeconds?: number;
  resolution?: string;
}

/**
 * Minimal contract VeoProvider needs from a Google video client
 * implementation. Deliberately independent of any actual SDK type — a real
 * implementation adapts the genuine Google SDK to this shape elsewhere.
 */
export interface GoogleVideoClient {
  generate(request: GoogleVideoGenerateRequest): Promise<GoogleVideoOperation>;
  check(operationName: string): Promise<GoogleVideoOperation>;
  download(operationName: string): Promise<GoogleVideoDownloadResult>;
}

/**
 * Thrown when a request or response cannot be translated between the
 * VideoGenerationProvider contract and the Google client's shape.
 */
export class VeoProviderError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = "VeoProviderError";
  }
}

/**
 * Translates VideoGenerationProvider calls into GoogleVideoClient calls
 * and back. Pure provider implementation — no orchestration, no business
 * logic beyond request/response translation.
 */
export class VeoProvider implements VideoGenerationProvider {
  private readonly requestsByOperationId = new Map<string, VideoGenerationRequest>();

  constructor(private readonly client: GoogleVideoClient) {}

  async startGeneration(request: VideoGenerationRequest): Promise<string> {
    const googleRequest = this.toGoogleRequest(request);
    const operation = await this.client.generate(googleRequest);
    const operationId = this.extractOperationId(operation);

    this.requestsByOperationId.set(operationId, request);
    return operationId;
  }

  async checkProgress(operationId: string): Promise<VideoGenerationProgress> {
    const operation = await this.client.check(operationId);
    return this.toProgress(operation);
  }

  async downloadResult(operationId: string): Promise<VideoGenerationResult> {
    const requestContext = this.requestsByOperationId.get(operationId);
    if (!requestContext) {
      throw new VeoProviderError(
        `Unknown operationId: "${operationId}". startGeneration() must be called before downloadResult().`
      );
    }

    const googleResult = await this.client.download(operationId);
    return this.toResult(operationId, requestContext, googleResult);
  }

  /**
   * GoogleVideoClient exposes no cancel capability (only generate/check/
   * download), so a generation job cannot genuinely be cancelled through
   * it. Throws rather than silently no-op'ing, which would falsely imply
   * the job stopped running.
   */
  async cancelGeneration(operationId: string): Promise<void> {
    throw new VeoProviderError(
      `Cancellation is not supported: GoogleVideoClient does not expose a cancel operation for "${operationId}".`
    );
  }

  // ── VideoGenerationRequest → Google request ─────────────────────────────

  private toGoogleRequest(request: VideoGenerationRequest): GoogleVideoGenerateRequest {
    return {
      model: VEO_MODEL,
      prompt: request.prompt,
      negativePrompt: request.negativePrompt || undefined,
      aspectRatio: request.aspectRatio,
      durationSeconds: request.duration,
      quality: request.quality,
      outputFormat: request.outputFormat,
      referenceImageUrls: request.referenceImages.map((image) => image.url),
    };
  }

  private extractOperationId(operation: GoogleVideoOperation): string {
    if (!operation.name || operation.name.trim().length === 0) {
      throw new VeoProviderError("Google generate() response did not include an operation name.");
    }
    return operation.name;
  }

  // ── Google response → VideoGenerationProgress ───────────────────────────

  private toProgress(operation: GoogleVideoOperation): VideoGenerationProgress {
    if (operation.error) {
      return {
        operationId: operation.name,
        status: "FAILED",
        progressPercent: 0,
      };
    }

    return {
      operationId: operation.name,
      status: operation.done ? "COMPLETED" : "PROCESSING",
      progressPercent: operation.done ? 100 : 0,
    };
  }

  // ── Google download → VideoGenerationResult ─────────────────────────────

  private toResult(
    operationId: string,
    requestContext: VideoGenerationRequest,
    googleResult: GoogleVideoDownloadResult
  ): VideoGenerationResult {
    if (!googleResult.videoUri || googleResult.videoUri.trim().length === 0) {
      throw new VeoProviderError(
        `Google download() response for operation "${operationId}" did not include a video URI.`
      );
    }

    return {
      sceneId: requestContext.sceneId,
      operationId,
      videoUrl: googleResult.videoUri,
      thumbnailUrl: googleResult.thumbnailUri ?? "",
      duration: googleResult.durationSeconds ?? requestContext.duration,
      resolution: googleResult.resolution ?? requestContext.quality,
      completedAt: new Date().toISOString(),
    };
  }
}
