/**
 * LocalGPURenderAPI.ts
 *
 * The local job-lifecycle API GPUWorker sits behind — submit()/status()/
 * download()/cancel(), the same async submit-then-poll shape
 * LTXVideoClient exposes over HTTP, just in-process instead of over the
 * network. Unlike LTXVideoClient/GoogleGenAIVeoClient (which speak the
 * VeoClient contract and get translated to RenderResult by
 * BaseVeoClientProvider), this class already returns RenderResult
 * natively — there is no external wire format to translate from, so no
 * intermediate shape is introduced. LocalGPUProvider (the RenderProvider
 * adapter) forwards generate()/checkStatus()/download() straight to
 * submit()/status()/download() with no logic of its own.
 */

import { GPUWorker, type WorkerJobStatus } from "./GPUWorker";
import type { RenderRequest } from "@/services/rendering/interfaces/RenderProvider";
import type { RenderResult, RenderStatus } from "@/services/rendering/interfaces/RenderResult";

export class LocalGPURenderAPI {
  constructor(private readonly worker: GPUWorker) {}

  async submit(request: RenderRequest): Promise<RenderResult> {
    const jobId = this.worker.submit(request);
    return this.buildResult(jobId);
  }

  async status(jobId: string): Promise<RenderResult> {
    return this.buildResult(jobId);
  }

  async download(jobId: string): Promise<RenderResult> {
    const record = this.worker.getJob(jobId);
    if (!record || record.status !== "COMPLETED" || !record.output) {
      throw new Error(`Local GPU job "${jobId}" is not ready for download (status: ${record?.status ?? "unknown"}).`);
    }
    return this.buildResult(jobId);
  }

  /** Not part of the RenderProvider contract (generate/checkStatus/download only) — a local-only capability, exposed here for completeness with the module's spec. */
  cancel(jobId: string): RenderResult {
    this.worker.cancel(jobId);
    return this.buildResult(jobId);
  }

  private buildResult(jobId: string): RenderResult {
    const record = this.worker.getJob(jobId);
    if (!record) {
      throw new Error(`No local GPU job "${jobId}".`);
    }

    return {
      jobId,
      status: this.mapStatus(record.status),
      provider: "LOCAL_GPU",
      videoUrl: record.output?.publicUrl,
      duration: record.output?.durationSeconds,
      resolution: record.output?.resolution,
      error: record.error ?? (record.status === "CANCELLED" ? "Render was cancelled." : undefined),
      metadata: {
        workerVersion: GPUWorker.VERSION,
      },
    };
  }

  private mapStatus(status: WorkerJobStatus): RenderStatus {
    switch (status) {
      case "PENDING":
        return "PENDING";
      case "PROCESSING":
        return "PROCESSING";
      case "COMPLETED":
        return "COMPLETED";
      case "FAILED":
        return "FAILED";
      case "CANCELLED":
        // RenderResult's status union has no dedicated CANCELLED value
        // (see interfaces/RenderResult.ts) — FAILED with `error` set to
        // "Render was cancelled." (see toRenderResultSync above) is the
        // closest honest mapping, same limitation any provider would have.
        return "FAILED";
    }
  }
}
