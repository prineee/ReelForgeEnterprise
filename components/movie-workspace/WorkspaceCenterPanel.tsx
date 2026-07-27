"use client";

import { useMemo, useState } from "react";
import { LayoutGrid, GanttChartSquare, List, ShieldAlert } from "lucide-react";
import type { Scene, Character, Environment, CameraPlan, EmotionPlan } from "@/services/ai/director/OutputSchema";
import type { MovieTimelinePlan } from "@/services/ai/director-engine/MovieTimelineBuilder";
import type { StoryPlan } from "@/services/ai/director-engine/StoryPlanner";
import type { ContinuityReport } from "@/services/ai/director-engine/SceneContinuityEngine";
import type { MusicPlan } from "@/services/ai/asset-intelligence/MusicPlanner";
import { StoryboardGrid } from "@/components/storyboard/StoryboardGrid";
import { SceneStatusBadge, type SceneStatus } from "@/components/storyboard/SceneStatusBadge";
import { StoryboardFilters, EMPTY_STORYBOARD_FILTERS, ALL, type StoryboardFilterState } from "@/components/storyboard/StoryboardFilters";
import { ContinuityViewer } from "@/components/storyboard/ContinuityViewer";
import { TimelineViewer } from "@/components/timeline/TimelineViewer";
import { WorkspaceTabs } from "./WorkspaceTabs";

const ALL_SCENE_STATUSES: SceneStatus[] = [
  "DRAFTED",
  "QUEUED",
  "WAITING",
  "ASSIGNED",
  "RENDERING",
  "DOWNLOADING",
  "VERIFYING",
  "COMPLETED",
  "FAILED",
  "CANCELLED",
];

export interface RenderJobLookup {
  sceneId?: string;
  status: SceneStatus;
  videoUrl?: string;
}

export interface WorkspaceCenterPanelProps {
  movieId: string;
  scenes: Scene[];
  characters: Character[];
  environments: Environment[];
  cameraPlans: CameraPlan[];
  emotionPlans: EmotionPlan[];
  timeline: MovieTimelinePlan;
  storyPlan: StoryPlan;
  musicPlan: MusicPlan;
  continuity: ContinuityReport;
  transitionNameFor: (transition: string) => string;
  initialJobs: readonly RenderJobLookup[];
}

/**
 * Center panel tabs: Storyboard (Module 3) / Timeline (Module 4, read-only) /
 * Scene List. Owns the one piece of real client interactivity this sprint
 * adds — the "Render" button — which POSTs to the real
 * /api/movie-studio/[movieId]/render route (submitting a genuine
 * RenderJobManager job, Sprint 5), not a simulated action.
 */
export function WorkspaceCenterPanel({
  movieId,
  scenes,
  characters,
  environments,
  cameraPlans,
  emotionPlans,
  timeline,
  storyPlan,
  musicPlan,
  continuity,
  transitionNameFor,
  initialJobs,
}: WorkspaceCenterPanelProps) {
  const [jobs, setJobs] = useState<readonly RenderJobLookup[]>(initialJobs);
  const [renderingSceneIds, setRenderingSceneIds] = useState<Set<string>>(new Set());
  const [filters, setFilters] = useState<StoryboardFilterState>(EMPTY_STORYBOARD_FILTERS);

  function statusFor(sceneId: string): SceneStatus {
    return jobs.find((job) => job.sceneId === sceneId)?.status ?? "DRAFTED";
  }
  function videoUrlFor(sceneId: string): string | undefined {
    return jobs.find((job) => job.sceneId === sceneId)?.videoUrl;
  }

  const cameraPlanById = useMemo(() => new Map(cameraPlans.map((c) => [c.id, c])), [cameraPlans]);

  const filteredScenes = useMemo(
    () =>
      scenes.filter((scene) => {
        if (filters.characterId !== ALL && !scene.characterIds.includes(filters.characterId)) return false;
        if (filters.environmentId !== ALL && scene.environmentId !== filters.environmentId) return false;
        if (filters.status !== ALL && statusFor(scene.id) !== filters.status) return false;
        const cameraPlan = cameraPlanById.get(scene.cameraPlanId);
        if (filters.shot !== ALL && cameraPlan?.shot !== filters.shot) return false;
        if (filters.movement !== ALL && cameraPlan?.movement !== filters.movement) return false;
        return true;
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [scenes, filters, cameraPlanById, jobs]
  );

  async function handleRenderScene(sceneId: string) {
    setRenderingSceneIds((prev) => new Set(prev).add(sceneId));
    try {
      const res = await fetch(`/api/movie-studio/${movieId}/render`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sceneId }),
      });
      if (res.ok) {
        setJobs((prev) => [...prev.filter((j) => j.sceneId !== sceneId), { sceneId, status: "QUEUED" as SceneStatus }]);
      }
    } finally {
      setRenderingSceneIds((prev) => {
        const next = new Set(prev);
        next.delete(sceneId);
        return next;
      });
    }
  }

  return (
    <WorkspaceTabs
      className="h-full"
      tabs={[
        {
          id: "storyboard",
          label: "Storyboard",
          icon: <LayoutGrid className="h-3.5 w-3.5" />,
          content: (
            <>
              <StoryboardFilters
                characters={characters}
                environments={environments}
                statuses={ALL_SCENE_STATUSES}
                value={filters}
                onChange={setFilters}
              />
              <StoryboardGrid
                scenes={filteredScenes}
                characters={characters}
                environments={environments}
                cameraPlans={cameraPlans}
                emotionPlans={emotionPlans}
                transitionNameFor={transitionNameFor}
                statusFor={statusFor}
                videoUrlFor={videoUrlFor}
                onRenderScene={handleRenderScene}
                renderingSceneIds={renderingSceneIds}
              />
            </>
          ),
        },
        {
          id: "timeline",
          label: "Timeline",
          icon: <GanttChartSquare className="h-3.5 w-3.5" />,
          content: (
            <TimelineViewer
              timeline={timeline}
              storyPlan={storyPlan}
              musicPlan={musicPlan}
              scenes={scenes}
              cameraPlans={cameraPlans}
              transitionNameFor={transitionNameFor}
            />
          ),
        },
        {
          id: "list",
          label: "Scene List",
          icon: <List className="h-3.5 w-3.5" />,
          content: (
            <div className="overflow-hidden rounded-xl border border-white/10">
              <table className="w-full text-left text-xs">
                <thead className="bg-white/5 text-zinc-400">
                  <tr>
                    <th className="px-3 py-2">#</th>
                    <th className="px-3 py-2">Title</th>
                    <th className="px-3 py-2">Duration</th>
                    <th className="px-3 py-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {[...scenes]
                    .sort((a, b) => a.sceneNumber - b.sceneNumber)
                    .map((scene) => (
                      <tr key={scene.id} className="border-t border-white/5">
                        <td className="px-3 py-2 text-zinc-500">{scene.sceneNumber}</td>
                        <td className="px-3 py-2 text-white">{scene.title ?? `Scene ${scene.sceneNumber}`}</td>
                        <td className="px-3 py-2 text-zinc-400">{scene.durationSeconds ?? 8}s</td>
                        <td className="px-3 py-2">
                          <SceneStatusBadge status={statusFor(scene.id)} />
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          ),
        },
        {
          id: "continuity",
          label: "Continuity",
          icon: <ShieldAlert className="h-3.5 w-3.5" />,
          content: <ContinuityViewer report={continuity} />,
        },
      ]}
    />
  );
}

export default WorkspaceCenterPanel;
