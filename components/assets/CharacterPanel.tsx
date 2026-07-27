import { Users } from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";
import type { Character } from "@/services/ai/director/OutputSchema";
import type { CharacterLibraryEntry } from "@/services/ai/asset-intelligence/CharacterLibrary";
import type { ContinuityIssue } from "@/services/ai/director-engine/SceneContinuityEngine";
import { CharacterCard } from "./CharacterCard";

export interface CharacterPanelProps {
  characters: Character[];
  libraryEntries: readonly CharacterLibraryEntry[];
  continuityIssues: readonly ContinuityIssue[];
}

/** Module 5 — reuses services/ai/asset-intelligence/CharacterLibrary.ts (Sprint 7) entries directly; no character data is recomputed here. */
export function CharacterPanel({ characters, libraryEntries, continuityIssues }: CharacterPanelProps) {
  if (characters.length === 0) {
    return <EmptyState icon={<Users className="h-7 w-7" />} title="No characters yet" description="Characters appear here once this movie reaches Character Development." />;
  }

  const libraryByCharacterId = new Map(libraryEntries.map((entry) => [entry.characterId, entry]));
  const characterIdsWithIssues = new Set(
    continuityIssues.filter((issue) => issue.type === "CHARACTER_GAP").map((issue) => issue.message.match(/"([^"]+)"/)?.[1])
  );

  return (
    <div className="space-y-3">
      {characters.map((character) => (
        <CharacterCard
          key={character.id}
          character={character}
          libraryEntry={libraryByCharacterId.get(character.id)}
          hasContinuityIssue={characterIdsWithIssues.has(character.name) || characterIdsWithIssues.has(character.id)}
        />
      ))}
    </div>
  );
}

export default CharacterPanel;
