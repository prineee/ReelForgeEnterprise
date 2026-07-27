import { EmptyState } from "@/components/ui/EmptyState";
import { Badge } from "@/components/ui/badge";
import { Users } from "lucide-react";
import type { CharacterPlacementData } from "@/services/infrastructure/SceneStudioFactory";

export interface CharacterPlacementPanelProps {
  placement: CharacterPlacementData;
}

/**
 * Module 5 — Speaking Order is read directly from Scene.dialogue's real
 * array order (already-authored screenplay data), not derived. Emotional
 * State is EmotionPlan.characterStates, already computed by the AI
 * Director pipeline (reused via SceneStudioFactory, never recomputed).
 * Screen Presence has no backing field anywhere on Scene or Character and
 * is disclosed as "Not planned yet" rather than approximated from
 * dialogue line count (which measures speaking, not visual prominence).
 */
export function CharacterPlacementPanel({ placement }: CharacterPlacementPanelProps) {
  if (placement.characters.length === 0) {
    return <EmptyState icon={<Users className="h-6 w-6" />} title="No characters in this scene" />;
  }

  return (
    <div className="overflow-hidden rounded-xl border border-white/10">
      <table className="w-full text-left text-xs">
        <thead className="bg-white/5 text-zinc-400">
          <tr>
            <th className="px-3 py-2">Character</th>
            <th className="px-3 py-2">Screen Presence</th>
            <th className="px-3 py-2">Speaking Order</th>
            <th className="px-3 py-2">Emotional State</th>
          </tr>
        </thead>
        <tbody>
          {placement.characters.map((character) => (
            <tr key={character.characterId} className="border-t border-white/5">
              <td className="px-3 py-2 font-semibold text-white">{character.name}</td>
              <td className="px-3 py-2">
                <Badge variant="secondary" className="!px-2 !py-0.5 text-[10px]">
                  Not planned yet
                </Badge>
              </td>
              <td className="px-3 py-2 text-zinc-400">{character.speakingOrder ? `#${character.speakingOrder}` : "—"}</td>
              <td className="px-3 py-2 text-zinc-400">
                {character.emotionalState
                  ? `${humanize(character.emotionalState.emotion)} (${character.emotionalState.intensity}/10)`
                  : "Not planned yet"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function humanize(value: string): string {
  return value.toLowerCase().replace(/_/g, " ");
}

export default CharacterPlacementPanel;
