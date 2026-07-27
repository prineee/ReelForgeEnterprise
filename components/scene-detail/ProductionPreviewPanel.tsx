import { AlertTriangle, Cpu, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { ProductionPreviewData } from "@/services/infrastructure/SceneStudioFactory";

export interface ProductionPreviewPanelProps {
  preview: ProductionPreviewData;
}

/**
 * Module 8 — reuses MovieProducer's already-computed MovieProductionPlan
 * (Sprint 10, via MovieProducerFactory.buildMovieProductionPlan()):
 * Selected Provider Preview is ProductionPlanner's own read-only
 * ProviderSelector.select() result, Quality Score and Continuity Status
 * are QualityAnalyzer's real score/issues. Nothing is recomputed here,
 * and no render job is ever submitted from this panel. Estimated
 * Credits/Render Time are disclosed as "Not planned yet" — Scene.
 * estimatedRenderCost/estimatedRenderTime exist on the type but
 * CostOptimizer.estimateCost() throws "not implemented yet" upstream, so
 * nothing populates them; a guessed number would be a fabrication this
 * module explicitly forbids.
 */
export function ProductionPreviewPanel({ preview }: ProductionPreviewPanelProps) {
  const { recommendedProvider, estimatedCredits, estimatedRenderTimeSeconds, qualityScore, continuityIssues } = preview;

  return (
    <div className="space-y-3 text-xs">
      <Row label="Selected Provider Preview" value={recommendedProvider ?? "Not planned yet"} icon={<Cpu className="h-3 w-3" />} />
      <Row label="Estimated Credits" value={estimatedCredits !== undefined ? `${estimatedCredits} credits` : "Not planned yet"} />
      <Row label="Estimated Render Time" value={estimatedRenderTimeSeconds !== undefined ? `${estimatedRenderTimeSeconds}s` : "Not planned yet"} />
      <Row label="Quality Score" value={qualityScore !== undefined ? `${qualityScore}/100` : "Not planned yet"} />

      <div>
        <p className="mb-1.5 border-b border-white/5 pb-1 text-zinc-500">Continuity Status</p>
        {continuityIssues.length === 0 ? (
          <p className="flex items-center gap-1.5 text-emerald-400">
            <ShieldCheck className="h-3.5 w-3.5" /> No continuity issues flagged for this scene.
          </p>
        ) : (
          <ul className="space-y-1.5">
            {continuityIssues.map((issue, i) => (
              <li key={i} className="flex items-start gap-1.5 text-zinc-400">
                <AlertTriangle className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${issue.severity === "ERROR" ? "text-red-400" : "text-amber-400"}`} />
                {issue.message}
              </li>
            ))}
          </ul>
        )}
      </div>

      <p className="pt-1 text-[10px] text-zinc-600">This is a preview only — no render job has been submitted.</p>
    </div>
  );
}

function Row({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  const isPlaceholder = value === "Not planned yet";
  return (
    <div className="flex items-center justify-between gap-3 border-b border-white/5 py-1">
      <span className="inline-flex items-center gap-1.5 text-zinc-500">
        {icon}
        {label}
      </span>
      {isPlaceholder ? (
        <Badge variant="secondary" className="!px-2 !py-0.5 text-[10px]">
          {value}
        </Badge>
      ) : (
        <span className="text-right text-zinc-300">{value}</span>
      )}
    </div>
  );
}

export default ProductionPreviewPanel;
