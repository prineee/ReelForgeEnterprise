import Link from "next/link";
import { MapPin, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { LocationInspectorData } from "@/services/infrastructure/SceneStudioFactory";

export interface LocationInspectorPanelProps {
  location: LocationInspectorData;
  movieId: string;
}

/**
 * Module 6 — Environment fields are real, already-produced data.
 * Location Reuse reuses LocationPlanner (services/ai/movie-producer/LocationPlanner.ts,
 * Sprint 10) - itself a thin composition over LocationLibrary, never a
 * second reuse check. Indoor/Outdoor has no backing field anywhere on
 * Environment and is disclosed as "Not planned yet" rather than guessed
 * from description/architecture text.
 */
export function LocationInspectorPanel({ location, movieId }: LocationInspectorPanelProps) {
  const { environment, relatedScenes, isReusedFromPriorMovie } = location;

  if (!environment) {
    return <p className="text-xs text-zinc-500">Not planned yet — this scene has no environment assigned.</p>;
  }

  return (
    <div className="space-y-4 text-xs">
      <div>
        <div className="flex items-center justify-between">
          <p className="inline-flex items-center gap-1.5 font-semibold text-white">
            <MapPin className="h-3.5 w-3.5" /> {environment.name}
          </p>
          {isReusedFromPriorMovie && (
            <Badge variant="success" className="!px-2 !py-0.5 text-[10px]">
              <ShieldCheck className="mr-1 h-3 w-3" /> Reused across productions
            </Badge>
          )}
        </div>
        <p className="mt-1 text-zinc-400">{environment.description}</p>
      </div>

      <Row label="Indoor / Outdoor" value="Not planned yet" />
      <Row label="Location" value={environment.location} />
      <Row label="Architecture" value={environment.architecture} />
      <Row label="Atmosphere" value={environment.atmosphere} />

      <div>
        <p className="mb-1.5 border-b border-white/5 pb-1 text-zinc-500">Related Scenes ({relatedScenes.length})</p>
        {relatedScenes.length === 0 ? (
          <p className="text-zinc-500">No other scenes are set here yet.</p>
        ) : (
          <ul className="space-y-1">
            {relatedScenes.map((scene) => (
              <li key={scene.sceneId}>
                <Link href={`/movie-studio/scenes/${scene.sceneId}`} className="text-brand-300 hover:underline">
                  Scene {scene.sceneNumber}
                  {scene.title ? ` — ${scene.title}` : ""}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="pt-1">
        <Link href={`/movie-studio/workspace/${movieId}`} className="text-brand-300 hover:underline">
          Open this movie's workspace →
        </Link>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  const isPlaceholder = value === "Not planned yet";
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

export default LocationInspectorPanel;
