/**
 * GPUManager.ts
 *
 * Capacity/health/cost query surface — distinct from
 * providers/gpu/LocalGPUProvider.ts (the RenderProvider that actually
 * executes a render). GPUManager is what a decision-maker would consult
 * *before* routing to that provider at all. Since Sprint 4 this is real:
 * constructed with an optional services/gpu/GPUWorker.ts instance, it
 * reports that worker's genuine status, plus real (WMI-detected, never
 * fabricated) local GPU hardware info via detectSystemGPU().
 *
 * `isAvailable()` is deliberately about pipeline availability, not raw
 * hardware presence: a render worker actually has to be configured and
 * running for a render to be possible at all. With no worker injected
 * (`new GPUManager()`), every method reports honestly — false/empty/
 * throwing — never a fabricated success. estimateRenderTime()/
 * estimateRenderCost() are real, but are heuristics calibrated against
 * SyntheticTestPatternBackend's CPU/ffmpeg reference implementation, not
 * a real GPU model — see the TODOs below for what Sprint 5+ (a real
 * local model) needs to replace them with.
 */

import { detectSystemGPU, type DetectedGPU } from "@/services/gpu/detectSystemGPU";
import type { GPUWorker } from "@/services/gpu/GPUWorker";
import type { GPUHealth, GPUMemoryUsage } from "../types/GPUStatus";
import type { RenderRequest } from "../interfaces/RenderProvider";

/** Heuristic multiplier over requested duration, calibrated against SyntheticTestPatternBackend's real observed encode time — not a real GPU model's throughput. TODO Sprint 5+: replace with a real model's calibration once one exists. */
const REFERENCE_BACKEND_TIME_MULTIPLIER = 1.5;

export class GPUManager {
  private readonly gpuInfo: DetectedGPU;

  constructor(private readonly worker?: GPUWorker) {
    this.gpuInfo = detectSystemGPU();
  }

  /** True only when a render worker is actually configured — hardware presence alone (see getGPUHealth()) doesn't mean a render is possible. */
  isAvailable(): boolean {
    return this.worker !== undefined;
  }

  getGPUHealth(): GPUHealth {
    if (!this.worker) {
      return {
        available: false,
        healthy: false,
        message: "No local GPU worker configured.",
      };
    }

    const status = this.worker.getWorkerStatus();
    const hardwareNote = this.gpuInfo.detected
      ? `${this.gpuInfo.name ?? "GPU"} detected`
      : "no dedicated GPU hardware detected on this machine";

    return {
      available: true,
      healthy: status.health === "HEALTHY",
      message: `Worker v${status.version} (${status.modelName}) — ${hardwareNote}.`,
    };
  }

  getMemoryUsage(): GPUMemoryUsage {
    // TODO Sprint 5+: real live VRAM usage during an in-flight render —
    // requires GPU telemetry (nvidia-smi/rocm-smi or similar), not just
    // the static adapter RAM WMI reports.
    return { totalMB: this.gpuInfo.vramMB };
  }

  getQueueDepth(): number {
    return this.worker?.getWorkerStatus().queueDepth ?? 0;
  }

  estimateRenderTime(request: RenderRequest): number {
    if (!this.worker) {
      throw new Error("GPUManager.estimateRenderTime(): no local GPU worker configured.");
    }
    // TODO Sprint 5+: calibrate from ledger/RenderLedger.ts's actual
    // observed LOCAL_GPU generationTimeMs once enough real data exists,
    // instead of this fixed multiplier over requested duration.
    const durationSeconds = request.durationSeconds ?? 8;
    return durationSeconds * 1000 * REFERENCE_BACKEND_TIME_MULTIPLIER;
  }

  estimateRenderCost(_request: RenderRequest): number {
    if (!this.worker) {
      throw new Error("GPUManager.estimateRenderCost(): no local GPU worker configured.");
    }
    // Local hardware has no per-request API bill, unlike LTX/Google — but
    // it isn't free either (power + amortized hardware cost).
    // TODO Sprint 5+: amortize real power draw + hardware cost per render
    // once utilization data exists; 0 is honest for "no known cost model
    // yet," not a claim that local rendering is actually free.
    return 0;
  }
}
