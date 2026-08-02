"use client";

import { useMemo, useState } from "react";
import { Clapperboard } from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";
import { SceneBrowserCard } from "./SceneBrowserCard";
import { SceneBrowserToolbar, EMPTY_SCENE_BROWSER_FILTERS, type SceneBrowserFilterState } from "./SceneBrowserToolbar";
import type { SceneBrowserSummary } from "@/services/infrastructure/SceneStudioFactory";

const ALL_STATUSES = ["DRAFTED", "QUEUED", "WAITING", "ASSIGNED", "RENDERING", "DOWNLOADING", "VERIFYING", "COMPLETED", "FAILED", "CANCELLED"];

export interface SceneBrowserGridProps {
  scenes: SceneBrowserSummary[];
}

export function SceneBrowserGrid({ scenes }: SceneBrowserGridProps) {
  const [filters, setFilters] = useState<SceneBrowserFilterState>(EMPTY_SCENE_BROWSER_FILTERS);

  const movies = useMemo(() => {
    const byId = new Map(scenes.map((scene) => [scene.movieId, scene.movieTitle]));
    return Array.from(byId, ([movieId, movieTitle]) => ({ movieId, movieTitle }));
  }, [scenes]);

  const filteredScenes = useMemo(() => {
    const search = filters.search.trim().toLowerCase();

    const filtered = scenes.filter((scene) => {
      if (filters.movieId !== "ALL" && scene.movieId !== filters.movieId) return false;
      if (filters.status !== "ALL" && scene.renderStatus !== filters.status) return false;
      if (filters.shot !== "ALL" && scene.shotType !== filters.shot) return false;
      if (search.length > 0) {
        const haystack = [scene.title, scene.movieTitle, scene.locationName, ...scene.characterNames].join(" ").toLowerCase();
        if (!haystack.includes(search)) return false;
      }
      return true;
    });

    return [...filtered].sort((a, b) => {
      switch (filters.sort) {
        case "DURATION":
          return b.durationSeconds - a.durationSeconds;
        case "STATUS":
          return a.renderStatus.localeCompare(b.renderStatus);
        case "MOVIE_SCENE":
        default:
          return a.movieTitle.localeCompare(b.movieTitle) || a.sceneNumber - b.sceneNumber;
      }
    });
  }, [scenes, filters]);

  return (
    <div>
      <SceneBrowserToolbar movies={movies} statuses={ALL_STATUSES} value={filters} onChange={setFilters} />

      {filteredScenes.length === 0 ? (
        <EmptyState icon={<Clapperboard className="h-7 w-7" />} title="No scenes match these filters" />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filteredScenes.map((scene) => (
            <SceneBrowserCard key={scene.sceneId} summary={scene} />
          ))}
        </div>
      )}
    </div>
  );
}

export default SceneBrowserGrid;
