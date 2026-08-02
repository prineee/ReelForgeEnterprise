import { Clapperboard, Users, Package, Timer, Coins, CreditCard, Gauge } from "lucide-react";
import { StatsCard } from "@/components/ui/StatsCard";

export interface ProjectStatisticsProps {
  totalScenes: number;
  totalCharacters: number;
  totalAssets: number;
  movieLengthSeconds: number;
  /** undefined when CostOptimizer/GPUManager haven't got real pricing/hardware data yet — see services/rendering/CostOptimizer.ts and services/rendering/gpu/GPUManager.ts, both honest "not implemented yet" stubs by design (Sprints 3-4). Never a guessed number. */
  estimatedCost?: number;
  creditsRequired?: number;
  renderTimeEstimateSeconds?: number;
}

/** Module 8 — every number is computed server-side from real backend state (see app/movie-studio/workspace/[movieId]/page.tsx); this component only formats. */
export function ProjectStatistics({
  totalScenes,
  totalCharacters,
  totalAssets,
  movieLengthSeconds,
  estimatedCost,
  creditsRequired,
  renderTimeEstimateSeconds,
}: ProjectStatisticsProps) {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <StatsCard label="Total Scenes" value={totalScenes} icon={<Clapperboard className="h-5 w-5" />} />
      <StatsCard label="Total Characters" value={totalCharacters} icon={<Users className="h-5 w-5" />} />
      <StatsCard label="Total Assets" value={totalAssets} icon={<Package className="h-5 w-5" />} />
      <StatsCard label="Movie Length" value={formatDuration(movieLengthSeconds)} icon={<Timer className="h-5 w-5" />} />
      <StatsCard label="Estimated Cost" value={estimatedCost !== undefined ? `$${estimatedCost.toFixed(2)}` : "—"} hint={estimatedCost === undefined ? "Not yet available" : undefined} icon={<Coins className="h-5 w-5" />} />
      <StatsCard label="Credits Required" value={creditsRequired ?? "—"} hint={creditsRequired === undefined ? "Not yet available" : undefined} icon={<CreditCard className="h-5 w-5" />} />
      <StatsCard label="Render Time Estimate" value={renderTimeEstimateSeconds !== undefined ? formatDuration(renderTimeEstimateSeconds) : "—"} hint={renderTimeEstimateSeconds === undefined ? "Not yet available" : undefined} icon={<Gauge className="h-5 w-5" />} />
    </div>
  );
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}m ${s}s`;
}

export default ProjectStatistics;
