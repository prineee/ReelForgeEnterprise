import { Clapperboard } from "lucide-react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { BackToDashboardLink } from "@/components/movie-studio/BackToDashboardLink";
import { EmptyState } from "@/components/ui/EmptyState";
import { SceneBrowserGrid } from "@/components/scene-browser/SceneBrowserGrid";
import { listSceneSummaries } from "@/services/infrastructure/SceneStudioFactory";
import { listMovieCatalog } from "@/services/infrastructure/MovieCatalogService";

/** Reads live server-side in-memory state (the shared ProductionContextRepository, via MovieCatalogService) on every request — must not be statically prerendered, or the scene list would freeze to whatever was resident during the build. */
export const dynamic = "force-dynamic";

/**
 * Scene Browser (Module 1) — every scene across every movie in the
 * current user's canonical Movie Catalog
 * (services/infrastructure/MovieCatalogService.ts, Sprint 16 Task 3).
 * Distinct from the Storyboard tab in app/movie-studio/workspace/[movieId]
 * — this is a cross-movie inspection surface, not a per-movie
 * reordering/planning tool.
 */
export default async function SceneBrowserPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const scenes = listSceneSummaries(user.id);
  const hasMovies = listMovieCatalog(user.id).length > 0;

  return (
    <div className="min-h-screen bg-surface px-4 py-8 text-white sm:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <BackToDashboardLink />
        <div>
          <h1 className="text-2xl font-bold text-white">Scene Studio</h1>
          <p className="mt-1 text-sm text-zinc-400">
            Inspect, review, and refine every scene before rendering — gathered from every movie in your Movie Catalog.
          </p>
        </div>

        {scenes.length === 0 ? (
          <EmptyState
            icon={<Clapperboard className="h-7 w-7" />}
            title={hasMovies ? "No scenes available" : "No movies created yet"}
            description={
              hasMovies
                ? "Open a movie's workspace to load its scenes here — they appear automatically once a movie reaches Scene Planning."
                : "Create your first movie to start planning scenes."
            }
          />
        ) : (
          <SceneBrowserGrid scenes={scenes} />
        )}
      </div>
    </div>
  );
}
