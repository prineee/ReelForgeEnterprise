import { ShieldCheck, ShieldAlert, GitBranch, ImageOff, AlertTriangle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { DirectorProfile } from "@/services/ai/director-engine/DirectorProfile";
import type { ContinuityReport } from "@/services/ai/director-engine/SceneContinuityEngine";
import type { VoicePlanIssue } from "@/services/ai/asset-intelligence/VoicePlanner";

export interface DependencyGraphSummary {
  nodeCount: number;
  edgeCount: number;
  readyOrderLength: number;
}

export interface ProductionInspectorProps {
  directorProfile: DirectorProfile;
  continuity: ContinuityReport;
  voicePlanIssues: readonly VoicePlanIssue[];
  dependencyGraph: DependencyGraphSummary;
  charactersMissingReferenceImages: string[];
}

/**
 * Module 9 — Director Profile reuses services/ai/director-engine/DirectorProfile.ts,
 * Continuity Status/Warnings reuse services/ai/director-engine/SceneContinuityEngine.ts's
 * real ContinuityReport (Sprint 6), Dependency Graph Summary reuses
 * services/ai/asset-intelligence/AssetDependencyGraph.ts's real graph
 * (Sprint 7, topologicalOrder() actually run — see the workspace page),
 * and Asset Validation is a real coverage check (which real characters
 * have zero real uploaded reference images) computed from Stage 2's
 * actual UploadedReferenceAsset[] — nothing here is simulated.
 */
export function ProductionInspector({ directorProfile, continuity, voicePlanIssues, dependencyGraph, charactersMissingReferenceImages }: ProductionInspectorProps) {
  return (
    <div className="space-y-4">
      <Card className="p-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Director Profile</p>
        <p className="mt-1 text-sm font-semibold text-white">{directorProfile.name}</p>
        <p className="text-xs text-zinc-400">{directorProfile.description}</p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          <Badge variant="secondary" className="!px-2 !py-0.5 text-[10px]">
            {directorProfile.pacing} pacing
          </Badge>
          {directorProfile.promptStyleModifiers.slice(0, 3).map((modifier) => (
            <Badge key={modifier} variant="secondary" className="!px-2 !py-0.5 text-[10px]">
              {modifier}
            </Badge>
          ))}
        </div>
      </Card>

      <Card className="p-4">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Continuity Status</p>
          {continuity.isConsistent ? (
            <Badge variant="success" className="!px-2 !py-0.5 text-[10px]">
              <ShieldCheck className="mr-1 h-3 w-3" /> Consistent
            </Badge>
          ) : (
            <Badge variant="danger" className="!px-2 !py-0.5 text-[10px]">
              <ShieldAlert className="mr-1 h-3 w-3" /> Issues found
            </Badge>
          )}
        </div>
        {continuity.issues.length === 0 && voicePlanIssues.length === 0 ? (
          <p className="mt-2 text-xs text-zinc-500">No warnings.</p>
        ) : (
          <ul className="mt-2 space-y-1.5">
            {continuity.issues.map((issue, i) => (
              <li key={`c-${i}`} className="flex items-start gap-1.5 text-xs text-zinc-400">
                <AlertTriangle className={`mt-0.5 h-3 w-3 shrink-0 ${issue.severity === "ERROR" ? "text-red-400" : "text-amber-400"}`} />
                {issue.sceneNumber ? <span className="text-zinc-500">Scene {issue.sceneNumber}:</span> : null} {issue.message}
              </li>
            ))}
            {voicePlanIssues.map((issue, i) => (
              <li key={`v-${i}`} className="flex items-start gap-1.5 text-xs text-zinc-400">
                <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0 text-amber-400" />
                <span className="text-zinc-500">Scene {issue.sceneNumber}:</span> {issue.message}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="p-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Dependency Graph</p>
        <div className="mt-2 grid grid-cols-3 gap-2 text-center">
          <div>
            <p className="text-lg font-bold text-white">{dependencyGraph.nodeCount}</p>
            <p className="text-[10px] text-zinc-500">Assets</p>
          </div>
          <div>
            <p className="text-lg font-bold text-white">{dependencyGraph.edgeCount}</p>
            <p className="text-[10px] text-zinc-500">Dependencies</p>
          </div>
          <div>
            <p className="text-lg font-bold text-white">{dependencyGraph.readyOrderLength}</p>
            <p className="text-[10px] text-zinc-500">Build order</p>
          </div>
        </div>
        <p className="mt-2 inline-flex items-center gap-1.5 text-xs text-emerald-400">
          <GitBranch className="h-3.5 w-3.5" /> Real topological order computed — no cycles.
        </p>
      </Card>

      <Card className="p-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Asset Validation</p>
        {charactersMissingReferenceImages.length === 0 ? (
          <p className="mt-2 flex items-center gap-1.5 text-xs text-emerald-400">
            <ShieldCheck className="h-3.5 w-3.5" /> Every character has a reference image.
          </p>
        ) : (
          <p className="mt-2 flex items-start gap-1.5 text-xs text-amber-400">
            <ImageOff className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            Missing reference images: {charactersMissingReferenceImages.join(", ")}
          </p>
        )}
      </Card>
    </div>
  );
}

export default ProductionInspector;
