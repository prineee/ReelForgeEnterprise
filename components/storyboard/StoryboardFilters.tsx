"use client";

import { Filter, X } from "lucide-react";
import { CameraMovement, CameraShot, type Character, type Environment } from "@/services/ai/director/OutputSchema";
import type { SceneStatus } from "./SceneStatusBadge";

export const ALL = "ALL" as const;

export interface StoryboardFilterState {
  characterId: string | typeof ALL;
  environmentId: string | typeof ALL;
  status: SceneStatus | typeof ALL;
  /** "Scene Type" — CameraPlan.shot (the closest real categorical field to what the sprint calls scene type). */
  shot: CameraShot | typeof ALL;
  /** "Camera Type" — CameraPlan.movement, kept distinct from the Camera Angle field shown on each card. */
  movement: CameraMovement | typeof ALL;
}

export const EMPTY_STORYBOARD_FILTERS: StoryboardFilterState = {
  characterId: ALL,
  environmentId: ALL,
  status: ALL,
  shot: ALL,
  movement: ALL,
};

export interface StoryboardFiltersProps {
  characters: readonly Character[];
  environments: readonly Environment[];
  statuses: readonly SceneStatus[];
  value: StoryboardFilterState;
  onChange: (next: StoryboardFilterState) => void;
}

const SELECT_CLASS =
  "rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs text-zinc-300 outline-none focus-visible:ring-2 focus-visible:ring-brand-500";

/** Module 4 — pure client-side filtering over data StoryboardGrid already receives; adds no new data source. */
export function StoryboardFilters({ characters, environments, statuses, value, onChange }: StoryboardFiltersProps) {
  const hasActiveFilter = Object.values(value).some((v) => v !== ALL);

  function set<K extends keyof StoryboardFilterState>(key: K, next: StoryboardFilterState[K]) {
    onChange({ ...value, [key]: next });
  }

  return (
    <div className="mb-3 flex flex-wrap items-center gap-2">
      <span className="inline-flex items-center gap-1 text-xs text-zinc-500">
        <Filter className="h-3.5 w-3.5" /> Filter
      </span>

      <select className={SELECT_CLASS} value={value.characterId} onChange={(e) => set("characterId", e.target.value)}>
        <option value={ALL}>All characters</option>
        {characters.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>

      <select className={SELECT_CLASS} value={value.environmentId} onChange={(e) => set("environmentId", e.target.value)}>
        <option value={ALL}>All locations</option>
        {environments.map((e) => (
          <option key={e.id} value={e.id}>
            {e.name}
          </option>
        ))}
      </select>

      <select className={SELECT_CLASS} value={value.status} onChange={(e) => set("status", e.target.value as SceneStatus | typeof ALL)}>
        <option value={ALL}>All statuses</option>
        {statuses.map((s) => (
          <option key={s} value={s}>
            {humanize(s)}
          </option>
        ))}
      </select>

      <select className={SELECT_CLASS} value={value.shot} onChange={(e) => set("shot", e.target.value as CameraShot | typeof ALL)}>
        <option value={ALL}>All scene types</option>
        {Object.values(CameraShot).map((shot) => (
          <option key={shot} value={shot}>
            {humanize(shot)}
          </option>
        ))}
      </select>

      <select className={SELECT_CLASS} value={value.movement} onChange={(e) => set("movement", e.target.value as CameraMovement | typeof ALL)}>
        <option value={ALL}>All camera types</option>
        {Object.values(CameraMovement).map((movement) => (
          <option key={movement} value={movement}>
            {humanize(movement)}
          </option>
        ))}
      </select>

      {hasActiveFilter && (
        <button
          type="button"
          onClick={() => onChange(EMPTY_STORYBOARD_FILTERS)}
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

export default StoryboardFilters;
