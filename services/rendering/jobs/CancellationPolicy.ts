/**
 * CancellationPolicy.ts
 *
 * Two separate, honest facts about cancelling a render job:
 *
 *   1. isCancellable(status) — whether a job in this status can be
 *      cancelled at all. Mirrors queue/RenderQueue.ts's state machine:
 *      COMPLETED/FAILED/CANCELLED are terminal there (no valid outgoing
 *      transitions), so those three — and only those three — are not
 *      cancellable. Not derived by importing RenderQueue's own
 *      VALID_TRANSITIONS table (kept private to that file); "terminal
 *      states can't be cancelled" is a stable structural fact independent
 *      of that table's exact shape.
 *
 *   2. supportsRealCancellation(providerId) — whether cancelling
 *      actually stops in-flight provider work, vs. merely making
 *      RenderJobManager stop tracking the job locally (the same
 *      cooperative-only limitation services/queue/QueueManager.ts's own
 *      cancel() has for RUNNING jobs). Today only LOCAL_GPU is true:
 *      services/gpu/LocalGPURenderAPI.ts#cancel() really does kill the
 *      in-flight ffmpeg process (verified in Sprint 4). LTX and Google
 *      have no cancel capability anywhere in VeoClient/RenderProvider.
 *      RenderJobManager does not call that real LOCAL_GPU cancel() yet —
 *      RenderProvider (interfaces/RenderProvider.ts) has no cancel()
 *      method, and adding one would ripple into every existing provider,
 *      out of scope for this sprint. This method only exposes the
 *      capability as data for a future sprint to act on.
 */

import type { RenderJobStatus } from "../types/RenderJob";
import type { ProviderId } from "../interfaces/RenderProvider";

const TERMINAL_STATUSES: ReadonlySet<RenderJobStatus> = new Set(["COMPLETED", "FAILED", "CANCELLED"]);

const REAL_CANCELLATION_PROVIDERS: ReadonlySet<ProviderId> = new Set(["LOCAL_GPU"]);

export class CancellationPolicy {
  isCancellable(status: RenderJobStatus): boolean {
    return !TERMINAL_STATUSES.has(status);
  }

  supportsRealCancellation(providerId: ProviderId): boolean {
    return REAL_CANCELLATION_PROVIDERS.has(providerId);
  }
}
