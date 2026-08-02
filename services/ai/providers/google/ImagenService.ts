/**
 * ImagenService.ts
 *
 * Translation layer between generic image generation calls and Imagen's
 * request/response shape. Contains no SDK imports, no API keys, no
 * environment variable access, and no network implementation — the actual
 * Imagen client is injected via the ImagenClient interface, which the real
 * caller of this class is responsible for constructing (with whatever
 * SDK, credentials, model selection, and transport it needs). ImagenService
 * itself only translates requests/responses and validates them; it has no
 * knowledge of Movie, Character, or any other domain concept, and does no
 * image editing of its own.
 */

/**
 * Request shape expected by the injected Imagen client's generate()
 * method. Deliberately carries no model name — model selection is the
 * injected client's responsibility, not this service's.
 */
export interface ImagenRequest {
  prompt: string;
  numberOfImages?: number;
  aspectRatio?: string;
  quality?: string;
}

/**
 * A single generated image, in a shape generic enough to represent the
 * output of any image generation backend.
 */
export interface GeneratedImage {
  url: string;
  width?: number;
  height?: number;
  mimeType?: string;
}

/**
 * Usage accounting for a single generate() call.
 */
export interface ImagenUsage {
  imagesGenerated: number;
  promptTokens?: number;
}

/**
 * Response shape returned by the injected Imagen client's generate()
 * method.
 */
export interface ImagenResponse {
  images: GeneratedImage[];
  usage: ImagenUsage;
}

/**
 * Caller-supplied generation tuning options.
 */
export interface ImagenOptions {
  aspectRatio?: string;
  quality?: string;
  numberOfImages?: number;
}

/**
 * Minimal contract ImagenService needs from an Imagen client
 * implementation. Deliberately independent of any actual SDK type — a
 * real implementation adapts the genuine Imagen SDK to this shape
 * elsewhere.
 */
export interface ImagenClient {
  generate(request: ImagenRequest): Promise<ImagenResponse>;
}

/**
 * Thrown when an Imagen response fails validation.
 */
export class ImagenServiceError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = "ImagenServiceError";
  }
}

/**
 * Translates generic image generation requests into ImagenRequest calls
 * and ImagenResponse results back into validated GeneratedImage objects.
 * Pure translation — no prompt engineering, no orchestration, no image
 * editing, no business logic beyond request/response shaping and
 * validation.
 */
export class ImagenService {
  constructor(private readonly client: ImagenClient) {}

  /**
   * Generates a single image from a prompt and returns the validated
   * result.
   */
  async generateImage(prompt: string, options?: ImagenOptions): Promise<GeneratedImage> {
    const request = this.toImagenRequest(prompt, options);
    const response = await this.client.generate(request);
    this.validateResponse(response, 1);
    return response.images[0];
  }

  /**
   * Generates one image per prompt (each prompt describes a distinct
   * subject, e.g. one per character — this is not "N variations of one
   * prompt," which numberOfImages already covers per call).
   */
  async generateReferenceImages(prompts: string[], options?: ImagenOptions): Promise<GeneratedImage[]> {
    if (prompts.length === 0) {
      throw new ImagenServiceError("No prompts provided.");
    }
    return Promise.all(prompts.map((prompt) => this.generateImage(prompt, options)));
  }

  // ── Translation ──────────────────────────────────────────────────────

  private toImagenRequest(prompt: string, options: ImagenOptions | undefined): ImagenRequest {
    return {
      prompt,
      numberOfImages: options?.numberOfImages ?? 1,
      aspectRatio: options?.aspectRatio,
      quality: options?.quality,
    };
  }

  // ── Validation ───────────────────────────────────────────────────────

  private validateResponse(response: ImagenResponse, expectedMinimum: number): void {
    if (!Array.isArray(response.images) || response.images.length < expectedMinimum) {
      throw new ImagenServiceError(
        `Imagen response contained ${response.images?.length ?? 0} image(s), expected at least ${expectedMinimum}.`
      );
    }
    for (const image of response.images) {
      if (!image.url || image.url.trim().length === 0) {
        throw new ImagenServiceError("Imagen response contained an image with no URL.");
      }
    }
    if (!response.usage) {
      throw new ImagenServiceError("Imagen response did not include usage information.");
    }
  }
}
