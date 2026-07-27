/**
 * LocalGPUProvider.ts
 *
 * REAL RenderProvider implementation (Sprint 4) — replaces the Sprint 1
 * NotImplementedRenderProvider placeholder. Delegates entirely to
 * LocalGPURenderAPI (services/gpu/LocalGPURenderAPI.ts), which already
 * returns RenderResult natively (see that file's header — there is no
 * external wire format to translate from, unlike the cloud adapters),
 * so this class does no translation of its own: generate()/
 * checkStatus()/download() forward straight to submit()/status()/
 * download(). No provider-specific object (WorkerJobRecord, GPUWorker's
 * WorkerStatus, ffmpeg process details, ...) ever crosses this boundary
 * — only RenderResult.
 *
 * Registered in ProviderRegistry under "LOCAL_GPU" since Sprint 1 (see
 * ProviderRegistry.ts's createDefaultProviderRegistry()) — no registry
 * change was needed for this sprint; replacing this class's
 * implementation is enough for that existing registration to start doing
 * real local rendering.
 */

import { GPUWorker } from "@/services/gpu/GPUWorker";
import { LocalGPURenderAPI } from "@/services/gpu/LocalGPURenderAPI";
import { SyntheticTestPatternBackend } from "@/services/gpu/backends/SyntheticTestPatternBackend";
import type { RenderProvider, RenderRequest } from "../../interfaces/RenderProvider";
import type { RenderResult } from "../../interfaces/RenderResult";

export class LocalGPUProvider implements RenderProvider {
  readonly name = "LOCAL_GPU";

  constructor(
    private readonly api: LocalGPURenderAPI = new LocalGPURenderAPI(new GPUWorker(new SyntheticTestPatternBackend()))
  ) {}

  async generate(request: RenderRequest): Promise<RenderResult> {
    return this.api.submit(request);
  }

  async checkStatus(jobId: string): Promise<RenderResult> {
    return this.api.status(jobId);
  }

  async download(jobId: string): Promise<RenderResult> {
    return this.api.download(jobId);
  }
}
