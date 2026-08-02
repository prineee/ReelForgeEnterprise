/**
 * LocationLibrary.ts
 *
 * Environments have no existing consistency-derivation engine to reuse —
 * services/ai/production/CharacterConsistencyEngine.ts is Character-only
 * (confirmed by inspection: it imports only Character, not Environment).
 * LocationConsistencyEngine below fills that real gap, deliberately
 * mirroring CharacterConsistencyEngine's shape (build-once-query-many
 * cache, deterministic summary composition, a reference prompt) so the
 * two stay conceptually parallel — but it is new code, not extracted from
 * an existing file, since there was nothing to extract from.
 *
 * No AI model calls, no network access, no randomness — pure string/data
 * composition over already-generated Environment data, same standard as
 * CharacterConsistencyEngine.
 */

import type { Environment, EntityId } from "../director/OutputSchema";
import type { MovieBlueprint } from "../director/DirectorEngine";

export class LocationConsistencyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LocationConsistencyError";
  }
}

export interface LocationReferenceEntry {
  uniqueLocationId: EntityId;
  masterDescription: string;
  atmosphereSummary: string;
  propsSummary: string;
  lightingSummary: string;
  colorPalette: string[];
  continuityNotes?: string;
  referencePrompt: string;
}

export interface LocationConsistencyPack {
  movieId: EntityId;
  locations: LocationReferenceEntry[];
}

export class LocationConsistencyEngine {
  private environmentCache = new Map<EntityId, Environment>();

  buildConsistencyPack(movie: MovieBlueprint): LocationConsistencyPack {
    this.environmentCache = new Map(movie.environments.map((env) => [env.id, env]));

    return {
      movieId: movie.movie.id,
      locations: movie.environments.map((env) => this.buildEntry(env)),
    };
  }

  composeReferencePrompt(environmentId: EntityId): string {
    const environment = this.environmentCache.get(environmentId);
    if (!environment) {
      throw new LocationConsistencyError(
        `Unknown environmentId: ${environmentId}. Call buildConsistencyPack() first.`
      );
    }
    return this.buildReferencePrompt(environment);
  }

  private buildEntry(environment: Environment): LocationReferenceEntry {
    return {
      uniqueLocationId: environment.id,
      masterDescription: `${environment.name} — ${environment.description}`,
      atmosphereSummary: `${environment.atmosphere}. Location: ${environment.location}. Architecture: ${environment.architecture}.`,
      propsSummary: environment.props.length > 0 ? `Notable props: ${environment.props.join(", ")}.` : "No notable props recorded.",
      lightingSummary: [
        environment.lighting ? `Lighting: ${environment.lighting}.` : "",
        environment.weather ? `Weather: ${environment.weather}.` : "",
        `Time of day: ${environment.timeOfDay}.`,
      ]
        .filter((part) => part.length > 0)
        .join(" "),
      colorPalette: environment.dominantColors,
      continuityNotes: environment.continuityNotes,
      referencePrompt: this.buildReferencePrompt(environment),
    };
  }

  private buildReferencePrompt(environment: Environment): string {
    const sections = [
      `LOCATION REFERENCE SHEET: ${environment.name}`,
      `${environment.name} — ${environment.description}`,
      `Location: ${environment.location}. Architecture: ${environment.architecture}.`,
      `Atmosphere: ${environment.atmosphere}.`,
      environment.props.length > 0 ? `Props: ${environment.props.join(", ")}.` : "",
      environment.dominantColors.length > 0 ? `Color palette: ${environment.dominantColors.join(", ")}.` : "",
      environment.continuityNotes ? `Continuity: ${environment.continuityNotes}.` : "",
      "Purpose: canonical visual reference for maintaining location consistency across every scene set here.",
    ].filter((section) => section.length > 0);

    return sections.join("\n");
  }
}

export interface LocationLibraryEntry {
  environmentId: EntityId;
  movieIds: string[];
  referenceEntry: LocationReferenceEntry;
  registrationCount: number;
}

/**
 * Same cross-movie cataloging role as CharacterLibrary, for locations.
 */
export class LocationLibrary {
  private readonly entries = new Map<EntityId, LocationLibraryEntry>();

  constructor(private readonly consistencyEngine: LocationConsistencyEngine = new LocationConsistencyEngine()) {}

  register(movie: MovieBlueprint): void {
    const pack = this.consistencyEngine.buildConsistencyPack(movie);

    for (const referenceEntry of pack.locations) {
      const environmentId = referenceEntry.uniqueLocationId;
      const existing = this.entries.get(environmentId);
      const movieIds = existing?.movieIds.includes(movie.movie.id)
        ? existing.movieIds
        : [...(existing?.movieIds ?? []), movie.movie.id];

      this.entries.set(environmentId, {
        environmentId,
        movieIds,
        referenceEntry,
        registrationCount: (existing?.registrationCount ?? 0) + 1,
      });
    }
  }

  get(environmentId: EntityId): LocationLibraryEntry | undefined {
    return this.entries.get(environmentId);
  }

  list(): readonly LocationLibraryEntry[] {
    return Array.from(this.entries.values());
  }

  listReused(): readonly LocationLibraryEntry[] {
    return this.list().filter((entry) => entry.movieIds.length > 1);
  }
}
