import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSharedRenderJobManager } from "@/services/infrastructure/MovieWorkspaceFactory";

/**
 * Queue Manager (Module 3) — "manual retry" of a failed job. RenderJobManager
 * has no retry(jobId) entry point (its own retry policy is fully internal:
 * on failure it evaluates RetryPolicy and, if eligible, automatically
 * re-enqueues a new job carrying retriedFromJobId — see RenderJobManager.ts's
 * scheduleRetry()). This route does not reach into or duplicate that
 * internal mechanism; it resubmits the failed job's own real request
 * through RenderJobManager's public submit() — the same method every other
 * render submission in this app uses — producing a new, independent job.
 * It will not carry retriedFromJobId (that field is only set by the
 * automatic internal path), which the UI discloses rather than fabricates.
 */
export async function POST(_req: Request, { params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const manager = getSharedRenderJobManager();
    const original = manager.getJob(jobId);
    if (!original) {
      return NextResponse.json({ error: `No render job "${jobId}".` }, { status: 404 });
    }
    if (original.status !== "FAILED") {
      return NextResponse.json({ error: `Job "${jobId}" is not FAILED — only failed jobs can be manually retried.` }, { status: 409 });
    }

    const job = manager.submit({
      request: original.request,
      userId: original.userId ?? user.id,
      projectId: original.projectId,
      sceneId: original.sceneId,
      assetId: original.assetId,
    });

    return NextResponse.json({ success: true, job });
  } catch (error) {
    console.error("[render-center/jobs/retry] POST failed", error);
    return NextResponse.json({ error: "Failed to retry render job." }, { status: 500 });
  }
}
