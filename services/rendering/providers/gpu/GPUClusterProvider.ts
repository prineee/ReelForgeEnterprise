/**
 * GPUClusterProvider.ts
 *
 * Placeholder for a multi-node, queued/scheduled GPU render backend.
 * Registered in ProviderRegistry under "GPU_CLUSTER" today so the
 * provider roster and selection architecture exist ahead of the real
 * implementation — see docs/architecture/render-orchestrator.md's GPU
 * migration plan. Every method throws until a real implementation
 * replaces this class; nothing currently selects "GPU_CLUSTER" (see
 * ProviderSelector.ts).
 */

import { NotImplementedRenderProvider } from "../NotImplementedRenderProvider";

export class GPUClusterProvider extends NotImplementedRenderProvider {
  readonly name = "GPU_CLUSTER";
}
