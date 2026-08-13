import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { createDefaultBillingEngine } from "@/services/billing/BillingEngine";
import {
  getSharedProductionContextRepository,
  CloudinaryStorageClient,
} from "@/services/infrastructure/MovieProductionFactory";
import { RenderOrchestrator } from "@/services/rendering/RenderOrchestrator";
import { createDefaultProviderRegistry } from "@/services/rendering/ProviderRegistry";
import { ProviderSelector } from "@/services/rendering/ProviderSelector";
import type { ProviderId } from "@/services/rendering/interfaces/RenderProvider";
import { runVeoSmokeTest } from "@/services/internal/VeoSmokeTestHarness";

const MIN_PROMPT_LENGTH = 10;
const MAX_PROMPT_LENGTH = 2000;

// Generation + polling can run for minutes — the exact bug fixed in
// commit 7356509 for /api/movie/create applies here too: without this,
// the function can be killed mid-generation before the single
// renderAndWait() call resolves either way.
export const maxDuration = 300;

/**
 * ForceGoogleProviderSelector — this route's whole reason for existing is
 * to test the real Veo integration specifically, regardless of whatever
 * VIDEO_PROVIDER is configured for real user traffic (currently "ltx" in
 * production — see VGE-01). The base ProviderSelector reads that env var;
 * this override always returns GOOGLE, so this endpoint can never
 * silently exercise LTX instead of Veo, and never falls back to it on
 * failure (nothing here catches a GOOGLE failure and re-selects).
 */
class ForceGoogleProviderSelector extends ProviderSelector {
  select(): ProviderId {
    return "GOOGLE";
  }
}

/**
 * POST /api/internal/veo-smoke-test
 *
 * Internal/developer-only. No UI, no sidebar entry, not reachable by any
 * beta user — gated by requireAdmin() (lib/admin.ts), the same
 * authorization already protecting every app/api/admin/** route. Runs
 * exactly one real Veo generation through the existing
 * RenderProvider/RenderOrchestrator/BillingEngine/ProductionContextRepository/
 * Cloudinary stack (see services/internal/VeoSmokeTestHarness.ts) — no
 * new provider, no duplicated billing or upload logic, no automatic
 * retry, no LTX fallback.
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

  const cloudinaryCloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const cloudinaryApiKey = process.env.CLOUDINARY_API_KEY;
  const cloudinaryApiSecret = process.env.CLOUDINARY_API_SECRET;
  if (!cloudinaryCloudName || !cloudinaryApiKey || !cloudinaryApiSecret) {
    return NextResponse.json({ error: "Cloudinary credentials are not configured." }, { status: 500 });
  }

  const registry = createDefaultProviderRegistry();
  const orchestrator = new RenderOrchestrator(registry, new ForceGoogleProviderSelector());
  const cloudinaryClient = new CloudinaryStorageClient(cloudinaryCloudName, cloudinaryApiKey, cloudinaryApiSecret);

  try {
    const result = await runVeoSmokeTest(
      { userId: check.userId, prompt, aspectRatio, durationSeconds },
      {
        billingEngine: createDefaultBillingEngine(),
        contextRepository: getSharedProductionContextRepository(),
        orchestrator,
        uploadVideo: async (sourceUrl, publicId) => {
          const uploaded = await cloudinaryClient.upload({
            sourceUrl,
            resourceType: "video",
            folder: "reelforge/internal-veo-smoke-test",
            fileName: publicId,
            overwrite: false,
          });
          return { secureUrl: uploaded.secureUrl ?? uploaded.url };
        },
      }
    );

    return NextResponse.json(result, { status: result.status === "COMPLETED" ? 200 : 502 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Veo smoke test failed unexpectedly.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
