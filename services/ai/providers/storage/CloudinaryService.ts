/**
 * CloudinaryService.ts
 *
 * Translation layer between generic asset storage calls and a storage
 * backend's request/response shape. Contains no SDK imports, no API keys,
 * no environment variable access, and no network implementation — the
 * actual storage client is injected via the StorageClient interface,
 * which the real caller of this class is responsible for constructing
 * (with whatever SDK, credentials, and transport it needs, Cloudinary or
 * otherwise). CloudinaryService itself only translates requests/responses
 * and validates them; it has no knowledge of Movie, Character, or any AI
 * generation/orchestration concept.
 */

/**
 * Request shape expected by the injected storage client's upload()
 * method. UploadRequest and StorageOptions intentionally overlap (as with
 * the other provider services in this layer): UploadRequest is the
 * complete request sent to the client, StorageOptions is the
 * caller-tunable subset that can override fields on it.
 */
export interface UploadRequest {
  sourceUrl: string;
  fileName?: string;
  folder?: string;
  resourceType?: "image" | "video" | "raw";
  overwrite?: boolean;
}

/**
 * Metadata describing a single stored asset.
 */
export interface AssetMetadata {
  assetId: string;
  url: string;
  format?: string;
  width?: number;
  height?: number;
  durationSeconds?: number;
  bytes?: number;
  createdAt?: string;
}

/**
 * Storage quota accounting, optionally reported alongside an upload.
 */
export interface StorageUsage {
  bytesUsed: number;
  totalBytesAvailable?: number;
}

/**
 * Response shape returned by the injected storage client's upload()
 * method.
 */
export interface UploadResult {
  assetId: string;
  url: string;
  secureUrl?: string;
  usage?: StorageUsage;
}

/**
 * Caller-supplied upload tuning options.
 */
export interface StorageOptions {
  fileName?: string;
  folder?: string;
  resourceType?: "image" | "video" | "raw";
  overwrite?: boolean;
}

/**
 * Minimal contract CloudinaryService needs from a storage client
 * implementation. Deliberately independent of any actual SDK type — a
 * real implementation adapts the genuine storage SDK (Cloudinary or
 * otherwise) to this shape elsewhere.
 */
export interface StorageClient {
  upload(request: UploadRequest): Promise<UploadResult>;
  delete(assetId: string): Promise<void>;
  getMetadata(assetId: string): Promise<AssetMetadata>;
}

/**
 * Thrown when a storage response fails validation.
 */
export class CloudinaryServiceError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = "CloudinaryServiceError";
  }
}

/**
 * Translates generic asset storage requests into StorageClient calls and
 * results back into validated generic objects. Pure translation — no
 * business logic, no Movie/Character knowledge, no AI orchestration.
 */
export class CloudinaryService {
  constructor(private readonly client: StorageClient) {}

  /**
   * Uploads an asset and returns the validated result.
   */
  async uploadAsset(request: UploadRequest, options?: StorageOptions): Promise<UploadResult> {
    if (!request.sourceUrl || request.sourceUrl.trim().length === 0) {
      throw new CloudinaryServiceError("UploadRequest.sourceUrl must be a non-empty string.");
    }

    const storageRequest = this.toStorageRequest(request, options);
    const result = await this.client.upload(storageRequest);
    this.validateUploadResult(result);
    return result;
  }

  /**
   * Deletes an asset.
   */
  async deleteAsset(assetId: string): Promise<void> {
    this.validateAssetId(assetId);
    await this.client.delete(assetId);
  }

  /**
   * Retrieves and validates metadata for an asset.
   */
  async getAssetMetadata(assetId: string): Promise<AssetMetadata> {
    this.validateAssetId(assetId);
    const metadata = await this.client.getMetadata(assetId);
    this.validateMetadata(metadata);
    return metadata;
  }

  // ── Translation ──────────────────────────────────────────────────────

  private toStorageRequest(request: UploadRequest, options?: StorageOptions): UploadRequest {
    return {
      sourceUrl: request.sourceUrl,
      fileName: options?.fileName ?? request.fileName,
      folder: options?.folder ?? request.folder,
      resourceType: options?.resourceType ?? request.resourceType,
      overwrite: options?.overwrite ?? request.overwrite,
    };
  }

  // ── Validation ───────────────────────────────────────────────────────

  private validateAssetId(assetId: string): void {
    if (!assetId || assetId.trim().length === 0) {
      throw new CloudinaryServiceError("assetId must be a non-empty string.");
    }
  }

  private validateUploadResult(result: UploadResult): void {
    if (!result.assetId || result.assetId.trim().length === 0) {
      throw new CloudinaryServiceError("Storage upload response did not include an assetId.");
    }
    if (!result.url || result.url.trim().length === 0) {
      throw new CloudinaryServiceError(
        `Storage upload response for asset "${result.assetId}" did not include a URL.`
      );
    }
  }

  private validateMetadata(metadata: AssetMetadata): void {
    if (!metadata.assetId || metadata.assetId.trim().length === 0) {
      throw new CloudinaryServiceError("Storage metadata response did not include an assetId.");
    }
    if (!metadata.url || metadata.url.trim().length === 0) {
      throw new CloudinaryServiceError(
        `Storage metadata response for asset "${metadata.assetId}" did not include a URL.`
      );
    }
  }
}
