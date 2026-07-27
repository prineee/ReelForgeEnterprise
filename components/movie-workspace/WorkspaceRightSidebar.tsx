import { Info, Sparkles, Cpu } from "lucide-react";
import type { Scene, CameraPlan, EmotionPlan, Environment } from "@/services/ai/director/OutputSchema";
import type { DirectorProfile } from "@/services/ai/director-engine/DirectorProfile";
import { WorkspaceTabs } from "./WorkspaceTabs";

export interface SelectedSceneDetail {
  scene: Scene;
  cameraPlan?: CameraPlan;
  emotionPlan?: EmotionPlan;
  environment?: Environment;
  characterNames: string[];
}

export interface WorkspaceRightSidebarProps {
  selectedScene?: SelectedSceneDetail;
  directorProfile: DirectorProfile;
  /** Read server-side from process.env.VIDEO_PROVIDER (services/rendering/ProviderSelector.ts's real selection input) — never guessed. */
  activeVideoProvider: string;
}

/** Right sidebar tabs: Scene Properties/Director Settings/Render Settings (Module 2). Server-rendered — no client state needed beyond WorkspaceTabs' own tab switching. */
export function WorkspaceRightSidebar({ selectedScene, directorProfile, activeVideoProvider }: WorkspaceRightSidebarProps) {
  return (
    <WorkspaceTabs
      tabs={[
        {
          id: "scene",
          label: "Scene",
          icon: <Info className="h-3.5 w-3.5" />,
          content: selectedScene ? (
            <div className="space-y-3 text-xs">
              <div>
                <p className="text-sm font-semibold text-white">{selectedScene.scene.title ?? `Scene ${selectedScene.scene.sceneNumber}`}</p>
                <p className="mt-1 text-zinc-400">{selectedScene.scene.description}</p>
              </div>
              <Row label="Duration" value={`${selectedScene.scene.durationSeconds ?? selectedScene.cameraPlan?.durationSeconds ?? 8}s`} />
              <Row label="Location" value={selectedScene.environment?.name ?? selectedScene.scene.environmentId} />
              <Row label="Characters" value={selectedScene.characterNames.join(", ") || "—"} />
              {selectedScene.cameraPlan && (
                <>
                  <Row label="Shot" value={humanize(selectedScene.cameraPlan.shot)} />
                  <Row label="Movement" value={selectedScene.cameraPlan.movement ? humanize(selectedScene.cameraPlan.movement) : "—"} />
                  <Row label="Lens" value={selectedScene.cameraPlan.lens} />
                  <Row label="Transition" value={humanize(selectedScene.cameraPlan.transitionToNext)} />
                </>
              )}
              {selectedScene.emotionPlan && (
                <>
                  <Row label="Emotion" value={`${humanize(selectedScene.emotionPlan.dominantEmotion)} (${selectedScene.emotionPlan.intensity}/10)`} />
                  <Row label="Pacing" value={selectedScene.emotionPlan.pacingNotes} />
                </>
              )}
            </div>
          ) : (
            <p className="text-xs text-zinc-500">Click a scene title in the Storyboard to inspect its real properties here.</p>
          ),
        },
        {
          id: "director",
          label: "Director",
          icon: <Sparkles className="h-3.5 w-3.5" />,
          content: (
            <div className="space-y-3 text-xs">
              <div>
                <p className="text-sm font-semibold text-white">{directorProfile.name}</p>
                <p className="mt-1 text-zinc-400">{directorProfile.description}</p>
              </div>
              <Row label="Pacing" value={directorProfile.pacing} />
              <Row label="Style modifiers" value={directorProfile.promptStyleModifiers.join(", ")} />
              <Row label="Negative modifiers" value={directorProfile.negativePromptModifiers.join(", ")} />
              <Row label="Emotional bias" value={directorProfile.emotionalIntensityBias.toString()} />
              <Row label="Duration bias" value={`${directorProfile.sceneDurationBiasSeconds}s`} />
            </div>
          ),
        },
        {
          id: "render",
          label: "Render",
          icon: <Cpu className="h-3.5 w-3.5" />,
          content: (
            <div className="space-y-3 text-xs">
              <Row label="Active provider" value={activeVideoProvider} />
              <p className="text-zinc-500">
                Set by the <code className="rounded bg-white/10 px-1 py-0.5">VIDEO_PROVIDER</code> environment variable — the exact same
                selection services/rendering/decision/RenderDecisionEngine.ts uses everywhere else in the app (LTX, Google, or Local GPU).
              </p>
            </div>
          ),
        },
      ]}
    />
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3 border-b border-white/5 pb-1.5">
      <span className="text-zinc-500">{label}</span>
      <span className="text-right text-zinc-300">{value}</span>
    </div>
  );
}

function humanize(value: string): string {
  return value.toLowerCase().replace(/_/g, " ");
}

export default WorkspaceRightSidebar;
