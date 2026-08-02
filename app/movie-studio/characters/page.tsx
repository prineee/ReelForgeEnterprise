import { UsersRound } from "lucide-react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { BackToDashboardLink } from "@/components/movie-studio/BackToDashboardLink";
import { EmptyState } from "@/components/ui/EmptyState";
import { CharacterGridCard } from "@/components/character-card/CharacterGridCard";
import { listCharacterSummaries } from "@/services/infrastructure/CharacterStudioFactory";
import { listMovieCatalog } from "@/services/infrastructure/MovieCatalogService";

/** Reads live server-side in-memory state (the shared CharacterLibrary singleton) on every request — must not be statically prerendered at build time, or the character list would freeze to whatever was resident during the build. */
export const dynamic = "force-dynamic";

/**
 * Character Dashboard (Module 1) — every character resident in the shared
 * CharacterLibrary (services/ai/asset-intelligence/CharacterLibrary.ts),
 * scoped to movies in the current user's canonical Movie Catalog
 * (services/infrastructure/MovieCatalogService.ts, Sprint 16 Task 3).
 *
 * Distinct from the existing app/(dashboard)/characters/ page, which is a
 * separate, Supabase-backed character-preset tool for the older Reel/
 * Movie-Wizard flow — unrelated data, untouched by this sprint.
 */
export default async function CharacterStudioDashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const characters = listCharacterSummaries(user.id);
  const hasMovies = listMovieCatalog(user.id).length > 0;

  return (
    <div className="min-h-screen bg-surface px-4 py-8 text-white sm:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <BackToDashboardLink />
        <div>
          <h1 className="text-2xl font-bold text-white">Character Studio</h1>
          <p className="mt-1 text-sm text-zinc-400">
            Reusable AI characters from the Director Engine — automatically gathered from every movie workspace you&apos;ve opened this session.
          </p>
        </div>

        {characters.length === 0 ? (
          <EmptyState
            icon={<UsersRound className="h-7 w-7" />}
            title={hasMovies ? "No characters available" : "No movies created yet"}
            description={
              hasMovies
                ? "Open a movie's workspace to load its cast here — characters appear automatically once their movie reaches Character Development."
                : "Create your first movie to start building characters."
            }
          />
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {characters.map((summary) => (
              <CharacterGridCard key={summary.characterId} summary={summary} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
