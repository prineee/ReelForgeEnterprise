import { Camera, Mic2, NotebookText, Shirt, Smile } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { CharacterProfile } from "@/services/infrastructure/CharacterStudioFactory";

export interface CharacterDetailPanelProps {
  profile: CharacterProfile;
}

/**
 * Module 2 — every field reads directly from the real Character
 * (services/ai/director/OutputSchema.ts), already resolved by
 * CharacterStudioFactory.resolveCharacterProfile(). Speaking Style and
 * Character Notes are disclosed as "Not available yet" rather than
 * fabricated — no such field exists anywhere on Character today, the same
 * honesty convention components/storyboard/SceneDetailPanel.tsx and
 * ContinuityViewer.tsx already established for this codebase. Read-only.
 */
export function CharacterDetailPanel({ profile }: CharacterDetailPanelProps) {
  const { character, favoriteCameraShot } = profile;

  return (
    <div className="space-y-4 text-xs">
      <div>
        <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Biography</p>
        <p className="text-zinc-300">{character.description || "No biography recorded for this character yet."}</p>
      </div>

      <Section title="Personality Traits">
        {character.personality.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {character.personality.map((trait) => (
              <Badge key={trait} variant="secondary" className="!px-2 !py-0.5 text-[10px]">
                {trait}
              </Badge>
            ))}
          </div>
        ) : (
          <p className="text-zinc-500">No personality traits recorded.</p>
        )}
      </Section>

      <Section title="Speaking Style" icon={<NotebookText className="h-3 w-3" />}>
        <p className="text-zinc-500">Not available yet — no speaking-style field exists on Character today.</p>
      </Section>

      <Section title="Emotional Profile" icon={<Smile className="h-3 w-3" />}>
        <p className="text-zinc-300">{humanize(character.emotionalBaseline)} (default emotional baseline)</p>
      </Section>

      <Section title="Assigned Voice" icon={<Mic2 className="h-3 w-3" />}>
        <Row label="Voice" value={character.voiceProfile.voiceName ?? character.voiceProfile.id} />
        <Row label="Tone" value={character.voiceProfile.tone ?? "—"} />
      </Section>

      <Section title="Costume Presets" icon={<Shirt className="h-3 w-3" />}>
        {character.wardrobe.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {character.wardrobe.map((item) => (
              <Badge key={item} variant="secondary" className="!px-2 !py-0.5 text-[10px]">
                {item}
              </Badge>
            ))}
          </div>
        ) : (
          <p className="text-zinc-500">No costume presets recorded.</p>
        )}
      </Section>

      <Section title="Favorite Camera Style" icon={<Camera className="h-3 w-3" />}>
        <p className="text-zinc-300">
          {favoriteCameraShot
            ? `${humanize(favoriteCameraShot)} — the most frequently planned shot with this character as the camera's focus subject.`
            : "Not available — no planned shot has this character as its camera focus subject yet."}
        </p>
      </Section>

      <Section title="Character Notes">
        <p className="text-zinc-500">Not available yet — no freeform notes field exists on Character today.</p>
      </Section>
    </div>
  );
}

function Section({ title, icon, children }: { title: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1.5 inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
        {icon}
        {title}
      </p>
      {children}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-white/5 py-1">
      <span className="text-zinc-500">{label}</span>
      <span className="text-right text-zinc-300">{value}</span>
    </div>
  );
}

function humanize(value: string): string {
  return value.toLowerCase().replace(/_/g, " ");
}

export default CharacterDetailPanel;
