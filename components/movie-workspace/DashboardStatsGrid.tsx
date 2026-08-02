import { Film, FileEdit, CheckCircle2, Loader2, XCircle, Coins, HardDrive } from "lucide-react";
import { StatsCard } from "@/components/ui/StatsCard";

export interface DashboardStatsGridProps {
  totalMovies: number;
  drafts: number;
  completed: number;
  rendering: number;
  failed: number;
  credits: number;
}

/**
 * Module 1 — every count is derived server-side from the real
 * WorkflowEngine.listWorkflows() (services/workflow/WorkflowEngine.ts),
 * scoped to the authenticated user exactly like the existing
 * /api/workflow/list route already does. Credits come from the same
 * Supabase `users.credits` column app/(dashboard)/layout.tsx already
 * reads — not a second, competing credit source. Storage Used is
 * honestly omitted: no service anywhere in this codebase aggregates real
 * upload/storage bytes across a user's productions (CloudinaryService
 * only reports per-asset metadata on request), so showing a number here
 * would be fabricated.
 */
export function DashboardStatsGrid({ totalMovies, drafts, completed, rendering, failed, credits }: DashboardStatsGridProps) {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
      <StatsCard label="Movies" value={totalMovies} icon={<Film className="h-5 w-5" />} />
      <StatsCard label="Drafts" value={drafts} icon={<FileEdit className="h-5 w-5" />} />
      <StatsCard label="Rendering" value={rendering} icon={<Loader2 className="h-5 w-5" />} />
      <StatsCard label="Completed" value={completed} icon={<CheckCircle2 className="h-5 w-5" />} />
      <StatsCard label="Failed" value={failed} icon={<XCircle className="h-5 w-5" />} />
      <StatsCard label="Credits" value={credits.toLocaleString()} icon={<Coins className="h-5 w-5" />} />
      <StatsCard label="Storage Used" value="—" hint="Not yet tracked" icon={<HardDrive className="h-5 w-5" />} className="col-span-2 lg:col-span-1" />
    </div>
  );
}

export default DashboardStatsGrid;
