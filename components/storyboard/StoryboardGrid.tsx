"use client";

import { useState } from "react";
import type { Scene, Character, Environment, CameraPlan, EmotionPlan } from "@/services/ai/director/OutputSchema";
import { EmptyState } from "@/components/ui/EmptyState";
import { Clapperboard } from "lucide-react";
import { SceneCard } from "./SceneCard";
import type { SceneStatus } from "./SceneStatusBadge";

export interface StoryboardGridProps {
  scenes: Scene[];
  characters: Character[];
  environments: Environment[];
  cameraPlans: CameraPlan[];
  emotionPlans: EmotionPlan[];
  transitionNameFor: (transition: string) => string;
  statusFor: (sceneId: string) => SceneStatus;
  videoUrlFor: (sceneId: string) => string | undefined;
  onRenderScene?: (sceneId: string) => void;
  renderingSceneIds?: ReadonlySet<string>;
  onSelectScene?: (sceneId: string) => void;
  selectedSceneId?: string;
}

/**
 * Reordering here is a client-side display convenience only — it never
 * calls any API and Scene.sceneNumber (the real, backend-authoritative
 * order) is never mutated. Everything else rendered is real data resolved
 * from the MovieBlueprint already produced by the existing director
 * pipeline (services/ai/director/).
 */
export function StoryboardGrid({
  scenes,
  characters,
  environments,
  cameraPlans,
  emotionPlans,
  transitionNameFor,
  statusFor,
  videoUrlFor,
  onRenderScene,
  renderingSceneIds,
  onSelectScene,
  selectedSceneId,
}: StoryboardGridProps) {
  const [order, setOrder] = useState<string[]>(() => [...scenes].sort((a, b) => a.sceneNumber - b.sceneNumber).map((s) => s.id));
  const [draggedId, setDraggedId] = useState<string | null>(null);

  if (scenes.length === 0) {
    return (
      <EmptyState
        icon={<Clapperboard className="h-7 w-7" />}
        title="No storyboard available"
        description="This movie hasn't reached Scene Planning yet — scenes will appear here once the director pipeline drafts them."
      />
    );
  }

  const sceneById = new Map(scenes.map((s) => [s.id, s]));
  const characterById = new Map(characters.map((c) => [c.id, c]));
  const environmentById = new Map(environments.map((e) => [e.id, e]));
  const cameraPlanById = new Map(cameraPlans.map((c) => [c.id, c]));
  const emotionPlanById = new Map(emotionPlans.map((e) => [e.id, e]));

  function handleDrop(targetSceneId: string) {
    setOrder((current) => {
      if (!draggedId || draggedId === targetSceneId) return current;
      const from = current.indexOf(draggedId);
      const to = current.indexOf(targetSceneId);
      if (from === -1 || to === -1) return current;
      const next = [...current];
      next.splice(from, 1);
      next.splice(to, 0, draggedId);
      return next;
    });
    setDraggedId(null);
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {order.map((sceneId, index) => {
        const scene = sceneById.get(sceneId);
        if (!scene) return null;
        const environment = environmentById.get(scene.environmentId);
        const cameraPlan = cameraPlanById.get(scene.cameraPlanId);
        const emotionPlan = emotionPlanById.get(scene.emotionPlanId);

        return (
          <div
            key={sceneId}
            onDragOver={(event) => event.preventDefault()}
            onDrop={() => handleDrop(sceneId)}
          >
            <SceneCard
              scene={scene}
              cameraPlan={cameraPlan}
              emotionPlan={emotionPlan}
              transitionName={cameraPlan ? transitionNameFor(cameraPlan.transitionToNext) : undefined}
              characterNames={scene.characterIds.map((id) => characterById.get(id)?.name ?? id)}
              locationName={environment?.name ?? scene.environmentId}
              status={statusFor(scene.id)}
              videoUrl={videoUrlFor(scene.id)}
              position={index + 1}
              isDragging={draggedId === sceneId}
              isSelected={selectedSceneId === scene.id}
              onDragHandleStart={() => setDraggedId(sceneId)}
              onDragEnd={() => setDraggedId(null)}
              onSelect={onSelectScene ? () => onSelectScene(scene.id) : undefined}
              onRender={onRenderScene ? () => onRenderScene(scene.id) : undefined}
              rendering={renderingSceneIds?.has(scene.id)}
            />
          </div>
        );
      })}
    </div>
  );
}

export default StoryboardGrid;
