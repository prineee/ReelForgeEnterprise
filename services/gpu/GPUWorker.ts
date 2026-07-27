/**
 * GPUWorker.ts
 *
 * The actual local render executor. Receives a RenderRequest, drives a
 * pluggable LocalModelBackend (backends/LocalModelBackend.ts) to produce
 * a video, tracks that job's lifecycle internally, and reports worker
 * status (health/busy/idle/version/GPU info) alongside per-job results.
 *
 * GPUWorker never hardcodes a specific video model — it only knows the
 * LocalModelBackend contract. Today's only real implementation,
 * backends/SyntheticTestPatternBackend.ts, is an honest CPU/ffmpeg
 * reference backend, not a real diffusion model (see that file's header
 * for why). Future backends (Wan 2.2, Hunyuan Video, CogVideoX, LTX
 * Local, ...) implement the exact same LocalModelBackend interface and
 * can be passed into this class's constructor without any change here.
 *
 * LocalGPURenderAPI.ts (the submit/status/download/cancel layer
 * LocalGPUProvider actually talks to) is the only intended caller of
 * this class.
 */

import { randomUUID } from "node:crypto";
import { detectSystemGPU, type DetectedGPU } from "./detectSystemGPU";
import type { LocalModelBackend, LocalRenderOutput } from "./backends/LocalModelBackend";
import type { RenderRequest } from "@/services/rendering/interfaces/RenderProvider";

export type WorkerJobStatus = "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED" | "CANCELLED";

export interface WorkerJobRecord {
  jobId: string;
  status: WorkerJobStatus;
  request: RenderRequest;
  output?: LocalRenderOutput;
  error?: string;
  startedAt: string;
  completedAt?: string;
}

export interface WorkerStatus {
  health: "HEALTHY" | "UNHEALTHY";
  busy: boolean;
  idle: boolean;
  version: string;
  modelName: string;
  gpuInfo: DetectedGPU;
  currentJobIds: string[];
  queueDepth: number;
}

export interface GPUHeartbeat {
  timestamp: string;
  healthy: boolean;
  /** Celsius. Undefined — no real temperature telemetry source is available on this machine (would need vendor-specific tooling, e.g. nvidia-smi/rocm-smi). Never fabricated. */
  temperatureCelsius?: number;
  vramTotalMB?: number;
  /** Percent, 0-100. Undefined for the same reason as temperatureCelsius. */
  utilizationPercent?: number;
  queueDepth: number;
  runningJobs: number;
  workerVersion: string;
}

export class GPUWorkerError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GPUWorkerError";
  }
}

export class GPUWorker {
  static readonly VERSION = "0.1.0-reference";

  private readonly jobs = new Map<string, WorkerJobRecord>();
  private readonly abortControllers = new Map<string, AbortController>();
  private readonly gpuInfo: DetectedGPU;
  private busyCount = 0;

  constructor(private readonly backend: LocalModelBackend) {
    this.gpuInfo = detectSystemGPU();
  }

  /** Accepts a job and starts processing it asynchronously; does not wait for completion. */
  submit(request: RenderRequest): string {
    const jobId = randomUUID();
    const record: WorkerJobRecord = {
      jobId,
      status: "PENDING",
      request,
      startedAt: new Date().toISOString(),
    };
    this.jobs.set(jobId, record);
    void this.runJob(jobId);
    return jobId;
  }

  getJob(jobId: string): WorkerJobRecord | undefined {
    return this.jobs.get(jobId);
  }

  /** Best-effort cancellation: aborts the in-flight backend call via AbortController if the job hasn't already finished. */
  cancel(jobId: string): WorkerJobRecord {
    const record = this.requireJob(jobId);
    if (record.status === "COMPLETED" || record.status === "FAILED" || record.status === "CANCELLED") {
      throw new GPUWorkerError(`Job "${jobId}" already reached a terminal state ("${record.status}") and cannot be cancelled.`);
    }

    this.abortControllers.get(jobId)?.abort();
    record.status = "CANCELLED";
    record.completedAt = new Date().toISOString();
    return record;
  }

  getWorkerStatus(): WorkerStatus {
    const active = Array.from(this.jobs.values()).filter((j) => j.status === "PENDING" || j.status === "PROCESSING");
    return {
      health: "HEALTHY", // this process responding at all is the real, non-fabricated signal — see docs/architecture/local-gpu-provider.md's Failure Handling section for what "UNHEALTHY" would require.
      busy: this.busyCount > 0,
      idle: this.busyCount === 0,
      version: GPUWorker.VERSION,
      modelName: this.backend.modelName,
      gpuInfo: this.gpuInfo,
      currentJobIds: active.map((j) => j.jobId),
      queueDepth: active.length,
    };
  }

  getHeartbeat(): GPUHeartbeat {
    const status = this.getWorkerStatus();
    return {
      timestamp: new Date().toISOString(),
      healthy: status.health === "HEALTHY",
      temperatureCelsius: undefined,
      vramTotalMB: status.gpuInfo.vramMB,
      utilizationPercent: undefined,
      queueDepth: status.queueDepth,
      runningJobs: status.currentJobIds.length,
      workerVersion: status.version,
    };
  }

  private async runJob(jobId: string): Promise<void> {
    const record = this.requireJob(jobId);
    const controller = new AbortController();
    this.abortControllers.set(jobId, controller);

    record.status = "PROCESSING";
    this.busyCount++;
    try {
      const output = await this.backend.generate(record.request, controller.signal);
      // A cancel() call may have already flipped this record to CANCELLED
      // while the backend call was in flight — don't overwrite that. Read
      // through the map fresh (not the narrowed `record.status` TS would
      // otherwise assume is still "PROCESSING") since cancel() mutates the
      // same object concurrently with this async function.
      if (this.isCancelled(jobId)) return;
      record.output = output;
      record.status = "COMPLETED";
      record.completedAt = new Date().toISOString();
    } catch (error) {
      if (this.isCancelled(jobId)) return;
      record.status = "FAILED";
      record.error = error instanceof Error ? error.message : String(error);
      record.completedAt = new Date().toISOString();
    } finally {
      this.busyCount--;
      this.abortControllers.delete(jobId);
    }
  }

  private isCancelled(jobId: string): boolean {
    return this.jobs.get(jobId)?.status === "CANCELLED";
  }

  private requireJob(jobId: string): WorkerJobRecord {
    const record = this.jobs.get(jobId);
    if (!record) {
      throw new GPUWorkerError(`No job "${jobId}" on this worker.`);
    }
    return record;
  }
}
