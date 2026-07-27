import { Accessibility, ImageIcon, PersonStanding, Shirt, SmilePlus, UserCircle2 } from "lucide-react";
import type { Character } from "@/services/ai/director/OutputSchema";

export interface VisualAppearancePanelProps {
  character: Character;
}

const CATEGORIES = [
  { label: "Portrait", icon: UserCircle2 },
  { label: "Full Body", icon: PersonStanding },
  { label: "Expressions", icon: SmilePlus },
  { label: "Wardrobe", icon: Shirt },
  { label: "Accessories", icon: Accessibility },
] as const;

/**
 * Module 5 — no per-category (portrait/full-body/expression/wardrobe/
 * accessory) image field exists anywhere on Character or ReferenceImage
 * (OutputSchema.ts) — ReferenceImage only carries an optional angle/
 * description, not a category. Rather than guess a categorization the
 * data model doesn't support, each bucket below is an honest placeholder
 * (same convention as SceneCard's thumbnail placeholder), structured so a
 * future image-generation feature can populate each slot without a
 * layout change. Any real reference images the character already has are
 * shown separately, unmodified, below.
 */
export function VisualAppearancePanel({ character }: VisualAppearancePanelProps) {
  return (
    <div className="space-y-4">
      <div>
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Visual Appearance Slots</p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {CATEGORIES.map(({ label, icon: Icon }) => (
            <div
              key={label}
              className="flex aspect-square flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-white/10 bg-white/[0.02] text-center"
            >
              <Icon className="h-6 w-6 text-white/25" />
              <span className="text-[11px] text-zinc-500">{label}</span>
              <span className="text-[10px] text-zinc-600">Not generated yet</span>
            </div>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
          Reference Images ({character.referenceImages.length})
        </p>
        {character.referenceImages.length === 0 ? (
          <p className="text-xs text-zinc-500">No reference images generated for this character yet.</p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {character.referenceImages.map((image) => (
              <div key={image.id} className="overflow-hidden rounded-xl border border-white/10 bg-white/[0.02]">
                {image.url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={image.url} alt={image.description ?? character.name} className="aspect-square w-full object-cover" />
                ) : (
                  <div className="flex aspect-square w-full items-center justify-center">
                    <ImageIcon className="h-6 w-6 text-white/25" />
                  </div>
                )}
                {(image.angle || image.description) && (
                  <p className="truncate px-2 py-1 text-[10px] text-zinc-500">{image.angle ?? image.description}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default VisualAppearancePanel;
