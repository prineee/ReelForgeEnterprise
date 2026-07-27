import { ArrowRightLeft, BookOpen, Compass, Sparkles } from "lucide-react";
import type { SceneOverview } from "@/services/infrastructure/SceneStudioFactory";

export interface SceneOverviewPanelProps {
  overview: SceneOverview;
}

/**
 * Module 2 — read-only. Story Purpose reads StoryPlanner's real per-act
 * purpose (via AIDirectorPlan.storyPlan, already computed — not
 * recomputed here), clearly labeled by act rather than presented as if
 * it were scene-specific data that doesn't exist. Scene Importance has no
 * backing field anywhere on Scene and is disclosed as "Not planned yet"
 * rather than approximated from an unrelated field (e.g. emotional
 * intensity). Prompt Summary here is the short positive-prompt preview —
 * see the Prompt Viewer tab (Module 9) for the full prompt with
 * copy-to-clipboard.
 */
export function SceneOverviewPanel({ overview }: SceneOverviewPanelProps) {
  return (
    <div className="space-y-4 text-xs">
      <div>
        <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Scene Description</p>
        <p className="text-zinc-300">{overview.scene.description || "No description recorded for this scene."}</p>
      </div>

      <Section title="AI Director Notes" icon={<Sparkles className="h-3 w-3" />}>
        <p className="text-zinc-300">{overview.directorNotes ?? "Not available — this scene has no planned camera direction yet."}</p>
      </Section>

      <Section title="Story Purpose" icon={<BookOpen className="h-3 w-3" />}>
        <p className="text-zinc-300">{overview.storyPurpose ?? "Not planned yet — this scene isn't mapped to an act yet."}</p>
      </Section>

      <Section title="Scene Importance" icon={<Compass className="h-3 w-3" />}>
        <p className="text-zinc-500">{overview.sceneImportance ?? "Not planned yet — no scene-importance field exists on Scene today."}</p>
      </Section>

      <Section title="Prompt Summary">
        <p className="max-h-24 overflow-y-auto rounded-lg border border-white/10 bg-white/[0.02] p-2 text-zinc-400">
          {overview.promptSummary ?? "Not generated yet — available once this scene reaches Scene Prompt Building. See the Prompt Viewer tab."}
        </p>
      </Section>

      <Section title="Transitions" icon={<ArrowRightLeft className="h-3 w-3" />}>
        <Row label="Transition In" value={overview.transitionInName ?? "—"} />
        <Row label="Transition Out" value={overview.transitionOutName ?? "—"} />
      </Section>
    </div>
  );
}

function Section({ title, icon, children }: { title: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1.5 inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
        {icon}
        {title}
      </p>
      {children}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-white/5 py-1">
      <span className="text-zinc-500">{label}</span>
      <span className="text-right text-zinc-300">{value}</span>
    </div>
  );
}

export default SceneOverviewPanel;
