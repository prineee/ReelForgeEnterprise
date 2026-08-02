export interface TimelineRulerProps {
  totalSeconds: number;
  pixelsPerSecond: number;
  markers?: { atSeconds: number; label: string }[];
}

/** A tick every 5 seconds, plus optional labeled markers (e.g. act boundaries) — all positions derived from real durations, never estimated. */
export function TimelineRuler({ totalSeconds, pixelsPerSecond, markers = [] }: TimelineRulerProps) {
  const tickInterval = pixelsPerSecond < 4 ? 30 : pixelsPerSecond < 10 ? 10 : 5;
  const ticks = Array.from({ length: Math.ceil(totalSeconds / tickInterval) + 1 }, (_, i) => i * tickInterval);

  return (
    <div className="relative flex h-8 border-b border-white/10 bg-white/[0.02]" style={{ minWidth: totalSeconds * pixelsPerSecond }}>
      <div className="w-32 shrink-0 border-r border-white/10" />
      <div className="relative flex-1">
        {ticks.map((t) => (
          <div key={t} className="absolute top-0 h-full border-l border-white/10 pl-1 text-[10px] text-zinc-500" style={{ left: t * pixelsPerSecond }}>
            {formatTime(t)}
          </div>
        ))}
        {markers.map((marker) => (
          <div
            key={marker.label}
            className="absolute top-0 flex h-full items-center border-l-2 border-orange-400 pl-1 text-[10px] font-semibold text-orange-400"
            style={{ left: marker.atSeconds * pixelsPerSecond }}
          >
            {marker.label}
          </div>
        ))}
      </div>
    </div>
  );
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default TimelineRuler;
