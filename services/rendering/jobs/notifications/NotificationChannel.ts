/**
 * NotificationChannel.ts
 *
 * The interface future delivery channels (email, webhook, push, Slack,
 * in-app) implement — no delivery implementation exists yet, per this
 * sprint's explicit scope. jobs/RenderJobManager.ts calls notify() on
 * every injected channel at each real lifecycle transition; today the
 * only implementations are NoOpNotificationChannel and
 * ConsoleNotificationChannel (this folder) — genuine, working reference
 * implementations, same honesty standard as Sprint 4's
 * SyntheticTestPatternBackend: neither pretends to be a real delivery
 * mechanism, and neither fakes success.
 */

import type { RenderJobStatus } from "../../types/RenderJob";

export type RenderJobNotificationType =
  | "JobQueued"
  | "JobStarted"
  | "JobProgress"
  | "JobCompleted"
  | "JobFailed"
  | "JobRetrying"
  | "JobCancelled";

export interface RenderJobNotificationEvent {
  type: RenderJobNotificationType;
  jobId: string;
  userId?: string;
  stage?: RenderJobStatus;
  message?: string;
  timestamp: string;
}

export interface NotificationChannel {
  readonly name: string;
  notify(event: RenderJobNotificationEvent): Promise<void>;
}
