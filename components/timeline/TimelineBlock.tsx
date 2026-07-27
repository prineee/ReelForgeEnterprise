import { memo } from "react";
import { cn } from "@/lib/utils";

export interface TimelineBlockProps {
  startSeconds: number;
  durationSeconds: number;
  pixelsPerSecond: number;
  label: string;
  color: "scene" | "voice" | "music" | "transition";
  title?: string;
  highlighted?: boolean;
  /** Lets TimelineViewer scroll this block into view when it becomes the highlighted one (Module 6). */
  innerRef?: (el: HTMLDivElement | null) => void;
}

const COLOR_CLASSES: Record<TimelineBlockProps["color"], string> = {
  scene: "bg-brand-600/70 border-brand-400/60 text-white",
  voice: "bg-emerald-600/60 border-emerald-400/50 text-white",
  music: "bg-purple-600/60 border-purple-400/50 text-white",
  transition: "bg-amber-500/70 border-amber-300/60 text-black",
};

/** Pure presentational block — position/width derived entirely from real timing data passed in, never estimated here. */
function TimelineBlockImpl({ startSeconds, durationSeconds, pixelsPerSecond, label, color, title, highlighted, innerRef }: TimelineBlockProps) {
  return (
    <div
      ref={innerRef}
      title={title ?? label}
      className={cn(
        "absolute top-1 bottom-1 flex items-center overflow-hidden rounded-md border px-2 text-xs font-medium transition-shadow",
        COLOR_CLASSES[color],
        highlighted && "ring-2 ring-white ring-offset-1 ring-offset-surface"
      )}
      style={{
        left: startSeconds * pixelsPerSecond,
        width: Math.max(durationSeconds * pixelsPerSecond - 2, 4),
      }}
    >
      <span className="truncate">{label}</span>
    </div>
  );
}

export const TimelineBlock = memo(TimelineBlockImpl);

export default TimelineBlock;
