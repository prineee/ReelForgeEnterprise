import Link from "next/link";
import { AlertTriangle, Clapperboard, Cpu, Film, GanttChartSquare, LayoutGrid, UserCircle2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { RenderJobStatusBadge } from "@/components/render-dashboard/RenderJobStatusBadge";
import type { JobDetail } from "@/services/infrastructure/RenderCenterFactory";

export interface JobDetailsPanelProps {
  detail: JobDetail;
}

/**
 * Module 2 — every field reads directly from the real RenderJob
 * (services/rendering/types/RenderJob.ts) and its real RenderJobProgress
 * (RenderJobManager.getProgress()). Resolution is RenderRequest.quality —
 * the same field RenderJobManager.recordOutcome() writes into the ledger
 * as requestedResolution, confirming this is genuinely the resolution
 * value, not a repurposed field. "Finished" only shows once the job has
 * actually reached a terminal state.
 *
 * Module 10 — navigation reuses each destination's real, already-built
 * route (Movie Workspace / Character Studio / Scene Studio) with this
 * job's real projectId/sceneId/characterIds. "Movie Editor" is
 * intentionally omitted — no such screen exists anywhere in this
 * codebase despite being listed in the sprint brief; linking to a
 * nonexistent route would be worse than omitting it.
 */
export function JobDetailsPanel({ detail }: JobDetailsPanelProps) {
  const { job, movieTitle, sceneTitle, progress } = detail;
  const isTerminal = job.status === "COMPLETED" || job.status === "FAILED" || job.status === "CANCELLED";

  return (
    <Card className="space-y-4 p-4 text-xs">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-white">{movieTitle ?? "Unknown movie"}</p>
          <p className="truncate text-zinc-500">{sceneTitle ?? (job.sceneId ? `Scene ${job.sceneId.slice(0, 8)}` : "No scene")}</p>
        </div>
        <RenderJobStatusBadge status={job.status} />
      </div>

      <div className="space-y-1">
        <Row label="Provider" value={job.providerId ?? "—"} icon={<Cpu className="h-3 w-3" />} />
        <Row label="Resolution" value={job.request.quality ?? "—"} />
        <Row label="Duration" value={job.request.durationSeconds !== undefined ? `${job.request.durationSeconds}s` : "—"} />
        <Row label="Current Stage" value={humanizeStage(progress.currentStage)} />
        <Row label="Retry Count" value={job.retryCount.toString()} />
        <Row label="Started" value={formatDate(job.createdAt)} />
        <Row label="Finished" value={isTerminal ? formatDate(job.updatedAt) : "Not finished yet"} />
      </div>

      <div>
        <div className="mb-1 flex items-center justify-between text-zinc-500">
          <span>Progress</span>
          <span>{progress.percentComplete}%</span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
          <div className="h-full rounded-full bg-brand-500 transition-all" style={{ width: `${progress.percentComplete}%` }} />
        </div>
      </div>

      {job.status === "FAILED" && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-2.5 text-red-300">
          <p className="mb-1 inline-flex items-center gap-1.5 font-semibold">
            <AlertTriangle className="h-3.5 w-3.5" /> Failure Reason
          </p>
          <p className="text-red-200/90">{job.error ?? "No error message was recorded for this failure."}</p>
        </div>
      )}

      <div>
        <p className="mb-1.5 border-b border-white/5 pb-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Navigation</p>
        <div className="flex flex-wrap gap-1.5">
          {job.projectId && (
            <>
              <NavLink href={`/movie-studio/workspace/${job.projectId}`} icon={<LayoutGrid className="h-3 w-3" />} label="Storyboard" />
              <NavLink href={`/movie-studio/workspace/${job.projectId}`} icon={<GanttChartSquare className="h-3 w-3" />} label="Timeline" />
              <NavLink href={`/movie-studio/workspace/${job.projectId}`} icon={<Film className="h-3 w-3" />} label="Movie Workspace" />
            </>
          )}
          {job.sceneId && <NavLink href={`/movie-studio/scenes/${job.sceneId}`} icon={<Clapperboard className="h-3 w-3" />} label="Scene Studio" />}
          {detail.characterLinks.map((character) => (
            <NavLink key={character.characterId} href={`/movie-studio/characters/${character.characterId}`} icon={<UserCircle2 className="h-3 w-3" />} label={character.name} />
          ))}
          <NavLink href="/movie-studio/render-center#provider-monitor" icon={<Cpu className="h-3 w-3" />} label="Provider Status" />
        </div>
      </div>
    </Card>
  );
}

function NavLink({ href, icon, label }: { href: string; icon: React.ReactNode; label: string }) {
  return (
    <Link href={href} className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-2 py-1 text-[10px] text-zinc-300 hover:bg-white/5">
      {icon}
      {label}
    </Link>
  );
}

function Row({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-white/5 py-1">
      <span className="inline-flex items-center gap-1.5 text-zinc-500">
        {icon}
        {label}
      </span>
      <span className="text-right text-zinc-300">{value}</span>
    </div>
  );
}

function humanizeStage(stage: string): string {
  return stage.charAt(0) + stage.slice(1).toLowerCase();
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString();
}

export default JobDetailsPanel;
