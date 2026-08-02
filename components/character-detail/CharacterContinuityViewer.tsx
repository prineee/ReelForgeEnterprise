import { AlertTriangle, CheckCircle2, ShieldQuestion } from "lucide-react";
import type { CharacterContinuitySummary } from "@/services/infrastructure/CharacterStudioFactory";

export interface CharacterContinuityViewerProps {
  continuity?: CharacterContinuitySummary;
}

/**
 * Module 4 — real per-scene appearances read directly from Scene.characterIds
 * and real CHARACTER_GAP issues from SceneContinuityEngine's ContinuityReport
 * (via CharacterStudioFactory.getCharacterContinuity()). CharacterMemory's
 * own appearance log is not read here — it is only ever populated on
 * AIDirectorEngine's private internal instance, never on the
 * AssetManager-owned CharacterLibrary this feature has access to, so it is
 * honestly empty in every wired code path (confirmed by inspection). No
 * duplicate tracking is added to work around that; scene presence is
 * derived from data that already exists on MovieBlueprint.scenes instead.
 * Costume/voice-change detection doesn't exist anywhere in the codebase —
 * disclosed below rather than fabricated, matching
 * components/storyboard/ContinuityViewer.tsx's established pattern.
 */
export function CharacterContinuityViewer({ continuity }: CharacterContinuityViewerProps) {
  if (!continuity) {
    return <p className="text-xs text-zinc-500">No production data available for this character yet.</p>;
  }

  return (
    <div className="space-y-4 text-xs">
      <div>
        <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Appearances in {continuity.movieTitle}</p>
        {continuity.appearances.length === 0 ? (
          <p className="text-zinc-500">Not featured in any scene yet.</p>
        ) : (
          <ul className="space-y-1">
            {continuity.appearances.map((appearance) => (
              <li key={appearance.sceneId} className="flex items-center gap-1.5 text-zinc-300">
                <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
                Appears in Scene {appearance.sceneNumber}
                {appearance.sceneTitle ? ` — ${appearance.sceneTitle}` : ""}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Continuity Issues</p>
        {continuity.issues.length === 0 ? (
          <p className="text-zinc-500">No continuity issues for this character.</p>
        ) : (
          <ul className="space-y-1.5">
            {continuity.issues.map((issue, i) => (
              <li key={i} className="flex items-start gap-1.5 text-zinc-400">
                <AlertTriangle className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${issue.severity === "ERROR" ? "text-red-400" : "text-amber-400"}`} />
                {issue.message}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="rounded-lg border border-dashed border-white/10 p-3 text-zinc-500">
        <p className="mb-1 inline-flex items-center gap-1.5 font-semibold text-zinc-400">
          <ShieldQuestion className="h-3.5 w-3.5" /> Not yet checked by the Continuity Engine
        </p>
        <ul className="list-inside list-disc space-y-0.5">
          <li>Costume changed between scenes</li>
          <li>Voice changed between scenes</li>
        </ul>
      </div>
    </div>
  );
}

export default CharacterContinuityViewer;
