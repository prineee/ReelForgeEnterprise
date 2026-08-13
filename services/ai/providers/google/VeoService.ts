/**
 * VeoService.ts
 *
 * Translation layer between generic video generation calls and Veo's
 * request/response shape. Contains no SDK imports, no API keys, no
 * environment variable access, and no network implementation — the actual
 * Veo client is injected via the VeoClient interface, which the real
 * caller of this class is responsible for constructing.
 *
 * VeoService is a thin provider service only: it translates and validates
 * a single request/response at a time. It does not poll, retry, wait, or
 * orchestrate — video generation is inherently asynchronous, and driving
 * it to completion (submit → poll → download) is exclusively the
 * responsibility of VeoGenerator and RenderQueue elsewhere in this
 * codebase. Concretely:
 *
 *   - generateVideo() calls generate(), validates the response, and
 *     returns the finished video immediately ONLY if the response is
 *     already COMPLETED. Otherwise it throws VeoServiceError telling the
 *     caller to poll with checkGeneration() and finish with
 *     downloadVideo() themselves.
 *   - checkGeneration() and downloadVideo() are single translate-and-
 *     validate calls with no looping of their own.
 */

/**
 * A single image or video asset passed by reference (a fetchable URL) or
 * by value (base64-encoded bytes). Mirrors
 * services/rendering/interfaces/RenderProvider.ts's RenderAssetInput —
 * declared independently here for the same reason the rest of this file
 * is independent of that module (see the file header).
 */
export interface VeoAssetInput {
  url?: string;
  base64?: string;
  mimeType?: string;
}

/**
 * Request shape expected by the injected Veo client's generate() method.
 * Deliberately carries no model name — model selection is the injected
 * client's responsibility, not this service's.
 *
 * VGE-02 additions (image/lastFrame/extendVideo/requiresAudio): whether a
 * given VeoClient implementation actually sends these to its underlying
 * API is that implementation's decision — VeoService itself only
 * transports them. A client that doesn't support one (e.g. LTXVideoClient
 * has no image-to-video today) simply ignores the field.
 */
export interface VeoRequest {
  prompt: string;
  negativePrompt?: string;
  aspectRatio?: string;
  durationSeconds?: number;
  quality?: string;
  image?: VeoAssetInput;
  lastFrame?: VeoAssetInput;
  referenceImages?: { asset: VeoAssetInput; type: "ASSET" | "STYLE" }[];
  extendVideo?: VeoAssetInput;
  requiresAudio?: boolean;
}

/**
 * A single generated video, in a shape generic enough to represent the
 * output of any video generation backend.
 */
export interface GeneratedVideo {
  url: string;
  thumbnailUrl?: string;
  durationSeconds?: number;
  resolution?: string;
}

/**
 * Usage accounting for a video generation operation.
 */
export interface VeoUsage {
  videosGenerated: number;
  computeSeconds?: number;
}

/**
 * Lifecycle status of a video generation operation, as reported by the
 * Veo client.
 */
export type VeoGenerationStatus = "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED";

/**
 * Operation status shape returned by the injected Veo client's generate()
 * and checkStatus() methods. Represents an in-progress or finished
 * operation's status — not the video itself, which download() returns
 * separately.
 */
export interface VeoResponse {
  operationId: string;
  status: VeoGenerationStatus;
  usage?: VeoUsage;
  /** Present when status is FAILED and the client has a real error message to report — see GoogleGenAIVeoClient.checkStatus() (VGE-02). Previously a FAILED status carried no explanation anywhere in this chain. */
  error?: string;
}

/**
 * Caller-supplied generation tuning options.
 */
export interface VeoOptions {
  negativePrompt?: string;
  aspectRatio?: string;
  durationSeconds?: number;
  quality?: string;
}

/**
 * Minimal contract VeoService needs from a Veo client implementation.
 * Deliberately independent of any actual SDK type — a real implementation
 * adapts the genuine Veo SDK to this shape elsewhere.
 */
export interface VeoClient {

  generate(
    request: VeoRequest
  ): Promise<VeoResponse>;

  checkStatus(
    operationId: string
  ): Promise<VeoResponse>;

  download(
    operationId: string
  ): Promise<GeneratedVideo>;

  /**
   * Provider Name
   * Example:
   * GOOGLE
   * LTX
   * HUNYUAN
   */
 }
/**
 * Thrown when a Veo response fails validation, or when generateVideo() is
 * called for a generation that did not complete synchronously.
 */
export class VeoServiceError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = "VeoServiceError";
  }
}

/**
 * Translates generic video generation requests into VeoRequest calls and
 * VeoResponse/video results back into validated generic objects. Pure
 * translation — no polling, no retrying, no waiting, no orchestration.
 */
export class VeoService {
  constructor(
    private readonly client: VeoClient
) {}


  /**
   * Calls generate() and validates the response. If the operation is
   * already COMPLETED, immediately downloads and returns the video.
   * Otherwise throws VeoServiceError — this method never polls; an
   * asynchronous generation must be driven to completion by the caller via
   * checkGeneration() and downloadVideo().
   */
  async generateVideo(prompt: string, options?: VeoOptions): Promise<GeneratedVideo> {
    const request = this.toVeoRequest(prompt, options);
    const response = await this.client.generate(request);
    this.validateResponse(response);

    if (response.status === "COMPLETED") {
      return this.downloadAndValidate(response
        .operationId);
    }

    throw new VeoServiceError(
      `Video generation for operation "${response.operationId}" is asynchronous (status: ${response.status}). ` +
        "Use checkGeneration() to poll and downloadVideo() once it completes."
    );
  }

  /**
   * Calls checkStatus() for a previously started operation and returns the
   * validated response. Does not poll or wait — a single point-in-time
   * check.
   */
  async checkGeneration(operationId: string): Promise<VeoResponse> {
    const response = await this.client.checkStatus(operationId);
    this.validateResponse(response);
    return response;
  }

  /**
   * Calls download() for a completed operation and returns the validated
   * video.
   */
  async downloadVideo(operationId: string): Promise<GeneratedVideo> {
    return this.downloadAndValidate(operationId);
  }

  // ── Translation ──────────────────────────────────────────────────────

  private toVeoRequest(prompt: string, options: VeoOptions | undefined): VeoRequest {
    return {
      prompt,
      negativePrompt: options?.negativePrompt,
      aspectRatio: options?.aspectRatio,
      durationSeconds: options?.durationSeconds,
      quality: options?.quality,
    };
  }

  private async downloadAndValidate(operationId: string): Promise<GeneratedVideo> {
    const video = await this.client.download(operationId);
    this.validateVideo(video, operationId);
    return video;
  }

  // ── Validation ───────────────────────────────────────────────────────

  private validateResponse(response: VeoResponse): void {
    if (!response.operationId || response.operationId.trim().length === 0) {
      throw new VeoServiceError("Veo response did not include an operationId.");
    }
    if (!response.status) {
      throw new VeoServiceError(
        `Veo response for operation "${response.operationId}" did not include a status.`
      );
    }
  }

  private validateVideo(video: GeneratedVideo, operationId: string): void {
    if (!video.url || video.url.trim().length === 0) {
      throw new VeoServiceError(`Veo download for operation "${operationId}" did not include a video URL.`);
    }
  }
}
