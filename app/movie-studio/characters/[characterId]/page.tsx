import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Film, ImageIcon, Info, ShieldAlert, UserCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { CharacterStudioTabs } from "@/components/character-studio/CharacterStudioTabs";
import { CharacterDetailPanel } from "@/components/character-detail/CharacterDetailPanel";
import { MovieUsagePanel } from "@/components/character-detail/MovieUsagePanel";
import { CharacterContinuityViewer } from "@/components/character-detail/CharacterContinuityViewer";
import { VisualAppearancePanel } from "@/components/character-detail/VisualAppearancePanel";
import { resolveCharacterProfile, getCharacterMovieUsage, getCharacterContinuity } from "@/services/infrastructure/CharacterStudioFactory";

const ROLE_LABEL: Record<string, string> = { LEAD: "Lead", SUPPORTING: "Supporting", MINOR: "Minor" };

/**
 * Character Studio detail screen — composes Modules 2-8 as tabs over one
 * already-resolved CharacterProfile (CharacterStudioFactory.ts). Every
 * module's panel is added here as its own sprint milestone; this file
 * grows one tab per module rather than each module inventing its own page.
 */
export default async function CharacterDetailPage({ params }: { params: Promise<{ characterId: string }> }) {
  const { characterId } = await params;
  const profile = resolveCharacterProfile(characterId);
  if (!profile) notFound();
  const movieUsage = getCharacterMovieUsage(characterId);
  const continuity = getCharacterContinuity(characterId);

  return (
    <div className="min-h-screen bg-surface px-4 py-8 text-white sm:px-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <div>
          <Link href="/movie-studio/characters" className="inline-flex items-center gap-1.5 text-sm text-zinc-400 hover:text-white">
            <ArrowLeft className="h-4 w-4" /> Character Studio
          </Link>
          <div className="mt-3 flex items-center gap-4">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-gradient-to-br from-brand-900/60 to-purple-950/60">
              <UserCircle2 className="h-8 w-8 text-white/30" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-bold text-white">{profile.character.name}</h1>
                {profile.role && (
                  <Badge variant="primary" className="!px-2 !py-0.5 text-[10px]">
                    {ROLE_LABEL[profile.role]}
                  </Badge>
                )}
              </div>
              <p className="mt-1 text-sm text-zinc-400">
                Primary production: {profile.primaryMovieTitle} · Used in {profile.libraryEntry.movieIds.length} movie
                {profile.libraryEntry.movieIds.length === 1 ? "" : "s"}
              </p>
            </div>
          </div>
        </div>

        <CharacterStudioTabs
          tabs={[
            {
              id: "overview",
              label: "Overview",
              icon: <Info className="h-3.5 w-3.5" />,
              content: <CharacterDetailPanel profile={profile} />,
            },
            {
              id: "usage",
              label: "Movie Usage",
              icon: <Film className="h-3.5 w-3.5" />,
              content: <MovieUsagePanel usage={movieUsage} />,
            },
            {
              id: "continuity",
              label: "Continuity",
              icon: <ShieldAlert className="h-3.5 w-3.5" />,
              content: <CharacterContinuityViewer continuity={continuity} />,
            },
            {
              id: "appearance",
              label: "Visual Appearance",
              icon: <ImageIcon className="h-3.5 w-3.5" />,
              content: <VisualAppearancePanel character={profile.character} />,
            },
          ]}
        />
      </div>
    </div>
  );
}
