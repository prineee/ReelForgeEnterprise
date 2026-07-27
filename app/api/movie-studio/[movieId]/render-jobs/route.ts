import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSharedRenderJobManager } from "@/services/infrastructure/MovieWorkspaceFactory";

/**
 * Real RenderJobManager (services/rendering/jobs/RenderJobManager.ts,
 * Sprint 5) state for one movie — no mock data. Jobs only appear here
 * once POST .../render (this same [movieId] route group) has actually
 * submitted one; an empty `jobs` array for a movie that hasn't rendered
 * anything yet is the honest result, not an error.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ movieId: string }> }) {
  const { movieId } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const manager = getSharedRenderJobManager();
  const jobs = manager.list().filter((job) => job.projectId === movieId);

  return NextResponse.json({
    success: true,
    movieId,
    jobs: jobs.map((job) => ({
      jobId: job.jobId,
      sceneId: job.sceneId,
      status: job.status,
      providerId: job.providerId,
      retryCount: job.retryCount,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
      videoUrl: job.result?.videoUrl,
      error: job.error,
      progress: manager.getProgress(job.jobId),
    })),
  });
}
