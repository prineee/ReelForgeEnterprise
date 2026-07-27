/**
 * RenderResult.ts
 *
 * The single result shape every RenderProvider (cloud API, local GPU, GPU
 * cluster, or any future model backend) must return from generate(),
 * checkStatus(), and download(). RenderOrchestrator and every caller above
 * it (Movie Studio, Cartoon Studio, Cinema Studio, Marketing Studio, and
 * any future product) depend on this shape only — no provider-specific
 * field (LTX's task_id, Google's operation name, a future GPU worker's
 * node id, etc.) is allowed to leak past a RenderProvider's boundary.
 * Provider-specific detail that doesn't fit this shape belongs in
 * `metadata`, not as a new top-level field.
 */

/**
 * Lifecycle status of a render job, provider-agnostic. Mirrors
 * VeoGenerationStatus (services/ai/providers/google/VeoService.ts) by
 * design — today's providers are literally VeoClient implementations
 * under the hood — but is declared independently so this contract never
 * depends on that provider-specific module.
 */
export type RenderStatus = "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED";

/**
 * Standard result object. Every RenderProvider method returns exactly
 * this structure — never a provider SDK's native response type.
 */
export interface RenderResult {
  /** RenderOrchestrator's own job id (see RenderOrchestrator.ts), stable across generate()/checkStatus()/download() for the same job. */
  jobId: string;
  status: RenderStatus;
  /** The ProviderId that produced this result (see interfaces/RenderProvider.ts). */
  provider: string;
  videoUrl?: string;
  thumbnail?: string;
  /** Seconds. */
  duration?: number;
  /** e.g. "1920x1080". */
  resolution?: string;
  /** Provider-specific detail that doesn't belong at the top level (raw ids, timing, provider response fragments). */
  metadata?: Record<string, unknown>;
  /** Present only when status is FAILED. */
  error?: string;
}
