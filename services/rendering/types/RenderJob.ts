/**
 * RenderJob.ts
 *
 * Shared job-lifecycle type used by queue/RenderQueue.ts (the enterprise
 * in-memory job state machine) and referenced by ledger/RenderLedger.ts
 * (a completed/failed job's terminal RenderJobStatus becomes its ledger
 * entry's Status field). Declared once here so both modules — and any
 * future consumer — agree on the same state set instead of each
 * inventing their own.
 */

import type { ProviderId, RenderRequest } from "../interfaces/RenderProvider";
import type { RenderResult } from "../interfaces/RenderResult";

/**
 * Full job lifecycle, in order. RenderOrchestrator's actual render() flow
 * today only distinguishes PENDING/PROCESSING/COMPLETED/FAILED (see
 * interfaces/RenderResult.ts's RenderStatus) — RenderJobStatus is the
 * richer, queue-facing state set this sprint's architecture is built
 * around, for once a real scheduler (self-hosted GPU, GPU cluster) needs
 * to represent "waiting for a worker" vs "assigned to one" vs "actually
 * rendering" as distinct states.
 */
export type RenderJobStatus =
  | "QUEUED"
  | "WAITING"
  | "ASSIGNED"
  | "RENDERING"
  | "DOWNLOADING"
  | "VERIFYING"
  | "COMPLETED"
  | "FAILED"
  | "CANCELLED";

export type ExecutionTarget = "CLOUD" | "GPU";

export interface RenderJob {
  jobId: string;
  providerId?: ProviderId;
  request: RenderRequest;
  status: RenderJobStatus;
  priority?: "LOW" | "NORMAL" | "HIGH";
  executionTarget?: ExecutionTarget;
  retryCount: number;
  createdAt: string;
  updatedAt: string;
  result?: RenderResult;
  error?: string;

  // ── Sprint 5: asset ownership metadata ──────────────────────────────
  // All optional — additive, backward-compatible with every existing
  // caller of RenderQueue.enqueue()/updateStatus().
  userId?: string;
  projectId?: string;
  sceneId?: string;
  assetId?: string;

  /**
   * Set on a job created by RenderJobManager's retry path
   * (jobs/RenderJobManager.ts) — points at the jobId of the failed
   * attempt this one retries. FAILED is a terminal RenderJobStatus (see
   * queue/RenderQueue.ts's VALID_TRANSITIONS — it has no valid outgoing
   * transitions), so a retry is always a new RenderJob record, not a
   * reopened one; this field is what links the chain together, the same
   * pattern services/workflow/WorkflowCoordinator.ts already uses
   * (a fresh queue job per retry attempt) for the movie-workflow queue.
   */
  retriedFromJobId?: string;
}
