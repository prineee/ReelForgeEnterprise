"use client";

import { useMemo, useState } from "react";
import { Search, Package } from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";
import { cn } from "@/lib/utils";
import type { UploadedReferenceAsset } from "@/services/infrastructure/ProductionContextRepository";
import type { Character } from "@/services/ai/director/OutputSchema";
import type { MusicPlan } from "@/services/ai/asset-intelligence/MusicPlanner";
import type { VoicePlan } from "@/services/ai/asset-intelligence/VoicePlanner";
import type { ShotPreset } from "@/services/ai/asset-intelligence/ShotLibrary";
import type { TransitionPreset } from "@/services/ai/asset-intelligence/TransitionLibrary";
import { AssetBrowserItem, type BrowserAsset, type AssetCategory } from "./AssetBrowserItem";

export interface RenderedSceneVideo {
  sceneId?: string;
  videoUrl?: string;
  status: string;
}

export interface AssetBrowserProps {
  uploadedReferenceAssets: UploadedReferenceAsset[];
  renderedVideos: RenderedSceneVideo[];
  musicPlan: MusicPlan;
  voicePlan: VoicePlan;
  characters: Character[];
  shotsUsed: readonly ShotPreset[];
  transitionsUsed: readonly TransitionPreset[];
}

const CATEGORIES: AssetCategory[] = ["IMAGE", "VIDEO", "AUDIO", "MUSIC", "VOICE", "EFFECT"];

/**
 * Module 6 — every entry is built from real backend state: reference
 * images from Stage 2's UploadedReferenceAsset[] (real Cloudinary URLs),
 * videos from real RenderJobs (services/rendering/jobs/RenderJobManager.ts),
 * music/voice from services/ai/asset-intelligence/'s real MusicPlanner/
 * VoicePlanner output, effects from ShotLibrary/TransitionLibrary presets
 * actually used by this movie's real CameraPlans. AUDIO (synthesized
 * dialogue) is honestly empty — no TTS provider is configured anywhere in
 * this codebase (services/ai/providers/audio/ElevenLabsService.ts remains
 * unconfigured) — never fabricated.
 */
export function AssetBrowser({ uploadedReferenceAssets, renderedVideos, musicPlan, voicePlan, characters, shotsUsed, transitionsUsed }: AssetBrowserProps) {
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<AssetCategory | "ALL">("ALL");

  const assets = useMemo<BrowserAsset[]>(() => {
    const characterById = new Map(characters.map((c) => [c.id, c]));

    const images: BrowserAsset[] = uploadedReferenceAssets.map((asset) => ({
      id: asset.assetId,
      category: "IMAGE",
      label: `${characterById.get(asset.characterId)?.name ?? asset.characterId} reference`,
      subtitle: `${asset.provider} · ${asset.width ?? "?"}×${asset.height ?? "?"}`,
      url: asset.url,
      kind: "FILE",
    }));

    const videos: BrowserAsset[] = renderedVideos
      .filter((v) => v.videoUrl)
      .map((v, i) => ({
        id: `video-${v.sceneId ?? i}`,
        category: "VIDEO",
        label: v.sceneId ? `Scene ${v.sceneId} render` : `Render ${i + 1}`,
        subtitle: v.status,
        url: v.videoUrl,
        kind: "FILE",
      }));

    const music: BrowserAsset[] = musicPlan.cues.map((cue) => ({
      id: `music-${cue.sceneId}`,
      category: "MUSIC",
      label: `Scene ${cue.sceneNumber} — ${cue.cue.style ?? musicPlan.overallStyle}`,
      subtitle: cue.cue.moodTags?.join(", "),
      kind: "PLAN",
    }));

    const voices: BrowserAsset[] = Object.entries(voicePlan.assignmentsByCharacter).map(([characterId, voiceProfileId]) => ({
      id: `voice-${characterId}`,
      category: "VOICE",
      label: characterById.get(characterId)?.name ?? characterId,
      subtitle: voiceProfileId,
      kind: "PLAN",
    }));

    const effects: BrowserAsset[] = [
      ...shotsUsed.map((preset) => ({ id: `shot-${preset.id}`, category: "EFFECT" as const, label: preset.name, subtitle: preset.description, kind: "PLAN" as const })),
      ...transitionsUsed.map((preset) => ({ id: `transition-${preset.transition}`, category: "EFFECT" as const, label: preset.name, subtitle: preset.typicalUseCase, kind: "PLAN" as const })),
    ];

    return [...images, ...videos, ...music, ...voices, ...effects];
  }, [uploadedReferenceAssets, renderedVideos, musicPlan, voicePlan, characters, shotsUsed, transitionsUsed]);

  const filtered = assets.filter((asset) => {
    const matchesCategory = activeCategory === "ALL" || asset.category === activeCategory;
    const matchesQuery = query.trim().length === 0 || asset.label.toLowerCase().includes(query.toLowerCase());
    return matchesCategory && matchesQuery;
  });

  const grouped = CATEGORIES.map((category) => ({ category, items: filtered.filter((a) => a.category === category) })).filter(
    (group) => group.items.length > 0
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search assets…"
            className="input w-full pl-9 text-sm"
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {(["ALL", ...CATEGORIES] as const).map((category) => (
            <button
              key={category}
              type="button"
              onClick={() => setActiveCategory(category)}
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                activeCategory === category
                  ? "border-brand-500/50 bg-brand-500/20 text-brand-200"
                  : "border-white/10 bg-white/5 text-zinc-400 hover:bg-white/10"
              )}
            >
              {category === "ALL" ? "All" : category.charAt(0) + category.slice(1).toLowerCase()}
            </button>
          ))}
        </div>
      </div>

      {grouped.length === 0 ? (
        <EmptyState icon={<Package className="h-7 w-7" />} title="No assets found" description="Nothing matches this filter yet — real assets appear here as this production progresses." />
      ) : (
        <div className="space-y-5">
          {grouped.map((group) => (
            <div key={group.category}>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">
                {group.category.charAt(0) + group.category.slice(1).toLowerCase()} ({group.items.length})
              </p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {group.items.map((asset) => (
                  <AssetBrowserItem key={asset.id} asset={asset} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default AssetBrowser;
