import { Badge } from "@/components/ui/badge";
import type { LightingInspectorData } from "@/services/infrastructure/SceneStudioFactory";

export interface LightingInspectorPanelProps {
  lighting: LightingInspectorData;
}

const NOT_PLANNED = "Not planned yet";

/**
 * Module 4 — every field reads directly from the real Environment
 * (lighting/timeOfDay/weather/dominantColors, all already-produced by
 * EnvironmentDirector) and EmotionPlan.dominantEmotion, both already-
 * computed planning outputs — nothing here is recomputed or fabricated.
 * lighting/weather are optional on Environment; when absent, "Not
 * planned yet" is shown rather than a guessed value, per this module's
 * explicit rule.
 */
export function LightingInspectorPanel({ lighting }: LightingInspectorPanelProps) {
  const { environment, mood } = lighting;

  if (!environment) {
    return <p className="text-xs text-zinc-500">{NOT_PLANNED} — this scene has no environment assigned.</p>;
  }

  return (
    <div className="space-y-3 text-xs">
      <Row label="Lighting Style" value={environment.lighting ? humanize(environment.lighting) : NOT_PLANNED} />
      <Row label="Time of Day" value={humanize(environment.timeOfDay)} />
      <Row label="Weather" value={environment.weather ? humanize(environment.weather) : NOT_PLANNED} />
      <Row label="Mood" value={mood ? humanize(mood) : NOT_PLANNED} />

      <div>
        <p className="mb-1.5 border-b border-white/5 pb-1 text-zinc-500">Color Palette</p>
        {environment.dominantColors.length > 0 ? (
          <div className="flex flex-wrap items-center gap-1.5">
            {environment.dominantColors.map((color) => (
              <span key={color} className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-2 py-1">
                <span className="h-3 w-3 shrink-0 rounded-full border border-white/20" style={{ backgroundColor: isHex(color) ? color : undefined }} />
                <span className="text-zinc-300">{color}</span>
              </span>
            ))}
          </div>
        ) : (
          <p className="text-zinc-500">{NOT_PLANNED}</p>
        )}
      </div>
    </div>
  );
}

function isHex(value: string): boolean {
  return /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(value);
}

function Row({ label, value }: { label: string; value: string }) {
  const isPlaceholder = value === NOT_PLANNED;
  return (
    <div className="flex items-start justify-between gap-3 border-b border-white/5 py-1">
      <span className="text-zinc-500">{label}</span>
      {isPlaceholder ? (
        <Badge variant="secondary" className="!px-2 !py-0.5 text-[10px]">
          {value}
        </Badge>
      ) : (
        <span className="text-right text-zinc-300">{value}</span>
      )}
    </div>
  );
}

function humanize(value: string): string {
  return value.toLowerCase().replace(/_/g, " ");
}

export default LightingInspectorPanel;
