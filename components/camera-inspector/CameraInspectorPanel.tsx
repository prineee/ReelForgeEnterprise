import { Badge } from "@/components/ui/badge";
import type { CameraInspectorData } from "@/services/infrastructure/SceneStudioFactory";

export interface CameraInspectorPanelProps {
  camera: CameraInspectorData;
}

/**
 * Module 3 — every field reads directly from the real CameraPlan
 * (services/ai/director/OutputSchema.ts), already produced by the AI
 * Director pipeline. Cinematic Style reuses DirectorPromptPipeline's own
 * enrichment input — DirectorProfile.promptStyleModifiers, the exact
 * style data DirectorPromptPipeline appends to this scene's composed
 * prompt — rather than a fabricated scene-level "style" field. Read-only.
 */
export function CameraInspectorPanel({ camera }: CameraInspectorPanelProps) {
  const { cameraPlan, shotPresetName, cinematicStyleModifiers } = camera;

  if (!cameraPlan) {
    return <p className="text-xs text-zinc-500">Not planned yet — this scene has no camera plan.</p>;
  }

  return (
    <div className="space-y-3 text-xs">
      <Row label="Camera Type" value={humanize(cameraPlan.shot)} sub={shotPresetName} />
      <Row label="Lens" value={cameraPlan.lens} />
      <Row label="Angle" value={`${cameraPlan.angle}° · ${humanize(cameraPlan.cameraHeight)}`} />
      <Row label="Movement" value={cameraPlan.movement ? humanize(cameraPlan.movement) : "Not planned yet"} />
      <Row label="Framing" value={cameraPlan.framing} />

      <div>
        <p className="mb-1.5 border-b border-white/5 pb-1 text-zinc-500">Cinematic Style</p>
        <p className="mb-2 text-zinc-300">{cameraPlan.cinematicPurpose}</p>
        {cinematicStyleModifiers.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {cinematicStyleModifiers.map((modifier) => (
              <Badge key={modifier} variant="secondary" className="!px-2 !py-0.5 text-[10px]">
                {modifier}
              </Badge>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Row({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-white/5 py-1">
      <span className="text-zinc-500">{label}</span>
      <span className="text-right text-zinc-300">
        {value}
        {sub && <span className="ml-1.5 text-zinc-500">({sub})</span>}
      </span>
    </div>
  );
}

function humanize(value: string): string {
  return value.toLowerCase().replace(/_/g, " ");
}

export default CameraInspectorPanel;
