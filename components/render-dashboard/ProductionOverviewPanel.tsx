import Link from "next/link";
import { Clock, Coins, Film, Gauge, ListOrdered } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { ProductionOverviewData } from "@/services/infrastructure/RenderCenterFactory";

export interface ProductionOverviewPanelProps {
  overview: ProductionOverviewData;
}

/**
 * Module 5 — "Movies in Progress" and "Queue Length" read directly from
 * RenderJobManager.list() (the one real queue); per-movie scene totals
 * reuse ProductionPlanner's already-computed ProductionSchedule (Sprint
 * 10, via MovieProducerFactory.buildMovieProductionPlan()), never
 * recomputed. Average Render Duration reuses the real ledger's
 * generationTimeMs. Estimated Completion Time and Total Credits Required
 * are disclosed as "Not available yet" — no real per-job time/cost
 * estimate exists anywhere (GPUManager.estimateRenderTime()/CostOptimizer.estimateCost()
 * both throw "not implemented yet" upstream) — never guessed.
 */
export function ProductionOverviewPanel({ overview }: ProductionOverviewPanelProps) {
  const { moviesInProgress, queueLength, averageRenderDurationSeconds } = overview;

  return (
    <div className="space-y-3">
      <h2 className="text-sm font-semibold text-white">Production Overview</h2>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <StatCard icon={<Film className="h-4 w-4" />} label="Movies in Progress" value={moviesInProgress.length.toString()} />
        <StatCard icon={<ListOrdered className="h-4 w-4" />} label="Queue Length" value={queueLength.toString()} />
        <StatCard
          icon={<Gauge className="h-4 w-4" />}
          label="Avg. Render Duration"
          value={averageRenderDurationSeconds !== undefined ? `${averageRenderDurationSeconds.toFixed(1)}s` : "Not available yet"}
        />
        <StatCard icon={<Clock className="h-4 w-4" />} label="Est. Completion Time" value="Not available yet" />
        <StatCard icon={<Coins className="h-4 w-4" />} label="Total Credits Required" value="Not available yet" />
      </div>

      {moviesInProgress.length > 0 && (
        <div className="space-y-2">
          {moviesInProgress.map((movie) => (
            <Card key={movie.movieId} className="flex items-center justify-between gap-3 p-3 text-xs">
              <Link href={`/movie-studio/workspace/${movie.movieId}`} className="min-w-0 truncate text-white hover:text-brand-300 hover:underline">
                {movie.movieTitle}
              </Link>
              <div className="flex shrink-0 items-center gap-3 text-zinc-400">
                <span>
                  {movie.completedSceneJobs}
                  {movie.totalScenes !== undefined ? ` / ${movie.totalScenes} scenes rendered` : " scenes rendered"}
                </span>
                <Badge variant="warning" className="!px-2 !py-0.5 text-[10px]">
                  {movie.activeSceneJobs} active
                </Badge>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  const isPlaceholder = value === "Not available yet";
  return (
    <Card className="p-3">
      <div className="mb-1 flex items-center gap-1.5 text-zinc-500">
        {icon}
        <span className="text-[10px] uppercase tracking-wider">{label}</span>
      </div>
      <p className={`text-sm font-semibold ${isPlaceholder ? "text-zinc-600" : "text-white"}`}>{value}</p>
    </Card>
  );
}

export default ProductionOverviewPanel;
