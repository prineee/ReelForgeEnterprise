"use client";

import { useEffect, useState } from "react";
import { Film } from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";
import type { RenderJobStatus } from "@/services/rendering/types/RenderJob";
import { RenderJobCard, type RenderJobView } from "./RenderJobCard";

const POLL_INTERVAL_MS = 5000;

const COLUMNS: { key: RenderJobStatus[]; label: string }[] = [
  { key: ["QUEUED"], label: "Queued" },
  { key: ["WAITING", "ASSIGNED"], label: "Preparing" },
  { key: ["RENDERING"], label: "Rendering" },
  { key: ["DOWNLOADING", "VERIFYING"], label: "Downloading" },
  { key: ["COMPLETED"], label: "Completed" },
  { key: ["FAILED"], label: "Failed" },
  { key: ["CANCELLED"], label: "Cancelled" },
];

/**
 * Module 7 — polls the real GET /api/movie-studio/[movieId]/render-jobs
 * route (same polling convention already used by app/(dashboard)/asset-manager
 * and movie-library: plain fetch + setInterval, no React Query/SWR in this
 * project) which reads directly from RenderJobManager (services/rendering/jobs/,
 * Sprint 5) — no mock data, no simulated progress.
 */
export function RenderDashboard({ movieId, initialJobs = [] }: { movieId: string; initialJobs?: RenderJobView[] }) {
  const [jobs, setJobs] = useState<RenderJobView[]>(initialJobs);

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      try {
        const res = await fetch(`/api/movie-studio/${movieId}/render-jobs`);
        if (!res.ok) return;
        const data = (await res.json()) as { jobs: RenderJobView[] };
        if (!cancelled) setJobs(data.jobs);
      } catch {
        // Best-effort live sync — matches the existing asset-manager/movie-library polling convention.
      }
    }

    poll();
    const interval = setInterval(poll, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [movieId]);

  if (jobs.length === 0) {
    return (
      <EmptyState
        icon={<Film className="h-7 w-7" />}
        title="No renders submitted yet"
        description='Click "Render" on a scene in the Storyboard to submit a real render job.'
      />
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {COLUMNS.map((column) => {
        const columnJobs = jobs.filter((job) => column.key.includes(job.status));
        if (columnJobs.length === 0) return null;
        return (
          <div key={column.label} className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
              {column.label} ({columnJobs.length})
            </p>
            <div className="space-y-2">
              {columnJobs.map((job) => (
                <RenderJobCard key={job.jobId} job={job} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default RenderDashboard;
