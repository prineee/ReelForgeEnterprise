import Link from "next/link";
import { UserCircle2, Mic2, Film, ShieldCheck, ShieldAlert } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { CharacterSummary } from "@/services/infrastructure/CharacterStudioFactory";

const ROLE_VARIANT: Record<NonNullable<CharacterSummary["role"]>, "primary" | "info" | "secondary"> = {
  LEAD: "primary",
  SUPPORTING: "info",
  MINOR: "secondary",
};

const ROLE_LABEL: Record<NonNullable<CharacterSummary["role"]>, string> = {
  LEAD: "Lead",
  SUPPORTING: "Supporting",
  MINOR: "Minor",
};

export interface CharacterGridCardProps {
  summary: CharacterSummary;
}

/** Every field reads from CharacterStudioFactory.listCharacterSummaries() — real Character/CharacterLibrary/CharacterGenerator data, no placeholders except the portrait (no per-character portrait image exists anywhere in the backend, same honest-gap convention as SceneCard's thumbnail). */
export function CharacterGridCard({ summary }: CharacterGridCardProps) {
  return (
    <Link href={`/movie-studio/characters/${summary.characterId}`}>
      <Card hover className="flex h-full flex-col overflow-hidden">
        <div className="relative flex aspect-square w-full shrink-0 flex-col items-center justify-center border-b border-white/10 bg-gradient-to-br from-brand-900/60 to-purple-950/60">
          <UserCircle2 className="h-14 w-14 text-white/30" />
          {summary.role && (
            <div className="absolute left-2 top-2">
              <Badge variant={ROLE_VARIANT[summary.role]} className="!px-2 !py-0.5 text-[10px]">
                {ROLE_LABEL[summary.role]}
              </Badge>
            </div>
          )}
          <div className="absolute right-2 top-2">
            {summary.hasContinuityIssue ? (
              <Badge variant="danger" className="!px-2 !py-0.5 text-[10px]">
                <ShieldAlert className="mr-1 h-3 w-3" /> Issue
              </Badge>
            ) : (
              <Badge variant="success" className="!px-2 !py-0.5 text-[10px]">
                <ShieldCheck className="mr-1 h-3 w-3" /> OK
              </Badge>
            )}
          </div>
        </div>

        <div className="space-y-2 p-4">
          <p className="truncate text-sm font-semibold text-white">{summary.name}</p>

          <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-zinc-400">
            <span className="truncate">Gender: {summary.gender ?? "—"}</span>
            <span className="truncate">Age: {summary.age ?? "—"}</span>
            <span className="inline-flex items-center gap-1 truncate">
              <Mic2 className="h-3.5 w-3.5 shrink-0" /> {summary.voiceName ?? "—"}
            </span>
            <span className="inline-flex items-center gap-1 truncate">
              <Film className="h-3.5 w-3.5 shrink-0" /> {summary.movieCount} movie{summary.movieCount === 1 ? "" : "s"}
            </span>
          </div>
        </div>
      </Card>
    </Link>
  );
}

export default CharacterGridCard;
