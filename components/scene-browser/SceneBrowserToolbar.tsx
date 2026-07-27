"use client";

import { ArrowDownUp, Search, X } from "lucide-react";
import { CameraShot } from "@/services/ai/director/OutputSchema";

export type SceneSortKey = "MOVIE_SCENE" | "DURATION" | "STATUS";

export interface SceneBrowserFilterState {
  search: string;
  movieId: string;
  status: string;
  shot: string;
  sort: SceneSortKey;
}

export const EMPTY_SCENE_BROWSER_FILTERS: SceneBrowserFilterState = {
  search: "",
  movieId: "ALL",
  status: "ALL",
  shot: "ALL",
  sort: "MOVIE_SCENE",
};

export interface SceneBrowserToolbarProps {
  movies: { movieId: string; movieTitle: string }[];
  statuses: readonly string[];
  value: SceneBrowserFilterState;
  onChange: (next: SceneBrowserFilterState) => void;
}

const SELECT_CLASS = "rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs text-zinc-300 outline-none focus:border-brand-500";

/** Module 1 — pure client-side search/filter/sort over SceneBrowserSummary[] already fetched server-side; no new data source. */
export function SceneBrowserToolbar({ movies, statuses, value, onChange }: SceneBrowserToolbarProps) {
  const hasActiveFilter = value.search !== "" || value.movieId !== "ALL" || value.status !== "ALL" || value.shot !== "ALL";

  function set<K extends keyof SceneBrowserFilterState>(key: K, next: SceneBrowserFilterState[K]) {
    onChange({ ...value, [key]: next });
  }

  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-500" />
        <input
          type="text"
          value={value.search}
          onChange={(e) => set("search", e.target.value)}
          placeholder="Search scenes, movies, characters…"
          className="w-56 rounded-lg border border-white/10 bg-white/5 py-1.5 pl-8 pr-2.5 text-xs text-zinc-300 outline-none placeholder:text-zinc-600 focus:border-brand-500"
        />
      </div>

      <select className={SELECT_CLASS} value={value.movieId} onChange={(e) => set("movieId", e.target.value)}>
        <option value="ALL">All movies</option>
        {movies.map((movie) => (
          <option key={movie.movieId} value={movie.movieId}>
            {movie.movieTitle}
          </option>
        ))}
      </select>

      <select className={SELECT_CLASS} value={value.status} onChange={(e) => set("status", e.target.value)}>
        <option value="ALL">All statuses</option>
        {statuses.map((status) => (
          <option key={status} value={status}>
            {humanize(status)}
          </option>
        ))}
      </select>

      <select className={SELECT_CLASS} value={value.shot} onChange={(e) => set("shot", e.target.value)}>
        <option value="ALL">All shot types</option>
        {Object.values(CameraShot).map((shot) => (
          <option key={shot} value={shot}>
            {humanize(shot)}
          </option>
        ))}
      </select>

      <label className="inline-flex items-center gap-1.5 text-xs text-zinc-500">
        <ArrowDownUp className="h-3.5 w-3.5" />
        <select className={SELECT_CLASS} value={value.sort} onChange={(e) => set("sort", e.target.value as SceneSortKey)}>
          <option value="MOVIE_SCENE">Movie / Scene #</option>
          <option value="DURATION">Duration</option>
          <option value="STATUS">Render status</option>
        </select>
      </label>

      {hasActiveFilter && (
        <button
          type="button"
          onClick={() => onChange(EMPTY_SCENE_BROWSER_FILTERS)}
          className="inline-flex items-center gap-1 rounded-lg border border-white/10 px-2.5 py-1.5 text-xs text-zinc-400 hover:bg-white/5"
        >
          <X className="h-3.5 w-3.5" /> Clear
        </button>
      )}
    </div>
  );
}

function humanize(value: string): string {
  return value.toLowerCase().replace(/_/g, " ");
}

export default SceneBrowserToolbar;
