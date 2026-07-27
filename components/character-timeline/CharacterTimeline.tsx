import { Film } from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";
import { TimelineBlock } from "@/components/timeline/TimelineBlock";
import type { CharacterTimelineResult } from "@/services/infrastructure/CharacterStudioFactory";

export interface CharacterTimelineProps {
  timeline?: CharacterTimelineResult;
}

const PIXELS_PER_SECOND = 6;

/**
 * Module 7 — every block's position/width is real data from
 * MovieTimelineBuilder's MovieTimelinePlan (via AIDirectorPlan.timeline,
 * reused through CharacterStudioFactory.getCharacterTimeline()), filtered
 * to scenes this character appears in. Reuses components/timeline/TimelineBlock.tsx
 * directly rather than a second positioned-block implementation. Read-only.
 */
export function CharacterTimeline({ timeline }: CharacterTimelineProps) {
  if (!timeline || timeline.entries.length === 0) {
    return <EmptyState icon={<Film className="h-7 w-7" />} title="No scenes yet" description="This character doesn't appear in any planned scene yet." />;
  }

  const widthPixels = Math.max(timeline.totalPlannedDurationSeconds, 1) * PIXELS_PER_SECOND;

  return (
    <div className="space-y-3">
      <p className="text-xs text-zinc-500">
        {timeline.entries.length} scene{timeline.entries.length === 1 ? "" : "s"} in {timeline.movieTitle}
      </p>

      <div className="overflow-x-auto rounded-xl border border-white/10 bg-white/[0.02] p-2">
        <div className="relative h-10" style={{ width: widthPixels }}>
          {timeline.entries.map((entry) => (
            <TimelineBlock
              key={entry.sceneId}
              startSeconds={entry.plannedStartSeconds}
              durationSeconds={entry.targetDurationSeconds}
              pixelsPerSecond={PIXELS_PER_SECOND}
              label={entry.sceneTitle ?? `Scene ${entry.sceneNumber}`}
              color="scene"
            />
          ))}
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-white/10">
        <table className="w-full text-left text-xs">
          <thead className="bg-white/5 text-zinc-400">
            <tr>
              <th className="px-3 py-2">Scene</th>
              <th className="px-3 py-2">Act</th>
              <th className="px-3 py-2">Start</th>
              <th className="px-3 py-2">Duration</th>
            </tr>
          </thead>
          <tbody>
            {timeline.entries.map((entry) => (
              <tr key={entry.sceneId} className="border-t border-white/5">
                <td className="px-3 py-2 text-white">{entry.sceneTitle ?? `Scene ${entry.sceneNumber}`}</td>
                <td className="px-3 py-2 text-zinc-400">Act {entry.actNumber}</td>
                <td className="px-3 py-2 text-zinc-400">{formatTime(entry.plannedStartSeconds)}</td>
                <td className="px-3 py-2 text-zinc-400">{entry.targetDurationSeconds}s</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default CharacterTimeline;
