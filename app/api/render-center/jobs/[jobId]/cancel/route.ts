import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSharedRenderJobManager } from "@/services/infrastructure/MovieWorkspaceFactory";
import { RenderJobManagerError } from "@/services/rendering/jobs/RenderJobManager";

/**
 * Queue Manager (Module 3) — cancels a pending/in-flight job through
 * RenderJobManager.cancel(), its own real, already-existing method
 * (validated against CancellationPolicy — throws if the job's current
 * status isn't cancellable). No queue is bypassed or duplicated here.
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
    const job = getSharedRenderJobManager().cancel(jobId);
    return NextResponse.json({ success: true, job });
  } catch (error) {
    if (error instanceof RenderJobManagerError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    const message = error instanceof Error ? error.message : "Failed to cancel job.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
