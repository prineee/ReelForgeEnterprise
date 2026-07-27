import { AlertTriangle, ShieldAlert, ShieldCheck, ShieldQuestion } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { ContinuityIssueType, ContinuityReport } from "@/services/ai/director-engine/SceneContinuityEngine";

export interface ContinuityViewerProps {
  report: ContinuityReport;
}

const CATEGORY_LABEL: Record<ContinuityIssueType, string> = {
  CHARACTER_GAP: "Character disappears",
  ENVIRONMENT_JUMP: "Environment jump",
  TIME_OF_DAY_JUMP: "Time-of-day inconsistency",
  MISSING_CONTINUITY_NOTES: "Missing continuity notes",
};

/**
 * Module 5 — read-only view over SceneContinuityEngine's real ContinuityReport
 * (services/ai/director-engine/SceneContinuityEngine.ts), the same report
 * components/project-inspector/ProductionInspector.tsx already surfaces
 * elsewhere. Costume/weather-mismatch checks are listed separately as not
 * yet implemented by that engine — Character.wardrobe and Environment.weather
 * exist as raw data but nothing currently compares them across scenes; this
 * view doesn't fabricate warnings for them.
 */
export function ContinuityViewer({ report }: ContinuityViewerProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Continuity Status</p>
        {report.isConsistent ? (
          <Badge variant="success" className="!px-2 !py-0.5 text-[10px]">
            <ShieldCheck className="mr-1 h-3 w-3" /> Consistent
          </Badge>
        ) : (
          <Badge variant="danger" className="!px-2 !py-0.5 text-[10px]">
            <ShieldAlert className="mr-1 h-3 w-3" /> Issues found
          </Badge>
        )}
      </div>

      {report.issues.length === 0 ? (
        <p className="text-xs text-zinc-500">No continuity issues detected across this movie's scenes.</p>
      ) : (
        <ul className="space-y-2">
          {report.issues.map((issue, i) => (
            <li key={i} className="flex items-start gap-2 rounded-lg border border-white/10 bg-white/[0.02] p-2.5 text-xs">
              <AlertTriangle className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${issue.severity === "ERROR" ? "text-red-400" : "text-amber-400"}`} />
              <div>
                <p className="font-semibold text-zinc-300">
                  {CATEGORY_LABEL[issue.type]}
                  {issue.sceneNumber ? ` — Scene ${issue.sceneNumber}` : ""}
                </p>
                <p className="mt-0.5 text-zinc-400">{issue.message}</p>
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="rounded-lg border border-dashed border-white/10 p-3 text-xs text-zinc-500">
        <p className="mb-1 inline-flex items-center gap-1.5 font-semibold text-zinc-400">
          <ShieldQuestion className="h-3.5 w-3.5" /> Not yet checked by the Continuity Engine
        </p>
        <ul className="list-inside list-disc space-y-0.5">
          <li>Costume / wardrobe mismatch</li>
          <li>Weather mismatch</li>
        </ul>
      </div>
    </div>
  );
}

export default ContinuityViewer;
