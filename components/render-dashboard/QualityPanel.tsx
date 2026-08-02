import Link from "next/link";
import { ShieldCheck, Sparkles } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/EmptyState";
import type { QualityPanelData } from "@/services/infrastructure/RenderCenterFactory";

export interface QualityPanelProps {
  panels: QualityPanelData[];
}

const VERDICT_VARIANT: Record<string, "success" | "warning" | "danger"> = {
  READY: "success",
  NEEDS_REVISION: "warning",
  NOT_READY: "danger",
};

/**
 * Module 7 — Production Quality Score reuses QualityAnalyzer's real
 * QualityReport.score (via MovieProducer, Sprint 10), never recomputed.
 * QualityReport has no native standalone continuity score, so
 * Continuity Score is derived here by RenderCenterFactory using the
 * exact same penalty model QualityAnalyzer applies internally
 * (100 - 15/issue for ERROR, -5 for WARNING), restricted to
 * CONTINUITY-type issues only — a real, transparent sub-score, not a
 * separately-stored field. Estimated Movie Quality is MovieReviewGenerator's
 * real review.verdict (READY/NEEDS_REVISION/NOT_READY).
 */
export function QualityPanel({ panels }: QualityPanelProps) {
  return (
    <div className="space-y-3">
      <h2 className="text-sm font-semibold text-white">Quality Panel</h2>

      {panels.length === 0 ? (
        <EmptyState icon={<Sparkles className="h-6 w-6" />} title="No quality data yet" description="Quality scores appear here once a movie in progress has completed Story Planning." />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {panels.map((panel) => (
            <Card key={panel.movieId} className="space-y-2 p-3 text-xs">
              <div className="flex items-center justify-between">
                <Link href={`/movie-studio/workspace/${panel.movieId}`} className="min-w-0 truncate font-semibold text-white hover:text-brand-300 hover:underline">
                  {panel.movieTitle}
                </Link>
                <Badge variant={VERDICT_VARIANT[panel.estimatedMovieQuality] ?? "secondary"} className="!px-2 !py-0.5 text-[10px]">
                  {humanize(panel.estimatedMovieQuality)}
                </Badge>
              </div>
              <Row label="Production Quality Score" value={`${panel.productionQualityScore}/100`} />
              <Row
                label="Continuity Score"
                value={`${panel.continuityScore}/100${panel.continuityIssueCount > 0 ? ` (${panel.continuityIssueCount} issue${panel.continuityIssueCount === 1 ? "" : "s"})` : ""}`}
                icon={panel.continuityIssueCount === 0 ? <ShieldCheck className="h-3 w-3 text-emerald-400" /> : undefined}
              />
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function Row({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 text-zinc-400">
      <span>{label}</span>
      <span className="inline-flex items-center gap-1 text-zinc-300">
        {value}
        {icon}
      </span>
    </div>
  );
}

function humanize(value: string): string {
  return value.toLowerCase().replace(/_/g, " ");
}

export default QualityPanel;
