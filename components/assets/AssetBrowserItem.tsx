import { Image as ImageIcon, Video, Music2, Mic2, Sparkles, Volume2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export type AssetCategory = "IMAGE" | "VIDEO" | "AUDIO" | "MUSIC" | "VOICE" | "EFFECT";

export interface BrowserAsset {
  id: string;
  category: AssetCategory;
  label: string;
  subtitle?: string;
  url?: string;
  /** FILE = a real generated/uploaded asset with a real URL. PLAN = planning data (a music cue, a voice assignment, a preset) — never presented as if it were a generated file. */
  kind: "FILE" | "PLAN";
}

const CATEGORY_ICON: Record<BrowserAsset["category"], typeof ImageIcon> = {
  IMAGE: ImageIcon,
  VIDEO: Video,
  AUDIO: Volume2,
  MUSIC: Music2,
  VOICE: Mic2,
  EFFECT: Sparkles,
};

export function AssetBrowserItem({ asset }: { asset: BrowserAsset }) {
  const Icon = CATEGORY_ICON[asset.category];

  return (
    <Card className="p-3">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/5 border border-white/10 text-zinc-300">
          <Icon className="h-4.5 w-4.5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-white">{asset.label}</p>
          {asset.subtitle && <p className="truncate text-xs text-zinc-500">{asset.subtitle}</p>}
        </div>
        <Badge variant={asset.kind === "FILE" ? "success" : "secondary"} className="!px-2 !py-0.5 text-[10px] shrink-0">
          {asset.kind === "FILE" ? "Asset" : "Plan"}
        </Badge>
      </div>
      {asset.url && (
        <a href={asset.url} target="_blank" rel="noreferrer" className="mt-2 block truncate text-xs text-brand-400 hover:underline">
          {asset.url}
        </a>
      )}
    </Card>
  );
}

export default AssetBrowserItem;
