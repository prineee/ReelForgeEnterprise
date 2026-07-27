/**
 * MovieProducer.ts
 *
 * Top-level facade for this directory, mirroring
 * services/ai/director-engine/AIDirectorEngine.ts's role one layer up
 * and services/ai/asset-intelligence/AssetManager.ts's role alongside it.
 * Composes an already-computed MovieBlueprint + StoryBlueprint (from
 * DirectorEngine, called elsewhere, out of scope) with an already-computed
 * AIDirectorPlan (AIDirectorEngine.plan()) and AssetCatalog
 * (AssetManager.catalog()) — recomputes neither. Every field this class
 * adds (genre guidance, act breakdown, cast plan, location plan,
 * production schedule, quality report, review) is new; every field it
 * reads off directorPlan/assetCatalog is reused, not duplicated.
 *
 * Produces a MovieProductionPlan — a planning artifact only. No scene is
 * rendered, no render job is submitted; ProductionPlanner's provider
 * preview is read-only (see ProductionPlanner.ts).
 *
 * No AI model calls, no network access, no randomness.
 */

import type { MovieBlueprint } from "../director/DirectorEngine";
import type { StoryBlueprint } from "../director/StoryAnalyzer";
import type { AIDirectorPlan } from "../director-engine/AIDirectorEngine";
import type { AssetCatalog } from "../asset-intelligence/AssetManager";

import { GenreEngine, type GenreGuidance } from "./GenreEngine";
import { ActGenerator, type ActBreakdown } from "./ActGenerator";
import { CharacterGenerator, type CastPlan } from "./CharacterGenerator";
import { LocationPlanner, type LocationPlan } from "./LocationPlanner";
import { ProductionPlanner, type ProductionSchedule } from "./ProductionPlanner";
import { QualityAnalyzer, type QualityReport } from "./QualityAnalyzer";
import { MovieReviewGenerator, type MovieReview } from "./MovieReviewGenerator";

export interface MovieProductionPlan {
  movieId: string;
  genre: GenreGuidance;
  acts: ActBreakdown;
  cast: CastPlan;
  locations: LocationPlan;
  schedule: ProductionSchedule;
  quality: QualityReport;
  review: MovieReview;
}

/**
 * Composes the seven sub-engines in this directory (Genre, Act, Character,
 * Location, Production, Quality, Review) into one MovieProductionPlan.
 * Each sub-engine is independently unit-testable; this class only wires
 * their inputs/outputs together — SOLID composition, no business logic
 * of its own.
 */
export class MovieProducer {
  constructor(
    private readonly genreEngine: GenreEngine = new GenreEngine(),
    private readonly actGenerator: ActGenerator = new ActGenerator(),
    private readonly characterGenerator: CharacterGenerator = new CharacterGenerator(),
    private readonly locationPlanner: LocationPlanner = new LocationPlanner(),
    private readonly productionPlanner: ProductionPlanner = new ProductionPlanner(),
    private readonly qualityAnalyzer: QualityAnalyzer = new QualityAnalyzer(),
    private readonly reviewGenerator: MovieReviewGenerator = new MovieReviewGenerator()
  ) {}

  produce(movieBlueprint: MovieBlueprint, story: StoryBlueprint, directorPlan: AIDirectorPlan, assetCatalog: AssetCatalog): MovieProductionPlan {
    const genre = this.genreEngine.plan(movieBlueprint.movie.genres, story);
    const acts = this.actGenerator.generate(directorPlan.storyPlan, story, genre);
    const cast = this.characterGenerator.plan(movieBlueprint, assetCatalog.characters);
    const locations = this.locationPlanner.plan(movieBlueprint, assetCatalog.locations);
    const schedule = this.productionPlanner.schedule(movieBlueprint, assetCatalog.dependencyGraph, directorPlan.timeline);
    const quality = this.qualityAnalyzer.analyze(movieBlueprint, directorPlan.continuity, cast, locations);
    const review = this.reviewGenerator.review(movieBlueprint, genre, quality, cast, locations);

    return {
      movieId: movieBlueprint.movie.id,
      genre,
      acts,
      cast,
      locations,
      schedule,
      quality,
      review,
    };
  }
}

export default MovieProducer;
