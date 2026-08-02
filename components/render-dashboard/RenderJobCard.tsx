"use client";

import { useEffect, useState } from "react";
import { Cpu, Clock, ExternalLink } from "lucide-react";
import { Card } from "@/components/ui/card";
import type { RenderJobStatus } from "@/services/rendering/types/RenderJob";
import { RenderJobStatusBadge } from "./RenderJobStatusBadge";

export interface RenderJobView {
  jobId: string;
  sceneId?: string;
  status: RenderJobStatus;
  providerId?: string;
  retryCount: number;
  createdAt: string;
  updatedAt: string;
  videoUrl?: string;
  error?: string;
  progress: { percentComplete: number; currentStage: string };
}

const TERMINAL: ReadonlySet<RenderJobStatus> = new Set(["COMPLETED", "FAILED", "CANCELLED"]);

/** Every field is real RenderJobManager state (services/rendering/jobs/RenderJobManager.ts, Sprint 5) — elapsed time ticks from the real createdAt; estimated time is honestly "—" while in progress rather than a guessed number (no real per-provider estimate exists yet — see GPUManager.estimateRenderTime()'s documented "not implemented" state). */
export function RenderJobCard({ job }: { job: RenderJobView }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (TERMINAL.has(job.status)) return;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [job.status]);

  const elapsedMs = (TERMINAL.has(job.status) ? new Date(job.updatedAt).getTime() : now) - new Date(job.createdAt).getTime();

  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-white">Scene {job.sceneId ?? "—"}</p>
          <p className="truncate text-xs text-zinc-500">{job.jobId}</p>
        </div>
        <RenderJobStatusBadge status={job.status} />
      </div>

      <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full bg-gradient-to-r from-brand-500 to-purple-500 transition-all"
          style={{ width: `${job.progress.percentComplete}%` }}
        />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-zinc-400">
        <span className="inline-flex items-center gap-1">
          <Cpu className="h-3.5 w-3.5" /> {job.providerId ?? "—"}
        </span>
        <span className="inline-flex items-center gap-1">
          <Clock className="h-3.5 w-3.5" /> {formatDuration(elapsedMs)} elapsed
        </span>
        {job.retryCount > 0 && <span>Retry {job.retryCount}</span>}
        {job.videoUrl && (
          <a href={job.videoUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-brand-400 hover:underline">
            <ExternalLink className="h-3.5 w-3.5" /> View render
          </a>
        )}
      </div>

      {job.error && <p className="mt-2 text-xs text-red-400">{job.error}</p>}
    </Card>
  );
}

function formatDuration(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default RenderJobCard;
