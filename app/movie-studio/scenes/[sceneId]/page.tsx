import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Camera, Clapperboard, Info, Sun, Users } from "lucide-react";
import { SceneStudioTabs } from "@/components/scene-studio/SceneStudioTabs";
import { SceneOverviewPanel } from "@/components/scene-detail/SceneOverviewPanel";
import { CameraInspectorPanel } from "@/components/camera-inspector/CameraInspectorPanel";
import { LightingInspectorPanel } from "@/components/lighting-inspector/LightingInspectorPanel";
import { CharacterPlacementPanel } from "@/components/scene-detail/CharacterPlacementPanel";
import {
  getSceneOverview,
  getCameraInspector,
  getLightingInspector,
  getCharacterPlacement,
} from "@/services/infrastructure/SceneStudioFactory";

/** Reads live server-side in-memory state per request — must not be statically prerendered. */
export const dynamic = "force-dynamic";

/**
 * Scene Studio detail screen — composes Modules 2-9 as tabs over one
 * already-resolved scene. Every module's panel is added here as its own
 * sprint milestone; this file grows one tab per module rather than each
 * module inventing its own page. Module 10 (navigation) lives in the
 * header, not a tab.
 */
export default async function SceneDetailPage({ params }: { params: Promise<{ sceneId: string }> }) {
  const { sceneId } = await params;
  const overview = getSceneOverview(sceneId);
  if (!overview) notFound();
  const camera = getCameraInspector(sceneId) ?? { cameraPlan: undefined, shotPresetName: undefined, cinematicStyleModifiers: [] };
  const lighting = getLightingInspector(sceneId) ?? { environment: undefined, mood: undefined };
  const placement = getCharacterPlacement(sceneId) ?? { characters: [], dialogue: undefined };

  return (
    <div className="min-h-screen bg-surface px-4 py-8 text-white sm:px-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <div>
          <Link href="/movie-studio/scenes" className="inline-flex items-center gap-1.5 text-sm text-zinc-400 hover:text-white">
            <ArrowLeft className="h-4 w-4" /> Scene Studio
          </Link>
          <div className="mt-3 flex items-center gap-4">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-gradient-to-br from-brand-900/60 to-purple-950/60">
              <Clapperboard className="h-8 w-8 text-white/30" />
            </div>
            <div className="min-w-0">
              <h1 className="truncate text-2xl font-bold text-white">{overview.scene.title ?? `Scene ${overview.scene.sceneNumber}`}</h1>
              <p className="mt-1 text-sm text-zinc-400">
                {overview.movieTitle} · Scene {overview.scene.sceneNumber}
              </p>
            </div>
          </div>
        </div>

        <SceneStudioTabs
          tabs={[
            {
              id: "overview",
              label: "Overview",
              icon: <Info className="h-3.5 w-3.5" />,
              content: <SceneOverviewPanel overview={overview} />,
            },
            {
              id: "camera",
              label: "Camera",
              icon: <Camera className="h-3.5 w-3.5" />,
              content: <CameraInspectorPanel camera={camera} />,
            },
            {
              id: "lighting",
              label: "Lighting",
              icon: <Sun className="h-3.5 w-3.5" />,
              content: <LightingInspectorPanel lighting={lighting} />,
            },
            {
              id: "characters",
              label: "Characters",
              icon: <Users className="h-3.5 w-3.5" />,
              content: <CharacterPlacementPanel placement={placement} />,
            },
          ]}
        />
      </div>
    </div>
  );
}
