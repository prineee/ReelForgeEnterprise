/**
 * RenderJobProgress.ts
 *
 * The detailed, stage-based progress view jobs/RenderJobManager.ts builds
 * as a job moves through queue/RenderQueue.ts's RenderJobStatus state
 * machine — a real, timestamped history of every stage actually entered,
 * not a fabricated percentage. RENDER_JOB_STAGE_ORDER mirrors the linear
 * happy-path order RenderQueue's own VALID_TRANSITIONS table encodes
 * (QUEUED -> ... -> COMPLETED); FAILED/CANCELLED are terminal but
 * off-path, so they're deliberately excluded from this ordered list and
 * handled separately by whatever computes percentComplete.
 */

import type { RenderJobStatus } from "./RenderJob";

export const RENDER_JOB_STAGE_ORDER: readonly RenderJobStatus[] = [
  "QUEUED",
  "WAITING",
  "ASSIGNED",
  "RENDERING",
  "DOWNLOADING",
  "VERIFYING",
  "COMPLETED",
];

export interface RenderJobStageEvent {
  stage: RenderJobStatus;
  enteredAt: string;
}

export interface RenderJobProgress {
  jobId: string;
  currentStage: RenderJobStatus;
  /** 0-100. 100 only once COMPLETED; FAILED/CANCELLED report how far the job got, not 0, so a caller can tell "died early" from "died right before finishing." */
  percentComplete: number;
  /** Every stage this job actually entered, in order, with real timestamps — not a fabricated ETA. */
  history: RenderJobStageEvent[];
  updatedAt: string;
}
