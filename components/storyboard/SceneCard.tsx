"use client";

import { useState, type DragEvent } from "react";
import Link from "next/link";
import {
  Camera,
  Clapperboard,
  ChevronDown,
  ChevronUp,
  GripVertical,
  Users,
  MapPin,
  Smile,
  ArrowRightLeft,
  Play,
  Loader2,
  Compass,
  ListOrdered,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Scene, CameraPlan, EmotionPlan } from "@/services/ai/director/OutputSchema";
import { SceneStatusBadge, type SceneStatus } from "./SceneStatusBadge";

export interface SceneCardProps {
  scene: Scene;
  cameraPlan?: CameraPlan;
  emotionPlan?: EmotionPlan;
  transitionName?: string;
  characterNames: string[];
  locationName: string;
  status: SceneStatus;
  videoUrl?: string;
  /** Current display position (1-based) in the storyboard — distinct from the persisted scene.sceneNumber, see note below. */
  position: number;
  isDragging?: boolean;
  isSelected?: boolean;
  onDragHandleStart?: (event: DragEvent<HTMLDivElement>) => void;
  onDragEnd?: () => void;
  /** Fired when the scene title is clicked — used to sync the Timeline tab's highlighted block (Module 6), in addition to the title's own navigation to `?scene=id`. */
  onSelect?: () => void;
  onRender?: () => void;
  rendering?: boolean;
}

/**
 * Every field this card shows comes from the real MovieBlueprint
 * (services/ai/director/OutputSchema.ts) already produced by the existing
 * director pipeline, plus (for `status`/`videoUrl`) a real RenderJob when
 * one exists (services/rendering/jobs/RenderJobManager.ts). Drag-and-drop
 * reordering is a client-side display convenience only — Scene.sceneNumber
 * is never mutated, so this never claims to persist anything the backend
 * doesn't actually store; `position` reflects the current on-screen order
 * only.
 */
export function SceneCard({
  scene,
  cameraPlan,
  emotionPlan,
  transitionName,
  characterNames,
  locationName,
  status,
  videoUrl,
  position,
  isDragging,
  isSelected,
  onDragHandleStart,
  onDragEnd,
  onSelect,
  onRender,
  rendering,
}: SceneCardProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <Card
      className={cn(
        "flex h-full flex-col overflow-hidden transition-opacity",
        isDragging && "opacity-40",
        isSelected && "ring-2 ring-brand-500"
      )}
    >
      {/* Thumbnail placeholder — no real per-scene thumbnail exists anywhere in the backend; a completed render's real video is linked below instead of faking a poster image. */}
      <div className="relative flex aspect-video w-full shrink-0 flex-col items-center justify-center border-b border-white/10 bg-gradient-to-br from-brand-900/60 to-purple-950/60">
        <Clapperboard className="h-7 w-7 text-white/30" />
        <span className="mt-1 text-xs font-bold text-white/40">Scene {scene.sceneNumber}</span>

        <div className="absolute left-2 top-2">
          <SceneStatusBadge status={status} />
        </div>
        <div
          draggable
          onDragStart={onDragHandleStart}
          onDragEnd={onDragEnd}
          className="absolute right-2 top-2 cursor-grab rounded-lg border border-white/10 bg-black/30 p-1 text-zinc-300 hover:bg-black/50 active:cursor-grabbing"
          aria-label="Drag to reorder"
          title="Drag to reorder"
        >
          <GripVertical className="h-3.5 w-3.5" />
        </div>

        {videoUrl && (
          <a
            href={videoUrl}
            target="_blank"
            rel="noreferrer"
            className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 transition-opacity hover:opacity-100"
            title="Open rendered video"
          >
            <Play className="h-8 w-8 text-white" />
          </a>
        )}
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-2 p-4">
        <div className="min-w-0">
          <Link
            href={`?scene=${scene.id}`}
            scroll={false}
            onClick={onSelect}
            className="truncate text-sm font-semibold text-white hover:text-brand-300 hover:underline"
            title="View scene properties in the right sidebar"
          >
            {scene.title ?? `Scene ${scene.sceneNumber}`}
          </Link>
          <p className="line-clamp-2 text-xs text-zinc-400">{scene.description}</p>
        </div>

        <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs text-zinc-400">
          <span className="inline-flex items-center gap-1.5 truncate" title="Current storyboard position (display order only)">
            <ListOrdered className="h-3.5 w-3.5 shrink-0" /> Position {position}
          </span>
          <span className="inline-flex items-center gap-1.5 truncate">
            <Clapperboard className="h-3.5 w-3.5 shrink-0" /> {scene.durationSeconds ?? cameraPlan?.durationSeconds ?? 8}s
          </span>
          {cameraPlan && (
            <span className="inline-flex items-center gap-1.5 truncate">
              <Camera className="h-3.5 w-3.5 shrink-0" /> {humanize(cameraPlan.shot)}
            </span>
          )}
          {cameraPlan && (
            <span className="inline-flex items-center gap-1.5 truncate" title="Camera angle">
              <Compass className="h-3.5 w-3.5 shrink-0" /> {cameraPlan.angle}° · {humanize(cameraPlan.cameraHeight)}
            </span>
          )}
          <span className="inline-flex items-center gap-1.5 truncate">
            <MapPin className="h-3.5 w-3.5 shrink-0" /> {locationName}
          </span>
          {emotionPlan && (
            <span className="inline-flex items-center gap-1.5 truncate">
              <Smile className="h-3.5 w-3.5 shrink-0" /> {humanize(emotionPlan.dominantEmotion)}
            </span>
          )}
          {transitionName && (
            <span className="inline-flex items-center gap-1.5 truncate">
              <ArrowRightLeft className="h-3.5 w-3.5 shrink-0" /> {transitionName}
            </span>
          )}
        </div>

        <span className="inline-flex items-start gap-1.5 text-xs text-zinc-400">
          <Users className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span className="line-clamp-1">{characterNames.join(", ") || "—"}</span>
        </span>

        <div className="mt-auto flex items-center justify-between pt-2">
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="inline-flex items-center gap-1 rounded-lg border border-white/10 px-2 py-1 text-xs text-zinc-400 hover:bg-white/5"
            aria-label={expanded ? "Collapse scene" : "Expand scene"}
          >
            {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            {expanded ? "Less" : "More"}
          </button>

          {onRender && (
            <Button
              variant="outline"
              size="sm"
              onClick={onRender}
              disabled={rendering || status === "RENDERING" || status === "QUEUED"}
            >
              {rendering ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
              <span className="ml-1.5">Render</span>
            </Button>
          )}
        </div>
      </div>

      {expanded && (
        <div className={cn("border-t border-white/10 bg-white/[0.02] px-4 py-3 text-xs text-zinc-400")}>
          {scene.dialogue && scene.dialogue.length > 0 ? (
            <div className="space-y-1">
              <p className="font-semibold text-zinc-300">Dialogue</p>
              {scene.dialogue.map((line, i) => (
                <p key={i}>
                  <span className="text-zinc-500">{line.characterId}:</span> &ldquo;{line.text}&rdquo;
                </p>
              ))}
            </div>
          ) : (
            <p className="italic text-zinc-500">Silent scene — no dialogue.</p>
          )}
          {cameraPlan && (
            <p className="mt-2">
              <span className="text-zinc-500">Cinematic purpose:</span> {cameraPlan.cinematicPurpose}
            </p>
          )}
          {emotionPlan && (
            <p className="mt-1">
              <span className="text-zinc-500">Pacing:</span> {emotionPlan.pacingNotes}
            </p>
          )}
        </div>
      )}
    </Card>
  );
}

function humanize(value: string): string {
  return value.toLowerCase().replace(/_/g, " ");
}

export default SceneCard;
