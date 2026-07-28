/**
 * MovieCatalogService.ts
 *
 * The one canonical "which movies exist" enumeration (Sprint 16, Task 3).
 * Character Studio, Scene Studio, Render Center, and Movie Library each
 * grew their own way to answer that question — CharacterLibrary/
 * LocationLibrary movieId unions, RenderJobManager projectIds, the
 * WorkflowEngine registry — none of them a real movie list, all of them
 * inconsistent with each other (a movie with no render jobs yet was
 * invisible to Render Center; a movie whose workspace was never opened
 * was invisible to Character/Scene Studio). This file replaces all of
 * that: it reads directly off ProductionContextRepository.list() (the
 * repository every one of those features already resolves individual
 * movies through) and every feature now enumerates through this one
 * function instead of re-deriving its own notion of "which movies exist."
 *
 * Still in-memory, still scoped to this server process's lifetime — see
 * ProductionContextRepository's own file header. This file does not add
 * persistence; it removes the duplication among features that already
 * had partial, inconsistent ways of listing movies. Adding real
 * cross-restart persistence is a larger, separate change (a database-
 * backed ProductionContextRepository implementation), intentionally out
 * of scope here.
 *
 * Scoped by userId (ProductionContext.userId, captured at production
 * creation time — see MovieProductionService.runStoryPlanningStage) so
 * one shared catalog does not mean one user can see another user's
 * movies.
 */

import { getSharedProductionContextRepository } from "./MovieProductionFactory";
import type { ProductionContext } from "./ProductionContextRepository";
import type { Genre } from "../ai/director/OutputSchema";

export interface MovieCatalogEntry {
  movieId: string;
  title: string;
  logline: string;
  genres: Genre[];
  createdAt: string;
}

type CatalogableContext = ProductionContext & { movieBlueprint: NonNullable<ProductionContext["movieBlueprint"]> };

/** A context only becomes a real, browsable "movie" once Story Analysis has produced a MovieBlueprint — earlier-stage contexts exist (see ProductionContextRepository) but have nothing yet worth surfacing in a catalog. */
function isCatalogable(context: ProductionContext): context is CatalogableContext {
  return context.movieBlueprint !== undefined;
}

/**
 * Every movie owned by `userId`. Newest first. This is the single
 * enumeration every feature listed above now shares.
 *
 * Reads ProductionContextRepository.list(), an in-memory Map iteration —
 * cheap enough that no additional cross-request caching is added here;
 * adding one would risk showing a stale catalog right after a movie is
 * created. Callers should still call this once per request rather than
 * once per rendered item.
 */
export function listMovieCatalog(userId: string): MovieCatalogEntry[] {
  return getSharedProductionContextRepository()
    .list()
    .filter(isCatalogable)
    .filter((context) => context.userId === userId)
    .map((context): MovieCatalogEntry => ({
      movieId: context.productionId,
      title: context.movieBlueprint.movie.title,
      logline: context.movieBlueprint.movie.logline,
      genres: context.movieBlueprint.movie.genres,
      createdAt: context.movieBlueprint.movie.createdAt,
    }))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** The bare id set for `userId`'s movies — what most callers actually need, to filter their own existing per-movie logic (characters, scenes, render jobs) down to movies this user owns. */
export function listOwnedMovieIds(userId: string): Set<string> {
  return new Set(listMovieCatalog(userId).map((entry) => entry.movieId));
}
