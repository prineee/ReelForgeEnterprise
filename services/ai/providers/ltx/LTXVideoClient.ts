/**
 * LTXVideoClient.ts
 *
 * Concrete VeoClient implementation backed by LTX's official hosted REST
 * API (https://docs.ltx.video). Adapts LTX's async job shape
 * (submit → poll job id → read video_url once completed) to the
 * VeoClient contract defined in VeoService.ts, so VeoService can drive an
 * LTX generation exactly as it would a Veo one.
 *
 * Contains the only knowledge in the codebase of LTX's actual endpoint
 * paths, auth header, and job payload shape — everything else talks to
 * VeoClient.
 */

import type {
  VeoClient,
  VeoRequest,
  VeoResponse,
  VeoGenerationStatus,
  GeneratedVideo,
} from "@/services/ai/providers/google/VeoService";

const LTX_API_BASE_URL = process.env.LTX_API_BASE_URL ?? "https://api.ltx.video/v2";
const LTX_MODEL = process.env.LTX_MODEL ?? "ltx-2-fast";

const DEFAULT_DURATION_SECONDS = 8;
const DEFAULT_RESOLUTION = "1080p";

/** Shape of a job resource as returned by both the submit and status/poll endpoints. */
interface LTXJobResponse {
  task_id?: string;
  id?: string;
  status?: string;
  video_url?: string;
  duration?: number;
  resolution?: string;
  error?: string | { message?: string };
}

/**
 * Thrown when the LTX API returns an error response or an unexpected
 * payload shape.
 */
export class LTXVideoClientError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = "LTXVideoClientError";
  }
}

/**
 * Adapts LTX's hosted REST API to the VeoClient interface.
 */
export class LTXVideoClient implements VeoClient {
  private readonly apiKey: string;

  constructor(apiKey?: string) {
    const resolvedKey = apiKey ?? process.env.LTX_API_KEY;
    if (!resolvedKey || resolvedKey.trim().length === 0) {
      throw new LTXVideoClientError(
        "LTX_API_KEY is not configured (checked constructor argument and process.env.LTX_API_KEY)."
      );
    }
    this.apiKey = resolvedKey;
  }

  async generate(request: VeoRequest): Promise<VeoResponse> {
    const body = {
      model: LTX_MODEL,
      prompt: request.prompt,
      negative_prompt: request.negativePrompt,
      aspect_ratio: request.aspectRatio,
      duration: request.durationSeconds ?? DEFAULT_DURATION_SECONDS,
      resolution: request.quality ?? DEFAULT_RESOLUTION,
    };

    const job = await this.call<LTXJobResponse>("/text-to-video", {
      method: "POST",
      body: JSON.stringify(body),
    });

    return this.toVeoResponse(job);
  }

  async checkStatus(operationId: string): Promise<VeoResponse> {
    const job = await this.call<LTXJobResponse>(`/text-to-video/${encodeURIComponent(operationId)}`, {
      method: "GET",
    });

    return this.toVeoResponse(job);
  }

  async download(operationId: string): Promise<GeneratedVideo> {
    const job = await this.call<LTXJobResponse>(`/text-to-video/${encodeURIComponent(operationId)}`, {
      method: "GET",
    });

    if (this.mapStatus(job.status) !== "COMPLETED" || !job.video_url) {
      throw new LTXVideoClientError(
        `LTX job "${operationId}" is not ready for download (status: ${job.status ?? "unknown"}).`
      );
    }

    return {
      url: job.video_url,
      durationSeconds: job.duration,
      resolution: job.resolution,
    };
  }

  // ── Translation ──────────────────────────────────────────────────────

  private toVeoResponse(job: LTXJobResponse): VeoResponse {
    const operationId = job.task_id ?? job.id;
    if (!operationId) {
      throw new LTXVideoClientError("LTX response did not include a task_id.");
    }

    return {
      operationId,
      status: this.mapStatus(job.status),
    };
  }

  private mapStatus(status: string | undefined): VeoGenerationStatus {
    switch ((status ?? "").toLowerCase()) {
      case "queued":
      case "pending":
        return "PENDING";
      case "processing":
      case "running":
      case "in_progress":
        return "PROCESSING";
      case "completed":
      case "succeeded":
        return "COMPLETED";
      case "failed":
      case "error":
        return "FAILED";
      default:
        throw new LTXVideoClientError(`LTX response contained an unrecognized status: "${status}".`);
    }
  }

  // ── Transport ────────────────────────────────────────────────────────

  private async call<T>(path: string, init: { method: string; body?: string }): Promise<T> {
    let response: Response;
    try {
      response = await fetch(`${LTX_API_BASE_URL}${path}`, {
        method: init.method,
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: init.body,
      });
    } catch (error) {
      throw new LTXVideoClientError(`LTX request to "${path}" failed to send.`, error);
    }

    const payload = await response.json().catch(() => undefined);

    if (!response.ok) {
      const error = (payload as LTXJobResponse | undefined)?.error;
      const message = (typeof error === "string" ? error : error?.message) ?? response.statusText;
      throw new LTXVideoClientError(`LTX request to "${path}" failed (${response.status}): ${message}`);
    }

    return payload as T;
  }
}
