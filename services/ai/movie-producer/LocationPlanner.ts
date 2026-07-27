/**
 * LocationPlanner.ts
 *
 * Location *authoring* already exists and is LLM-backed —
 * services/ai/director/EnvironmentDirector.ts (same Director-trio pattern
 * as CharacterDirector), called inside DirectorEngine.createMovieBlueprint(),
 * out of this sprint's scope. Location *cataloging* (cross-movie reuse
 * tracking, consistency reference sheets) already exists too —
 * services/ai/asset-intelligence/LocationLibrary.ts, already computed as
 * part of AssetCatalog.locations. This class authors nothing and
 * recalculates no consistency data — it only aggregates already-produced
 * Scene/Environment data (which environments are actually used, how many
 * scenes are set in each) and reads LocationLibrary's cross-movie reuse
 * signal.
 *
 * No AI model calls, no network access, no randomness.
 */

import type { EntityId, Environment } from "../director/OutputSchema";
import type { MovieBlueprint } from "../director/DirectorEngine";
import type { LocationLibraryEntry } from "../asset-intelligence/LocationLibrary";

export interface PlannedLocation {
  environmentId: EntityId;
  name: string;
  sceneCount: number;
  isReusedFromPriorMovie: boolean;
  continuityNotesPresent: boolean;
}

export interface LocationPlan {
  movieId: EntityId;
  locations: PlannedLocation[];
  distinctLocationCount: number;
  reusedLocationCount: number;
}

/** Aggregates MovieBlueprint.environments against real scene usage and CharacterLibrary-style cross-movie reuse. Authors nothing. */
export class LocationPlanner {
  plan(movie: MovieBlueprint, locationLibrary: readonly LocationLibraryEntry[]): LocationPlan {
    const libraryByEnvironmentId = new Map(locationLibrary.map((entry) => [entry.environmentId, entry]));

    const locations = movie.environments.map((environment) =>
      this.toPlannedLocation(environment, movie, libraryByEnvironmentId)
    );

    return {
      movieId: movie.movie.id,
      locations,
      distinctLocationCount: locations.length,
      reusedLocationCount: locations.filter((location) => location.isReusedFromPriorMovie).length,
    };
  }

  private toPlannedLocation(
    environment: Environment,
    movie: MovieBlueprint,
    libraryByEnvironmentId: Map<EntityId, LocationLibraryEntry>
  ): PlannedLocation {
    const libraryEntry = libraryByEnvironmentId.get(environment.id);

    return {
      environmentId: environment.id,
      name: environment.name,
      sceneCount: movie.scenes.filter((scene) => scene.environmentId === environment.id).length,
      isReusedFromPriorMovie: (libraryEntry?.movieIds.length ?? 0) > 1,
      continuityNotesPresent: Boolean(environment.continuityNotes),
    };
  }
}

export default LocationPlanner;
