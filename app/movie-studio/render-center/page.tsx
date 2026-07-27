import { Boxes } from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";
import { RenderCenterJobCard } from "@/components/render-dashboard/RenderCenterJobCard";
import { listRenderJobSummaries, type RenderJobSummary } from "@/services/infrastructure/RenderCenterFactory";
import type { RenderJobStatus } from "@/services/rendering/types/RenderJob";

/** Reads live server-side in-memory state (the shared RenderJobManager singleton) on every request — must not be statically prerendered. */
export const dynamic = "force-dynamic";

const ACTIVE_STATUSES: readonly RenderJobStatus[] = ["ASSIGNED", "RENDERING", "DOWNLOADING", "VERIFYING"];
const QUEUE_STATUSES: readonly RenderJobStatus[] = ["QUEUED", "WAITING"];

const COLUMNS: { title: string; statuses: readonly RenderJobStatus[] }[] = [
  { title: "Active Jobs", statuses: ACTIVE_STATUSES },
  { title: "Queued Jobs", statuses: QUEUE_STATUSES },
  { title: "Completed Jobs", statuses: ["COMPLETED"] },
  { title: "Failed Jobs", statuses: ["FAILED"] },
  { title: "Cancelled Jobs", statuses: ["CANCELLED"] },
];

/**
 * Render Center — operational command center over RenderJobManager, the
 * one real render queue (services/rendering/jobs/RenderJobManager.ts).
 * Modules are added to this page as their own sprint milestones; this
 * file grows one section per module rather than each module inventing
 * its own page, matching a dashboard-first layout rather than tabs (a
 * command center needs several sections visible at once).
 */
export default async function RenderCenterPage({ searchParams }: { searchParams: Promise<{ job?: string }> }) {
  const { job: selectedJobId } = await searchParams;
  const jobs = listRenderJobSummaries();

  return (
    <div className="min-h-screen bg-surface px-4 py-8 text-white sm:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Render Center</h1>
          <p className="mt-1 text-sm text-zinc-400">Monitor, queue, and inspect every render job across every production.</p>
        </div>

        {jobs.length === 0 ? (
          <EmptyState
            icon={<Boxes className="h-7 w-7" />}
            title="No render jobs yet"
            description="Submit a render from a movie's Storyboard or Scene Studio to see it here."
          />
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
            {COLUMNS.map((column) => {
              const columnJobs = jobs.filter((job) => column.statuses.includes(job.status));
              return (
                <div key={column.title} className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                    {column.title} ({columnJobs.length})
                  </p>
                  <div className="space-y-2">
                    {columnJobs.length === 0 ? (
                      <p className="text-xs text-zinc-600">None</p>
                    ) : (
                      columnJobs.map((job: RenderJobSummary) => (
                        <RenderCenterJobCard key={job.jobId} job={job} selected={job.jobId === selectedJobId} />
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
