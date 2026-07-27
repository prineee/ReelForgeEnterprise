import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSharedProductionContextRepository } from "@/services/infrastructure/MovieProductionFactory";
import { getSharedRenderJobManager, buildDirectorPlan } from "@/services/infrastructure/MovieWorkspaceFactory";
import type { RenderRequest } from "@/services/rendering/interfaces/RenderProvider";

/**
 * Submits one real render job via RenderJobManager.submit() (services/rendering/jobs/RenderJobManager.ts,
 * Sprint 5) — which drives the real RenderOrchestrator -> ProviderRegistry
 * -> whichever provider VIDEO_PROVIDER selects (services/rendering/,
 * Sprints 1-4), exactly like the rest of the app. Not a simulated/fake
 * submission — this is a genuine RenderRequest, built from this
 * production's already-generated SceneGenerationRequest (Stage 3 output)
 * when available, or the real AIDirectorEngine + DirectorPromptPipeline
 * (services/ai/director-engine/) otherwise.
 */
export async function POST(req: Request, { params }: { params: Promise<{ movieId: string }> }) {
  const { movieId } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const sceneId = (body as { sceneId?: unknown } | null)?.sceneId;
  if (typeof sceneId !== "string" || sceneId.trim().length === 0) {
    return NextResponse.json({ error: "sceneId is required." }, { status: 400 });
  }

  const context = getSharedProductionContextRepository().get(movieId);
  if (!context) {
    return NextResponse.json({ error: "Unknown movie." }, { status: 404 });
  }

  // Prefer Stage 3's already-computed SceneGenerationRequest (real production
  // data); fall back to recomputing it live via AIDirectorEngine + DirectorPromptPipeline
  // when the movie hasn't reached that stage through the standard pipeline yet.
  let renderRequest: RenderRequest | undefined;
  const existingRequest = context.sceneGenerationRequests?.find((request) => request.sceneId === sceneId);
  if (existingRequest) {
    renderRequest = {
      prompt: existingRequest.positivePrompt,
      negativePrompt: existingRequest.negativePrompt,
      aspectRatio: existingRequest.aspectRatio,
      durationSeconds: existingRequest.expectedDuration,
      quality: existingRequest.quality,
    };
  } else {
    let built: ReturnType<typeof buildDirectorPlan>;
    try {
      built = buildDirectorPlan(context);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to plan this movie's prompts.";
      return NextResponse.json({ error: message }, { status: 422 });
    }
    const sceneRequest = built?.plan.prompts.requests.find((request) => request.sceneNumber.toString() === sceneId || request.sceneId === sceneId);
    if (sceneRequest) {
      renderRequest = {
        prompt: sceneRequest.positivePrompt,
        negativePrompt: sceneRequest.negativePrompt,
        aspectRatio: sceneRequest.aspectRatio,
        durationSeconds: sceneRequest.expectedDuration,
        quality: sceneRequest.quality,
      };
    }
  }

  if (!renderRequest) {
    return NextResponse.json({ error: `No scene prompt available for scene "${sceneId}" yet.` }, { status: 422 });
  }

  const manager = getSharedRenderJobManager();
  const job = manager.submit({
    request: renderRequest,
    userId: user.id,
    projectId: movieId,
    sceneId,
  });

  return NextResponse.json({ success: true, job });
}
