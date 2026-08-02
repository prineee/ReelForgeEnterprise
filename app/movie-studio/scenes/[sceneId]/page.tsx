import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ArrowLeft, Camera, Clapperboard, Info, MapPin, Sun, Users, Boxes, Cpu, Terminal } from "lucide-react";
import { SceneStudioTabs } from "@/components/scene-studio/SceneStudioTabs";
import { SceneOverviewPanel } from "@/components/scene-detail/SceneOverviewPanel";
import { CameraInspectorPanel } from "@/components/camera-inspector/CameraInspectorPanel";
import { LightingInspectorPanel } from "@/components/lighting-inspector/LightingInspectorPanel";
import { CharacterPlacementPanel } from "@/components/scene-detail/CharacterPlacementPanel";
import { LocationInspectorPanel } from "@/components/location-inspector/LocationInspectorPanel";
import { AssetInspectorPanel } from "@/components/asset-inspector/AssetInspectorPanel";
import { ProductionPreviewPanel } from "@/components/scene-detail/ProductionPreviewPanel";
import { PromptViewerPanel } from "@/components/prompt-viewer/PromptViewerPanel";
import { SceneNavigationBar } from "@/components/scene-studio/SceneNavigationBar";
import {
  getSceneOverview,
  getCameraInspector,
  getLightingInspector,
  getCharacterPlacement,
  getLocationInspector,
  getAssetInspector,
  getProductionPreview,
  getPromptViewer,
  getSceneNavigation,
} from "@/services/infrastructure/SceneStudioFactory";

/** Reads live server-side in-memory state per request — must not be statically prerendered. */
export const dynamic = "force-dynamic";

/**
 * Scene Studio detail screen — composes Modules 2-9 as tabs over one
 * already-resolved scene, plus Module 10 (SceneNavigationBar) as a
 * persistent header bar rather than a tab, since previous/next/jump
 * links are useful regardless of which tab is active.
 */
export default async function SceneDetailPage({ params }: { params: Promise<{ sceneId: string }> }) {
  const { sceneId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const overview = getSceneOverview(sceneId, user.id);
  if (!overview) notFound();
  const camera = getCameraInspector(sceneId, user.id) ?? { cameraPlan: undefined, shotPresetName: undefined, cinematicStyleModifiers: [] };
  const lighting = getLightingInspector(sceneId, user.id) ?? { environment: undefined, mood: undefined };
  const placement = getCharacterPlacement(sceneId, user.id) ?? { characters: [], dialogue: undefined };
  const location = getLocationInspector(sceneId, user.id) ?? { environment: undefined, relatedScenes: [], isReusedFromPriorMovie: false };
  const assets = getAssetInspector(sceneId, user.id) ?? {
    characterReferenceImages: [],
    environmentReferenceImages: [],
    videoUrl: undefined,
    musicCue: undefined,
    voiceAssignments: [],
    soundEffects: [],
  };
  const production = getProductionPreview(sceneId, user.id) ?? {
    recommendedProvider: undefined,
    estimatedCredits: undefined,
    estimatedRenderTimeSeconds: undefined,
    qualityScore: undefined,
    continuityIssues: [],
  };
  const prompt = getPromptViewer(sceneId, user.id) ?? { positivePrompt: undefined, negativePrompt: undefined, aspectRatio: undefined, quality: undefined, expectedDuration: undefined };
  const navigation = getSceneNavigation(sceneId, user.id) ?? { movieId: overview.movieId, previousSceneId: undefined, nextSceneId: undefined, characterLinks: [] };

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

        <SceneNavigationBar navigation={navigation} />

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
            {
              id: "location",
              label: "Location",
              icon: <MapPin className="h-3.5 w-3.5" />,
              content: <LocationInspectorPanel location={location} movieId={overview.movieId} />,
            },
            {
              id: "assets",
              label: "Assets",
              icon: <Boxes className="h-3.5 w-3.5" />,
              content: <AssetInspectorPanel assets={assets} />,
            },
            {
              id: "production",
              label: "Production",
              icon: <Cpu className="h-3.5 w-3.5" />,
              content: <ProductionPreviewPanel preview={production} />,
            },
            {
              id: "prompt",
              label: "Prompt",
              icon: <Terminal className="h-3.5 w-3.5" />,
              content: <PromptViewerPanel prompt={prompt} />,
            },
          ]}
        />
      </div>
    </div>
  );
}
