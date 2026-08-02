import { AlertTriangle, Clapperboard, Coins, Compass, Film, Music2, ShieldCheck, Sparkles, Timer, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { CameraPlan, EmotionPlan, Environment, Scene } from "@/services/ai/director/OutputSchema";
import type { ContinuityIssue } from "@/services/ai/director-engine/SceneContinuityEngine";
import type { DirectorProfile } from "@/services/ai/director-engine/DirectorProfile";
import type { PlannedMusicCue } from "@/services/ai/asset-intelligence/MusicPlanner";
import type { ShotPreset } from "@/services/ai/asset-intelligence/ShotLibrary";
import type { TransitionPreset } from "@/services/ai/asset-intelligence/TransitionLibrary";

export interface SceneDetailPanelProps {
  scene: Scene;
  cameraPlan?: CameraPlan;
  emotionPlan?: EmotionPlan;
  environment?: Environment;
  characterNames: string[];
  /** Full movie continuity report — filtered to this scene's sceneNumber internally. */
  continuityIssues: readonly ContinuityIssue[];
  musicCue?: PlannedMusicCue;
  shotPreset?: ShotPreset;
  transitionPreset?: TransitionPreset;
  directorProfile: DirectorProfile;
  /** This scene's positivePrompt from DirectorPromptPipeline's real output, when available. */
  promptSummary?: string;
}

/**
 * Module 2 (Scene Detail) + Module 7 (Director Notes) — every field reads
 * from data the existing pipeline already produced (AIDirectorEngine +
 * AssetManager, wired in app/movie-studio/workspace/[movieId]/page.tsx).
 * Estimated render cost/time show "Not available yet" rather than a
 * fabricated number — CostOptimizer.estimateCost()/calculateCost() both
 * currently throw "not implemented" (services/rendering/CostOptimizer.ts),
 * so Scene.estimatedRenderCost/estimatedRenderTime are honestly read as
 * optional fields that nothing populates today.
 */
export function SceneDetailPanel({
  scene,
  cameraPlan,
  emotionPlan,
  environment,
  characterNames,
  continuityIssues,
  musicCue,
  shotPreset,
  transitionPreset,
  directorProfile,
  promptSummary,
}: SceneDetailPanelProps) {
  const sceneIssues = continuityIssues.filter((issue) => issue.sceneNumber === scene.sceneNumber);

  return (
    <div className="space-y-4 text-xs">
      <div>
        <p className="text-sm font-semibold text-white">{scene.title ?? `Scene ${scene.sceneNumber}`}</p>
        <p className="mt-1 text-zinc-400">{scene.description}</p>
      </div>

      <Section title="Scene">
        <Row label="Duration" value={`${scene.durationSeconds ?? cameraPlan?.durationSeconds ?? 8}s`} />
        <Row label="Location" value={environment?.name ?? scene.environmentId} />
        <Row icon={<Users className="h-3 w-3" />} label="Characters" value={characterNames.join(", ") || "—"} />
      </Section>

      <Section title="Continuity Summary">
        {sceneIssues.length === 0 ? (
          <p className="flex items-center gap-1.5 text-emerald-400">
            <ShieldCheck className="h-3.5 w-3.5" /> No continuity issues flagged for this scene.
          </p>
        ) : (
          <ul className="space-y-1.5">
            {sceneIssues.map((issue, i) => (
              <li key={i} className="flex items-start gap-1.5 text-zinc-400">
                <AlertTriangle className={`mt-0.5 h-3 w-3 shrink-0 ${issue.severity === "ERROR" ? "text-red-400" : "text-amber-400"}`} />
                {issue.message}
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Assets Used">
        <Row icon={<Film className="h-3 w-3" />} label="Shot preset" value={shotPreset?.name ?? "—"} />
        <Row icon={<Compass className="h-3 w-3" />} label="Transition" value={transitionPreset?.name ?? "—"} />
        <Row icon={<Music2 className="h-3 w-3" />} label="Music cue" value={musicCue?.cue.moodTags?.join(", ") ?? musicCue?.cue.style ?? "—"} />
      </Section>

      <Section title="Estimated Render">
        <Row icon={<Coins className="h-3 w-3" />} label="Cost" value={scene.estimatedRenderCost !== undefined ? `${scene.estimatedRenderCost} credits` : "Not available yet"} />
        <Row icon={<Timer className="h-3 w-3" />} label="Time" value={scene.estimatedRenderTime !== undefined ? `${scene.estimatedRenderTime}s` : "Not available yet"} />
      </Section>

      <Section title="Director Notes">
        <div className="mb-2 flex items-center justify-between">
          <p className="font-semibold text-white">{directorProfile.name}</p>
          <Badge variant="secondary" className="!px-2 !py-0.5 text-[10px]">
            {directorProfile.pacing} pacing
          </Badge>
        </div>
        {cameraPlan && (
          <>
            <Row icon={<Clapperboard className="h-3 w-3" />} label="Camera style" value={`${humanize(cameraPlan.shot)}${cameraPlan.movement ? `, ${humanize(cameraPlan.movement)}` : ""}, ${cameraPlan.angle}° · ${humanize(cameraPlan.cameraHeight)}`} />
            <p className="mt-1.5">
              <span className="text-zinc-500">Cinematic notes:</span> {cameraPlan.cinematicPurpose}
            </p>
          </>
        )}
        {emotionPlan && (
          <p className="mt-1.5">
            <span className="text-zinc-500">Pacing notes:</span> {emotionPlan.pacingNotes}
          </p>
        )}
        <div className="mt-2">
          <p className="mb-1 inline-flex items-center gap-1 text-zinc-500">
            <Sparkles className="h-3 w-3" /> Prompt summary
          </p>
          <p className="max-h-24 overflow-y-auto rounded-lg border border-white/10 bg-white/[0.02] p-2 text-zinc-400">
            {promptSummary ?? "Not generated yet — available once this scene reaches Scene Prompt Building."}
          </p>
        </div>
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">{title}</p>
      {children}
    </div>
  );
}

function Row({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-white/5 py-1">
      <span className="inline-flex items-center gap-1.5 text-zinc-500">
        {icon}
        {label}
      </span>
      <span className="text-right text-zinc-300">{value}</span>
    </div>
  );
}

function humanize(value: string): string {
  return value.toLowerCase().replace(/_/g, " ");
}

export default SceneDetailPanel;
