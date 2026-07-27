import Link from "next/link";
import { Camera, Clapperboard, MapPin, Smile, Users } from "lucide-react";
import { Card } from "@/components/ui/card";
import { SceneStatusBadge, type SceneStatus } from "@/components/storyboard/SceneStatusBadge";
import type { SceneBrowserSummary } from "@/services/infrastructure/SceneStudioFactory";

export interface SceneBrowserCardProps {
  summary: SceneBrowserSummary;
}

/** Every field reads from SceneStudioFactory.listSceneSummaries() — real Scene/CameraPlan/EmotionPlan/Environment data, no fabricated fields. Thumbnail is a placeholder — no per-scene thumbnail exists anywhere in the backend, same honest-gap convention as the Storyboard Studio's SceneCard. */
export function SceneBrowserCard({ summary }: SceneBrowserCardProps) {
  return (
    <Link href={`/movie-studio/scenes/${summary.sceneId}`}>
      <Card hover className="flex h-full flex-col overflow-hidden">
        <div className="relative flex aspect-video w-full shrink-0 flex-col items-center justify-center border-b border-white/10 bg-gradient-to-br from-brand-900/60 to-purple-950/60">
          <Clapperboard className="h-7 w-7 text-white/30" />
          <span className="mt-1 text-xs font-bold text-white/40">Scene {summary.sceneNumber}</span>
          <div className="absolute left-2 top-2">
            <SceneStatusBadge status={summary.renderStatus as SceneStatus} />
          </div>
        </div>

        <div className="flex flex-1 flex-col gap-2 p-4">
          <div>
            <p className="truncate text-sm font-semibold text-white">{summary.title ?? `Scene ${summary.sceneNumber}`}</p>
            <p className="truncate text-xs text-zinc-500">{summary.movieTitle}</p>
          </div>

          <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs text-zinc-400">
            <span className="inline-flex items-center gap-1.5 truncate">
              <Clapperboard className="h-3.5 w-3.5 shrink-0" /> {summary.durationSeconds}s
            </span>
            {summary.shotType && (
              <span className="inline-flex items-center gap-1.5 truncate">
                <Camera className="h-3.5 w-3.5 shrink-0" /> {humanize(summary.shotType)}
              </span>
            )}
            <span className="inline-flex items-center gap-1.5 truncate">
              <MapPin className="h-3.5 w-3.5 shrink-0" /> {summary.locationName}
            </span>
            {summary.mood && (
              <span className="inline-flex items-center gap-1.5 truncate">
                <Smile className="h-3.5 w-3.5 shrink-0" /> {humanize(summary.mood)}
              </span>
            )}
          </div>

          <span className="mt-auto inline-flex items-start gap-1.5 text-xs text-zinc-400">
            <Users className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span className="line-clamp-1">{summary.characterNames.join(", ") || "—"}</span>
          </span>
        </div>
      </Card>
    </Link>
  );
}

function humanize(value: string): string {
  return value.toLowerCase().replace(/_/g, " ");
}

export default SceneBrowserCard;
