/**
 * RenderEvents.ts
 *
 * Event type architecture only — no event bus/emitter exists yet, and
 * nothing in this codebase publishes or subscribes to these today. This
 * defines the vocabulary a future event bus (Sprint 4+) will use, so
 * queue/RenderQueue.ts's state transitions, ledger/RenderLedger.ts's
 * writes, and health/ProviderHealthMonitor.ts's observations can
 * eventually be driven by (or drive) the same typed events instead of
 * direct method calls.
 */

import type { ProviderId } from "../interfaces/RenderProvider";
import type { RenderResult } from "../interfaces/RenderResult";

export type RenderEventType =
  | "RenderQueued"
  | "RenderAssigned"
  | "RenderStarted"
  | "RenderDownloaded"
  | "RenderVerified"
  | "RenderCompleted"
  | "RenderFailed"
  | "RenderCancelled";

interface RenderEventBase {
  jobId: string;
  provider?: ProviderId;
  timestamp: string;
}

export interface RenderQueuedEvent extends RenderEventBase {
  type: "RenderQueued";
}

export interface RenderAssignedEvent extends RenderEventBase {
  type: "RenderAssigned";
  provider: ProviderId;
}

export interface RenderStartedEvent extends RenderEventBase {
  type: "RenderStarted";
  provider: ProviderId;
}

export interface RenderDownloadedEvent extends RenderEventBase {
  type: "RenderDownloaded";
  videoUrl?: string;
}

export interface RenderVerifiedEvent extends RenderEventBase {
  type: "RenderVerified";
}

export interface RenderCompletedEvent extends RenderEventBase {
  type: "RenderCompleted";
  result: RenderResult;
}

export interface RenderFailedEvent extends RenderEventBase {
  type: "RenderFailed";
  error: string;
  retryCount?: number;
}

export interface RenderCancelledEvent extends RenderEventBase {
  type: "RenderCancelled";
  reason?: string;
}

/** Discriminated union over `type` — every event this architecture defines. */
export type RenderEvent =
  | RenderQueuedEvent
  | RenderAssignedEvent
  | RenderStartedEvent
  | RenderDownloadedEvent
  | RenderVerifiedEvent
  | RenderCompletedEvent
  | RenderFailedEvent
  | RenderCancelledEvent;
