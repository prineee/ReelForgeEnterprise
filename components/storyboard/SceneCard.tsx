"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Camera,
  Clapperboard,
  ChevronDown,
  ChevronUp,
  ArrowUp,
  ArrowDown,
  Users,
  MapPin,
  Smile,
  ArrowRightLeft,
  Play,
  Loader2,
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
  canMoveUp?: boolean;
  canMoveDown?: boolean;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  onRender?: () => void;
  rendering?: boolean;
}

/**
 * Every field this card shows comes from the real MovieBlueprint
 * (services/ai/director/OutputSchema.ts) already produced by the existing
 * director pipeline, plus (for `status`/`videoUrl`) a real RenderJob when
 * one exists (services/rendering/jobs/RenderJobManager.ts). Reordering is
 * a client-side display convenience only (see WORKSPACE'S
 * "Storyboard Reorder" note) — Scene.sceneNumber is never mutated, so
 * this never claims to persist anything the backend doesn't actually
 * store.
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
  canMoveUp,
  canMoveDown,
  onMoveUp,
  onMoveDown,
  onRender,
  rendering,
}: SceneCardProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <Card className="overflow-hidden">
      <div className="flex gap-4 p-4">
        {/* Thumbnail placeholder — no real per-scene thumbnail exists anywhere in the backend; a completed render's real video is linked below instead of faking a poster image. */}
        <div className="relative flex h-24 w-40 shrink-0 flex-col items-center justify-center rounded-xl bg-gradient-to-br from-brand-900/60 to-purple-950/60 border border-white/10">
          <Clapperboard className="h-6 w-6 text-white/30" />
          <span className="mt-1 text-xs font-bold text-white/40">Scene {scene.sceneNumber}</span>
          {videoUrl && (
            <a
              href={videoUrl}
              target="_blank"
              rel="noreferrer"
              className="absolute inset-0 flex items-center justify-center rounded-xl bg-black/50 opacity-0 transition-opacity hover:opacity-100"
              title="Open rendered video"
            >
              <Play className="h-8 w-8 text-white" />
            </a>
          )}
        </div>

        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <Link
                href={`?scene=${scene.id}`}
                scroll={false}
                className="truncate text-sm font-semibold text-white hover:text-brand-300 hover:underline"
                title="View scene properties in the right sidebar"
              >
                {scene.title ?? `Scene ${scene.sceneNumber}`}
              </Link>
              <p className="line-clamp-1 text-xs text-zinc-400">{scene.description}</p>
            </div>
            <SceneStatusBadge status={status} />
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-zinc-400">
            <span className="inline-flex items-center gap-1">
              <Clapperboard className="h-3.5 w-3.5" /> {scene.durationSeconds ?? cameraPlan?.durationSeconds ?? 8}s
            </span>
            {cameraPlan && (
              <span className="inline-flex items-center gap-1">
                <Camera className="h-3.5 w-3.5" /> {humanize(cameraPlan.shot)}
              </span>
            )}
            <span className="inline-flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5" /> {locationName}
            </span>
            <span className="inline-flex items-center gap-1">
              <Users className="h-3.5 w-3.5" /> {characterNames.join(", ") || "—"}
            </span>
            {emotionPlan && (
              <span className="inline-flex items-center gap-1">
                <Smile className="h-3.5 w-3.5" /> {humanize(emotionPlan.dominantEmotion)}
              </span>
            )}
            {transitionName && (
              <span className="inline-flex items-center gap-1">
                <ArrowRightLeft className="h-3.5 w-3.5" /> {transitionName}
              </span>
            )}
          </div>
        </div>

        <div className="flex shrink-0 flex-col items-end justify-between">
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={onMoveUp}
              disabled={!canMoveUp}
              className="rounded-lg border border-white/10 p-1 text-zinc-400 hover:bg-white/5 disabled:opacity-30"
              aria-label="Move scene up"
            >
              <ArrowUp className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={onMoveDown}
              disabled={!canMoveDown}
              className="rounded-lg border border-white/10 p-1 text-zinc-400 hover:bg-white/5 disabled:opacity-30"
              aria-label="Move scene down"
            >
              <ArrowDown className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="rounded-lg border border-white/10 p-1 text-zinc-400 hover:bg-white/5"
              aria-label={expanded ? "Collapse scene" : "Expand scene"}
            >
              {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            </button>
          </div>

          {onRender && (
            <Button
              variant="outline"
              size="sm"
              onClick={onRender}
              disabled={rendering || status === "RENDERING" || status === "QUEUED"}
              className="mt-2"
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
