import { User, Mic2, Shirt, Smile, ShieldCheck, ShieldAlert, Repeat } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { Character } from "@/services/ai/director/OutputSchema";
import type { CharacterLibraryEntry } from "@/services/ai/asset-intelligence/CharacterLibrary";

export interface CharacterCardProps {
  character: Character;
  libraryEntry?: CharacterLibraryEntry;
  hasContinuityIssue: boolean;
}

/**
 * Every field reuses services/ai/asset-intelligence/CharacterLibrary.ts
 * (Sprint 7, itself wrapping services/ai/director-engine/CharacterMemory.ts,
 * Sprint 6) and the real Character entity — no new consistency/continuity
 * logic lives in this component.
 */
export function CharacterCard({ character, libraryEntry, hasContinuityIssue }: CharacterCardProps) {
  return (
    <Card className="p-4">
      <div className="flex items-start gap-3">
        {/* Portrait placeholder — Character has no dedicated portrait image field; real reference images (when uploaded) appear in the Asset Browser instead of being faked here. */}
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-600/40 to-purple-700/40 border border-white/10">
          <User className="h-6 w-6 text-white/50" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <p className="truncate text-sm font-semibold text-white">{character.name}</p>
            {hasContinuityIssue ? (
              <Badge variant="danger" className="!px-2 !py-0.5 text-[10px]">
                <ShieldAlert className="mr-1 h-3 w-3" /> Issue
              </Badge>
            ) : (
              <Badge variant="success" className="!px-2 !py-0.5 text-[10px]">
                <ShieldCheck className="mr-1 h-3 w-3" /> Consistent
              </Badge>
            )}
          </div>
          <p className="mt-0.5 line-clamp-2 text-xs text-zinc-400">{character.description}</p>

          <div className="mt-2 space-y-1 text-xs text-zinc-400">
            <p className="inline-flex items-center gap-1.5">
              <Mic2 className="h-3.5 w-3.5 shrink-0" />
              {character.voiceProfile.voiceName ?? character.voiceProfile.id}
            </p>
            <p className="inline-flex items-center gap-1.5">
              <Shirt className="h-3.5 w-3.5 shrink-0" />
              {character.wardrobe.length > 0 ? character.wardrobe.join(", ") : "No signature wardrobe recorded"}
            </p>
            <p className="inline-flex items-center gap-1.5">
              <Smile className="h-3.5 w-3.5 shrink-0" />
              {humanize(character.emotionalBaseline)} baseline
            </p>
            {libraryEntry && libraryEntry.movieIds.length > 1 && (
              <p className="inline-flex items-center gap-1.5 text-brand-300">
                <Repeat className="h-3.5 w-3.5 shrink-0" />
                Reused across {libraryEntry.movieIds.length} productions
              </p>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}

function humanize(value: string): string {
  return value.toLowerCase().replace(/_/g, " ");
}

export default CharacterCard;
