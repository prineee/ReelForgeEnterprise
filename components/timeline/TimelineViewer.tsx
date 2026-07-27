"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { Film, Mic, Music2, ArrowRightLeft, ZoomIn, ZoomOut } from "lucide-react";
import type { Scene, CameraPlan } from "@/services/ai/director/OutputSchema";
import type { MovieTimelinePlan } from "@/services/ai/director-engine/MovieTimelineBuilder";
import type { StoryPlan } from "@/services/ai/director-engine/StoryPlanner";
import type { MusicPlan } from "@/services/ai/asset-intelligence/MusicPlanner";
import { EmptyState } from "@/components/ui/EmptyState";
import { TimelineRuler } from "./TimelineRuler";
import { TimelineTrack } from "./TimelineTrack";
import { TimelineBlock } from "./TimelineBlock";

export interface TimelineViewerProps {
  timeline: MovieTimelinePlan;
  storyPlan: StoryPlan;
  musicPlan: MusicPlan;
  scenes: Scene[];
  cameraPlans: CameraPlan[];
  transitionNameFor: (transition: string) => string;
  /** Scene selected in the Storyboard tab (Module 6) — highlights and scrolls to the matching Scenes-track block. Read-only, no editing. */
  highlightSceneId?: string;
}

const MIN_PX_PER_SECOND = 2;
const MAX_PX_PER_SECOND = 40;
const DEFAULT_PX_PER_SECOND = 8;

/**
 * Read-only professional timeline. Every block's position/width is
 * derived from real data already computed by the existing pipeline:
 * scene blocks from MovieTimelineBuilder's real cumulative arithmetic
 * (services/ai/director-engine/), music blocks from MusicPlanner's real
 * per-scene cues (services/ai/asset-intelligence/), voice blocks from
 * Scene.dialogue's real presence, transition blocks from each scene's
 * real CameraPlan.transitionToNext, and act markers from StoryPlanner's
 * real StoryPlan.acts — nothing here is estimated or fabricated.
 */
export function TimelineViewer({ timeline, storyPlan, musicPlan, scenes, cameraPlans, transitionNameFor, highlightSceneId }: TimelineViewerProps) {
  const [pixelsPerSecond, setPixelsPerSecond] = useState(DEFAULT_PX_PER_SECOND);
  const [playheadSeconds, setPlayheadSeconds] = useState(0);
  const trackAreaRef = useRef<HTMLDivElement>(null);
  const sceneBlockRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  useEffect(() => {
    if (!highlightSceneId) return;
    sceneBlockRefs.current.get(highlightSceneId)?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  }, [highlightSceneId]);

  const sceneById = useMemo(() => new Map(scenes.map((s) => [s.id, s])), [scenes]);
  const cameraPlanById = useMemo(() => new Map(cameraPlans.map((c) => [c.id, c])), [cameraPlans]);

  if (timeline.entries.length === 0) {
    return (
      <EmptyState
        icon={<Film className="h-7 w-7" />}
        title="No timeline yet"
        description="A pre-production timeline appears here once this movie has sequenced scenes."
      />
    );
  }

  const totalSeconds = Math.max(timeline.totalPlannedDurationSeconds, 1);
  const widthPixels = totalSeconds * pixelsPerSecond;

  const actMarkers = storyPlan.acts.map((act) => {
    const firstEntry = timeline.entries.find((e) => e.actNumber === act.actNumber);
    return { atSeconds: firstEntry?.plannedStartSeconds ?? 0, label: act.name };
  });

  function handleTrackClick(event: React.MouseEvent<HTMLDivElement>) {
    const rect = trackAreaRef.current?.getBoundingClientRect();
    if (!rect) return;
    const offsetX = event.clientX - rect.left - 128; // 128px = track label column width
    setPlayheadSeconds(Math.max(0, Math.min(totalSeconds, offsetX / pixelsPerSecond)));
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-zinc-500">
          Playhead: <span className="font-mono text-zinc-300">{formatTime(playheadSeconds)}</span> / {formatTime(totalSeconds)}
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setPixelsPerSecond((v) => Math.max(MIN_PX_PER_SECOND, v / 1.5))}
            className="rounded-lg border border-white/10 p-1.5 text-zinc-400 hover:bg-white/5"
            aria-label="Zoom out"
          >
            <ZoomOut className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setPixelsPerSecond((v) => Math.min(MAX_PX_PER_SECOND, v * 1.5))}
            className="rounded-lg border border-white/10 p-1.5 text-zinc-400 hover:bg-white/5"
            aria-label="Zoom in"
          >
            <ZoomIn className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div ref={trackAreaRef} className="overflow-x-auto rounded-xl border border-white/10 bg-white/[0.02]" onClick={handleTrackClick}>
        <TimelineRuler totalSeconds={totalSeconds} pixelsPerSecond={pixelsPerSecond} markers={actMarkers} />

        <div className="relative">
          {/* Playhead */}
          <div
            className="pointer-events-none absolute top-0 bottom-0 z-10 w-px bg-orange-400"
            style={{ left: 128 + playheadSeconds * pixelsPerSecond }}
          >
            <div className="h-2 w-2 -translate-x-1/2 rounded-full bg-orange-400" />
          </div>

          <TimelineTrack label="Scenes" icon={<Film className="h-3.5 w-3.5" />} widthPixels={widthPixels}>
            {timeline.entries.map((entry) => (
              <TimelineBlock
                key={entry.sceneId}
                startSeconds={entry.plannedStartSeconds}
                durationSeconds={entry.targetDurationSeconds}
                pixelsPerSecond={pixelsPerSecond}
                label={sceneById.get(entry.sceneId)?.title ?? `Scene ${entry.sceneNumber}`}
                color="scene"
                highlighted={entry.sceneId === highlightSceneId}
                innerRef={(el) => {
                  if (el) sceneBlockRefs.current.set(entry.sceneId, el);
                  else sceneBlockRefs.current.delete(entry.sceneId);
                }}
              />
            ))}
          </TimelineTrack>

          <TimelineTrack label="Voice" icon={<Mic className="h-3.5 w-3.5" />} widthPixels={widthPixels}>
            {timeline.entries
              .filter((entry) => (sceneById.get(entry.sceneId)?.dialogue?.length ?? 0) > 0)
              .map((entry) => (
                <TimelineBlock
                  key={entry.sceneId}
                  startSeconds={entry.plannedStartSeconds}
                  durationSeconds={entry.targetDurationSeconds}
                  pixelsPerSecond={pixelsPerSecond}
                  label="Dialogue"
                  color="voice"
                  title={`Scene ${entry.sceneNumber} has real dialogue lines — exact sub-scene timing not yet available`}
                />
              ))}
          </TimelineTrack>

          <TimelineTrack label="Music" icon={<Music2 className="h-3.5 w-3.5" />} widthPixels={widthPixels}>
            {musicPlan.cues.map((cue) => {
              const entry = timeline.entries.find((e) => e.sceneId === cue.sceneId);
              if (!entry) return null;
              return (
                <TimelineBlock
                  key={cue.sceneId}
                  startSeconds={cue.startSeconds}
                  durationSeconds={entry.targetDurationSeconds}
                  pixelsPerSecond={pixelsPerSecond}
                  label={cue.cue.moodTags?.join(", ") ?? cue.cue.style ?? "Music"}
                  color="music"
                  title={`${cue.source === "EXISTING" ? "Director-authored" : "Derived"} music cue`}
                />
              );
            })}
          </TimelineTrack>

          <TimelineTrack label="Transitions" icon={<ArrowRightLeft className="h-3.5 w-3.5" />} widthPixels={widthPixels}>
            {timeline.entries.map((entry) => {
              const scene = sceneById.get(entry.sceneId);
              const cameraPlan = scene ? cameraPlanById.get(scene.cameraPlanId) : undefined;
              if (!cameraPlan) return null;
              return (
                <TimelineBlock
                  key={entry.sceneId}
                  startSeconds={Math.max(0, entry.plannedEndSeconds - 1)}
                  durationSeconds={1}
                  pixelsPerSecond={pixelsPerSecond}
                  label={transitionNameFor(cameraPlan.transitionToNext)}
                  color="transition"
                />
              );
            })}
          </TimelineTrack>
        </div>
      </div>
    </div>
  );
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default TimelineViewer;
