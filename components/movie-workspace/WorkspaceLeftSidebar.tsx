import { Users, MapPin, Music2, Mic2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/EmptyState";
import type { Character } from "@/services/ai/director/OutputSchema";
import type { CharacterLibraryEntry } from "@/services/ai/asset-intelligence/CharacterLibrary";
import type { LocationLibraryEntry } from "@/services/ai/asset-intelligence/LocationLibrary";
import type { MusicPlan } from "@/services/ai/asset-intelligence/MusicPlanner";
import type { VoicePlan } from "@/services/ai/asset-intelligence/VoicePlanner";
import type { ContinuityIssue } from "@/services/ai/director-engine/SceneContinuityEngine";
import { CharacterPanel } from "@/components/assets/CharacterPanel";
import { WorkspaceTabs } from "./WorkspaceTabs";

export interface WorkspaceLeftSidebarProps {
  characters: Character[];
  characterLibraryEntries: readonly CharacterLibraryEntry[];
  continuityIssues: readonly ContinuityIssue[];
  locations: readonly LocationLibraryEntry[];
  musicPlan: MusicPlan;
  voicePlan: VoicePlan;
}

/** Left sidebar tabs: Assets/Characters/Locations/Music/Voices (Module 2) — Characters reuses components/assets/CharacterPanel.tsx (Module 5) directly rather than re-rendering character data a second way. */
export function WorkspaceLeftSidebar({ characters, characterLibraryEntries, continuityIssues, locations, musicPlan, voicePlan }: WorkspaceLeftSidebarProps) {
  const characterById = new Map(characters.map((c) => [c.id, c]));

  return (
    <WorkspaceTabs
      tabs={[
        {
          id: "characters",
          label: "Characters",
          icon: <Users className="h-3.5 w-3.5" />,
          content: <CharacterPanel characters={characters} libraryEntries={characterLibraryEntries} continuityIssues={continuityIssues} />,
        },
        {
          id: "locations",
          label: "Locations",
          icon: <MapPin className="h-3.5 w-3.5" />,
          content:
            locations.length === 0 ? (
              <EmptyState icon={<MapPin className="h-6 w-6" />} title="No locations yet" />
            ) : (
              <div className="space-y-2">
                {locations.map((entry) => (
                  <Card key={entry.environmentId} className="p-3">
                    <p className="text-sm font-semibold text-white">{entry.referenceEntry.masterDescription.split(" — ")[0]}</p>
                    <p className="mt-1 line-clamp-2 text-xs text-zinc-400">{entry.referenceEntry.atmosphereSummary}</p>
                    {entry.movieIds.length > 1 && <p className="mt-1 text-xs text-brand-300">Reused in {entry.movieIds.length} productions</p>}
                  </Card>
                ))}
              </div>
            ),
        },
        {
          id: "music",
          label: "Music",
          icon: <Music2 className="h-3.5 w-3.5" />,
          content:
            musicPlan.cues.length === 0 ? (
              <EmptyState icon={<Music2 className="h-6 w-6" />} title="No music plan yet" />
            ) : (
              <div className="space-y-2">
                <p className="text-xs text-zinc-500">Overall style: {musicPlan.overallStyle}</p>
                {musicPlan.cues.map((cue) => (
                  <Card key={cue.sceneId} className="p-3">
                    <p className="text-sm font-semibold text-white">Scene {cue.sceneNumber}</p>
                    <p className="mt-1 text-xs text-zinc-400">{cue.cue.moodTags?.join(", ")}</p>
                    <p className="mt-1 text-[10px] uppercase tracking-wide text-zinc-600">{cue.source === "EXISTING" ? "Director-authored" : "Derived plan"}</p>
                  </Card>
                ))}
              </div>
            ),
        },
        {
          id: "voices",
          label: "Voices",
          icon: <Mic2 className="h-3.5 w-3.5" />,
          content:
            Object.keys(voicePlan.assignmentsByCharacter).length === 0 ? (
              <EmptyState icon={<Mic2 className="h-6 w-6" />} title="No voice assignments yet" />
            ) : (
              <div className="space-y-2">
                {Object.entries(voicePlan.assignmentsByCharacter).map(([characterId, voiceProfileId]) => (
                  <Card key={characterId} className="p-3">
                    <p className="text-sm font-semibold text-white">{characterById.get(characterId)?.name ?? characterId}</p>
                    <p className="mt-1 text-xs text-zinc-400">{voiceProfileId}</p>
                  </Card>
                ))}
                {voicePlan.issues.length > 0 && <p className="text-xs text-amber-400">{voicePlan.issues.length} scene(s) missing a voice assignment.</p>}
              </div>
            ),
        },
      ]}
    />
  );
}

export default WorkspaceLeftSidebar;
