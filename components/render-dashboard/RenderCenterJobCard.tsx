import Link from "next/link";
import { Cpu, Film } from "lucide-react";
import { Card } from "@/components/ui/card";
import { RenderJobStatusBadge } from "./RenderJobStatusBadge";
import type { RenderJobSummary } from "@/services/infrastructure/RenderCenterFactory";

export interface RenderCenterJobCardProps {
  job: RenderJobSummary;
  selected?: boolean;
}

/** Every field reads from RenderCenterFactory.listRenderJobSummaries() — real RenderJobManager state, cross-movie. Reuses RenderJobStatusBadge (components/render-dashboard/RenderJobStatusBadge.tsx) rather than a second status-label mapping. */
export function RenderCenterJobCard({ job, selected }: RenderCenterJobCardProps) {
  return (
    <Link href={`/movie-studio/render-center?job=${job.jobId}`} scroll={false}>
      <Card hover className={`space-y-2 p-3 ${selected ? "border-brand-500/60 ring-1 ring-brand-500/40" : ""}`}>
        <div className="flex items-start justify-between gap-2">
          <p className="min-w-0 truncate text-xs font-semibold text-white">{job.movieTitle ?? "Unknown movie"}</p>
          <RenderJobStatusBadge status={job.status} />
        </div>

        <p className="truncate text-[10px] text-zinc-500">Job {job.jobId.slice(0, 8)}</p>

        <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
          <div className="h-full rounded-full bg-brand-500 transition-all" style={{ width: `${job.progress.percentComplete}%` }} />
        </div>

        <div className="flex items-center justify-between text-[10px] text-zinc-500">
          <span className="inline-flex items-center gap-1">
            <Cpu className="h-3 w-3" /> {job.providerId ?? "—"}
          </span>
          {job.retryCount > 0 && (
            <span className="inline-flex items-center gap-1">
              <Film className="h-3 w-3" /> Retry {job.retryCount}
            </span>
          )}
        </div>
      </Card>
    </Link>
  );
}

export default RenderCenterJobCard;
