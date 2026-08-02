import { AlertTriangle, Gauge, Globe2, Mic2 } from "lucide-react";
import type { CharacterVoiceProfile } from "@/services/infrastructure/CharacterStudioFactory";

export interface VoicePreviewPanelProps {
  voice?: CharacterVoiceProfile;
}

/**
 * Module 6 — VoicePlanner.plan() is called for real (via
 * CharacterStudioFactory.getCharacterVoiceProfile()) to confirm this
 * character's real assignment + surface any real VoicePlanIssue for
 * them; VoicePlan only carries the characterId -> voiceProfileId mapping,
 * so the full VoiceProfile (language/pitch/speed) is read from
 * Character.voiceProfile — the same object that id points to, not a
 * duplicate. Accent has no field anywhere on VoiceProfile — disclosed,
 * not guessed. No audio is generated or played here.
 */
export function VoicePreviewPanel({ voice }: VoicePreviewPanelProps) {
  if (!voice) {
    return <p className="text-xs text-zinc-500">No production data available for this character yet.</p>;
  }

  const { character, assignedVoiceProfileId, issues } = voice;
  const profile = character.voiceProfile;

  return (
    <div className="space-y-4 text-xs">
      <div className="space-y-1.5">
        <Row icon={<Mic2 className="h-3 w-3" />} label="Assigned Voice" value={profile.voiceName ?? profile.id} />
        <Row icon={<Globe2 className="h-3 w-3" />} label="Language" value={profile.language ?? "—"} />
        <Row label="Accent" value="Not available — no accent field exists on VoiceProfile today." muted />
        <Row icon={<Gauge className="h-3 w-3" />} label="Speaking Speed" value={profile.speed !== undefined ? `${profile.speed}x` : "—"} />
        <Row label="Tone" value={profile.tone ?? "—"} />
        <Row label="Pitch" value={profile.pitch !== undefined ? profile.pitch.toString() : "—"} />
      </div>

      {assignedVoiceProfileId !== profile.id && (
        <p className="flex items-center gap-1.5 text-amber-400">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" /> VoicePlanner's assignment doesn't match this character's own voiceProfile id.
        </p>
      )}

      {issues.length > 0 && (
        <div>
          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Voice Plan Issues</p>
          <ul className="space-y-1">
            {issues.map((issue, i) => (
              <li key={i} className="flex items-start gap-1.5 text-amber-400">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> Scene {issue.sceneNumber}: {issue.message}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function Row({ label, value, icon, muted }: { label: string; value: string; icon?: React.ReactNode; muted?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-white/5 py-1">
      <span className="inline-flex items-center gap-1.5 text-zinc-500">
        {icon}
        {label}
      </span>
      <span className={muted ? "text-right text-zinc-500" : "text-right text-zinc-300"}>{value}</span>
    </div>
  );
}

export default VoicePreviewPanel;
