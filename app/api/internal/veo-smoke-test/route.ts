import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { createDefaultBillingEngine } from "@/services/billing/BillingEngine";
import { getSharedProductionContextRepository } from "@/services/infrastructure/MovieProductionFactory";
import { reserveVeoSmokeTest } from "@/services/internal/VeoSmokeTestHarness";

const MIN_PROMPT_LENGTH = 10;
const MAX_PROMPT_LENGTH = 2000;

/**
 * POST /api/internal/veo-smoke-test
 *
 * Internal/developer-only. No UI, no sidebar entry, not reachable by any
 * beta user — gated by requireAdmin() (lib/admin.ts), the same
 * authorization already protecting every app/api/admin/** route.
 *
 * This route ONLY reserves credits and enqueues one job on the Railway
 * worker — it does not call Veo, does not poll, does not upload, and
 * returns in well under a second. That split is deliberate: Vercel's
 * Hobby plan hard-kills any function after 60 seconds regardless of
 * `maxDuration`, but a real Veo generation (submit, poll, download) can
 * take several minutes. Running that synchronously here previously risked
 * the function being killed mid-generation with credits already reserved
 * and nothing to release them (see services/internal/VeoSmokeTestHarness.ts's
 * header). The actual generation, Cloudinary upload, and billing
 * settlement/release now happen on the Railway worker (see
 * worker/src/services/veoSmokeTestWorker.js), which has no execution-time
 * ceiling.
 *
 * Body: { prompt: string, aspectRatio?: string, durationSeconds?: number }
 */
export async function POST(req: Request) {
  const check = await requireAdmin();
  if (!check.ok) return check.response;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const rawPrompt = (body as { prompt?: unknown } | null)?.prompt;
  if (typeof rawPrompt !== "string") {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const prompt = rawPrompt.trim();
  if (prompt.length < MIN_PROMPT_LENGTH || prompt.length > MAX_PROMPT_LENGTH) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const rawAspectRatio = (body as { aspectRatio?: unknown } | null)?.aspectRatio;
  const aspectRatio = typeof rawAspectRatio === "string" ? rawAspectRatio : undefined;

  const rawDuration = (body as { durationSeconds?: unknown } | null)?.durationSeconds;
  const durationSeconds = typeof rawDuration === "number" ? rawDuration : undefined;

  const workerUrl = process.env.NEXT_PUBLIC_WORKER_URL;
  if (!workerUrl) {
    return NextResponse.json({ error: "NEXT_PUBLIC_WORKER_URL is not configured." }, { status: 500 });
  }

  const billingEngine = createDefaultBillingEngine();

  // Reserve first — the job payload sent to the worker below is exactly
  // this reservation, so the worker never has to re-derive or re-select
  // a provider/duration on its own.
  const reservation = await reserveVeoSmokeTest(
    { userId: check.userId, prompt, aspectRatio, durationSeconds },
    { billingEngine, contextRepository: getSharedProductionContextRepository() }
  );

  try {
    const response = await fetch(`${workerUrl}/api/internal/veo-smoke-test/enqueue`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(reservation),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      // Enqueue is a fast, synchronous HTTP call (unlike Veo generation
      // itself) — its failure is known well within Vercel's execution
      // window, so it's safe to release the reservation right here rather
      // than leaving it HELD with no job that will ever execute it.
      await billingEngine
        .releaseReservation(reservation.reservationId, `Veo smoke test enqueue failed: ${response.status}`)
        .catch(() => {});
      return NextResponse.json(
        { error: `Worker enqueue failed (${response.status}): ${detail.slice(0, 300)}` },
        { status: 502 }
      );
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Worker enqueue failed unexpectedly.";
    await billingEngine.releaseReservation(reservation.reservationId, `Veo smoke test enqueue failed: ${message}`).catch(() => {});
    return NextResponse.json({ error: message }, { status: 502 });
  }

  return NextResponse.json({
    productionId: reservation.productionId,
    reservationId: reservation.reservationId,
    provider: reservation.provider,
    requestedDurationSeconds: reservation.durationSeconds,
    status: "QUEUED",
  });
}
