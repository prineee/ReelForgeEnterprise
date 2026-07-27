import { Clapperboard, Film } from "lucide-react";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/EmptyState";
import type { MovieUsageEntry } from "@/services/infrastructure/CharacterStudioFactory";

export interface MovieUsagePanelProps {
  usage: readonly MovieUsageEntry[];
}

/** Module 3 — every movie using this character, sourced from CharacterLibraryEntry.movieIds (CharacterStudioFactory.getCharacterMovieUsage()) - the library's own cross-movie relationship, not a second index. Scene counts/first-last appearance are read directly from each movie's real Scene.characterIds. */
export function MovieUsagePanel({ usage }: MovieUsagePanelProps) {
  if (usage.length === 0) {
    return <EmptyState icon={<Film className="h-7 w-7" />} title="Not used in any movie yet" />;
  }

  return (
    <div className="space-y-2">
      {usage.map((entry) => (
        <Card key={entry.movieId} className="flex items-center justify-between gap-3 p-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-white">{entry.movieTitle}</p>
            <p className="mt-0.5 text-xs text-zinc-400">
              {entry.firstAppearanceSceneNumber !== undefined && entry.lastAppearanceSceneNumber !== undefined
                ? `Scenes ${entry.firstAppearanceSceneNumber}–${entry.lastAppearanceSceneNumber}`
                : "No scenes yet"}
            </p>
          </div>
          <div className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-zinc-300">
            <Clapperboard className="h-3.5 w-3.5" /> {entry.sceneCount} scene{entry.sceneCount === 1 ? "" : "s"}
          </div>
        </Card>
      ))}
    </div>
  );
}

export default MovieUsagePanel;
