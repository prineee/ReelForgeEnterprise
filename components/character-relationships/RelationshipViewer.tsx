import { ArrowDown, Clapperboard, Film, ImageIcon, MapPin, UserCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/EmptyState";
import type { CharacterRelationships } from "@/services/infrastructure/CharacterStudioFactory";

export interface RelationshipViewerProps {
  relationships?: CharacterRelationships;
}

/**
 * Module 8 — every edge shown is read from the real AssetDependencyGraph
 * (services/ai/asset-intelligence/AssetDependencyGraph.ts), built once via
 * AssetManager.catalog() and traversed with its own getDependents() -
 * CharacterStudioFactory.getCharacterRelationships() does not build a
 * second graph. "Movies" comes from CharacterLibraryEntry.movieIds (the
 * graph has no Movie node type). Presented as a structured tree rather
 * than a force-directed graph - no graph-rendering library exists
 * anywhere in this codebase, and adding one would be well outside a
 * read-only relationship viewer's scope.
 */
export function RelationshipViewer({ relationships }: RelationshipViewerProps) {
  if (!relationships) {
    return <p className="text-xs text-zinc-500">No production data available for this character yet.</p>;
  }

  const { characterName, movies, ownAssetLabels, scenes } = relationships;

  return (
    <div className="space-y-3">
      <TreeLevel label="Character">
        <NodeCard icon={<UserCircle2 className="h-4 w-4" />} title={characterName} variant="primary" />
      </TreeLevel>

      <Connector />

      <TreeLevel label="Movies">
        <div className="flex flex-wrap justify-center gap-2">
          {movies.map((movie) => (
            <NodeCard key={movie.movieId} icon={<Film className="h-4 w-4" />} title={movie.movieTitle} variant={movie.isPrimary ? "primary" : "default"} />
          ))}
        </div>
      </TreeLevel>

      {ownAssetLabels.length > 0 && (
        <>
          <Connector />
          <TreeLevel label="Character's Own Assets">
            <div className="flex flex-wrap justify-center gap-1.5">
              {ownAssetLabels.map((label) => (
                <Badge key={label} variant="secondary" className="!px-2 !py-0.5 text-[10px]">
                  {label}
                </Badge>
              ))}
            </div>
          </TreeLevel>
        </>
      )}

      <Connector />

      <TreeLevel label="Scenes">
        {scenes.length === 0 ? (
          <EmptyState icon={<Clapperboard className="h-6 w-6" />} title="No scenes yet" />
        ) : (
          <div className="flex flex-wrap justify-center gap-2">
            {scenes.map((scene) => (
              <NodeCard key={scene.sceneId} icon={<Clapperboard className="h-4 w-4" />} title={scene.label} />
            ))}
          </div>
        )}
      </TreeLevel>

      {scenes.length > 0 && (
        <>
          <Connector />
          <TreeLevel label="Locations">
            <div className="flex flex-wrap justify-center gap-2">
              {dedupeLocations(scenes).map((location) => (
                <NodeCard key={location.environmentId} icon={<MapPin className="h-4 w-4" />} title={location.label} />
              ))}
            </div>
          </TreeLevel>

          <Connector />

          <TreeLevel label="Assets">
            {dedupeLocations(scenes).every((location) => location.assetLabels.length === 0) ? (
              <p className="text-center text-xs text-zinc-500">No reference-image assets recorded at these locations.</p>
            ) : (
              <div className="flex flex-wrap justify-center gap-1.5">
                {dedupeLocations(scenes).flatMap((location) =>
                  location.assetLabels.map((label) => (
                    <Badge key={`${location.environmentId}-${label}`} variant="secondary" className="!px-2 !py-0.5 text-[10px]">
                      <ImageIcon className="mr-1 h-2.5 w-2.5" /> {label}
                    </Badge>
                  ))
                )}
              </div>
            )}
          </TreeLevel>
        </>
      )}
    </div>
  );
}

function dedupeLocations(scenes: CharacterRelationships["scenes"]) {
  const byEnvironmentId = new Map<string, { environmentId: string; label: string; assetLabels: string[] }>();
  for (const scene of scenes) {
    if (!scene.environmentId) continue;
    if (!byEnvironmentId.has(scene.environmentId)) {
      byEnvironmentId.set(scene.environmentId, {
        environmentId: scene.environmentId,
        label: scene.locationLabel ?? scene.environmentId,
        assetLabels: scene.locationAssetLabels,
      });
    }
  }
  return Array.from(byEnvironmentId.values());
}

function TreeLevel({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-2 text-center text-[10px] font-semibold uppercase tracking-wider text-zinc-500">{label}</p>
      {children}
    </div>
  );
}

function Connector() {
  return (
    <div className="flex justify-center text-zinc-600">
      <ArrowDown className="h-4 w-4" />
    </div>
  );
}

function NodeCard({ icon, title, variant = "default" }: { icon: React.ReactNode; title: string; variant?: "default" | "primary" }) {
  return (
    <div
      className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs ${
        variant === "primary" ? "border-brand-500/50 bg-brand-500/10 text-white" : "border-white/10 bg-white/5 text-zinc-300"
      }`}
    >
      {icon}
      <span className="max-w-[10rem] truncate">{title}</span>
    </div>
  );
}

export default RelationshipViewer;
