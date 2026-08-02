/**
 * DirectorEngine.ts
 *
 * Orchestrates the full directing pipeline — turning a raw user idea into a
 * complete MovieBlueprint — by calling each pipeline stage in sequence and
 * validating its output before passing it to the next stage:
 *
 *   StoryAnalyzer → CharacterDirector → EnvironmentDirector →
 *   CameraDirector → EmotionDirector → ScenePlanner → MovieBlueprint
 *
 * DirectorEngine performs orchestration only: it does not call a language
 * model itself, does not talk to any vendor SDK, and does not implement any
 * of the per-stage planning logic (that lives in each stage's own class).
 * All six stages are supplied via constructor injection — DirectorEngine
 * never constructs a stage itself, it only calls the instances it was
 * given, so composition (wiring each stage to a LanguageModelProvider)
 * happens at the call site, not inside this class.
 *
 * MovieBlueprint represents the completed *directing* phase only — the
 * Movie plus every entity produced along the way. It is intentionally
 * distinct from OutputSchema's MovieOutput, which represents the
 * *production/render* pipeline's result (RenderTasks, render status, final
 * video). DirectorEngine never fabricates render data: rendering has not
 * happened yet when a MovieBlueprint is produced.
 */

import type { StoryAnalyzer, StoryBlueprint, LanguageModelProvider } from "./StoryAnalyzer";
import type { CharacterDirector } from "./CharacterDirector";
import type { EnvironmentDirector } from "./EnvironmentDirector";
import type { CameraDirector } from "./CameraDirector";
import type { EmotionDirector } from "./EmotionDirector";
import type { ScenePlanner } from "./ScenePlanner";
import type {
  Movie,
  Character,
  Environment,
  CameraPlan,
  EmotionPlan,
  Scene,
  EntityId,
} from "./OutputSchema";
import { ContentRating } from "./OutputSchema";

/**
 * The completed output of the directing phase: a fully assembled Movie
 * plus every entity produced along the way. Rendering (RenderTask,
 * RenderStatus, MovieOutput) is a separate, later phase not covered here.
 */
export interface MovieBlueprint {
  movie: Movie;
  characters: Character[];
  environments: Environment[];
  cameraPlans: CameraPlan[];
  emotionPlans: EmotionPlan[];
  scenes: Scene[];
}

/**
 * Thrown when a pipeline stage fails or produces an unusable result.
 * `stage` names which stage failed; `cause` carries the original error,
 * when the failure originated from a stage's own class (e.g. a
 * StoryBlueprintParseError, CharacterParseError, etc.).
 */
export class DirectorEngineError extends Error {
  constructor(message: string, public readonly stage: string, public readonly cause?: unknown) {
    super(message);
    this.name = "DirectorEngineError";
  }
}

/**
 * Orchestrates StoryAnalyzer, CharacterDirector, EnvironmentDirector,
 * CameraDirector, EmotionDirector, and ScenePlanner into a single
 * end-to-end directing pipeline. Every dependency is constructor-injected;
 * DirectorEngine holds no knowledge of how any stage is implemented or
 * which language model provider backs it.
 */
export class DirectorEngine {
  constructor(
    private readonly storyAnalyzer: StoryAnalyzer,
    private readonly characterDirector: CharacterDirector,
    private readonly environmentDirector: EnvironmentDirector,
    private readonly cameraDirector: CameraDirector,
    private readonly emotionDirector: EmotionDirector,
    private readonly scenePlanner: ScenePlanner
  ) {}

  /**
   * Runs the full directing pipeline for a raw user idea and returns the
   * assembled MovieBlueprint. Each stage's output is validated before the
   * next stage runs; any stage failure is wrapped in a DirectorEngineError
   * identifying which stage failed.
   */
  async createMovieBlueprint(userIdea: string): Promise<MovieBlueprint> {
    console.log("ENTER:", "StoryAnalyzer");
    const story = await this.runStage("StoryAnalyzer", () =>
      this.storyAnalyzer.analyze(userIdea)
    );
    console.log("EXIT:", "StoryAnalyzer");
    this.assertDefined(story, "StoryAnalyzer");

    console.log("ENTER:", "CharacterDirector");
    const characters = await this.runStage("CharacterDirector", () =>
      this.characterDirector.extractCharacters(story)
    );
    console.log("RETURN CharacterDirector");
    console.log("EXIT:", "CharacterDirector");
    this.assertNonEmpty(characters, "CharacterDirector");

    console.log("ENTER:", "EnvironmentDirector");
    const environments = await this.runStage("EnvironmentDirector", () =>
      this.environmentDirector.extractEnvironments(story)
    );
    console.log("EXIT:", "EnvironmentDirector");
    this.assertNonEmpty(environments, "EnvironmentDirector");

    console.log("ENTER:", "CameraDirector");
    const cameraPlans = await this.runStage("CameraDirector", () =>
      this.cameraDirector.planCamera(story)
    );
    console.log("EXIT:", "CameraDirector");
    this.assertNonEmpty(cameraPlans, "CameraDirector");

    console.log("ENTER:", "EmotionDirector");
    const emotionPlans = await this.runStage("EmotionDirector", () =>
      this.emotionDirector.planEmotion(story, characters)
    );
    console.log("EXIT:", "EmotionDirector");
    this.assertNonEmpty(emotionPlans, "EmotionDirector");

    console.log("ENTER:", "ScenePlanner");
    const scenes = await this.runStage("ScenePlanner", () =>
      this.scenePlanner.planScenes(story, characters, environments, cameraPlans, emotionPlans)
    );
    console.log("EXIT:", "ScenePlanner");
    this.assertNonEmpty(scenes, "ScenePlanner");

    const movie = this.assembleMovie(
      story,
      characters,
      environments,
      cameraPlans,
      emotionPlans,
      scenes
    );

    console.log("RETURN createMovieBlueprint");
    return { movie, characters, environments, cameraPlans, emotionPlans, scenes };
  }

  /**
   * Runs a single pipeline stage, wrapping any failure (including a
   * stage's own typed parse error) in a DirectorEngineError that identifies
   * which stage failed.
   */
  private async runStage<T>(stage: string, run: () => Promise<T>): Promise<T> {
    try {
      return await run();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new DirectorEngineError(`Stage "${stage}" failed: ${message}`, stage, error);
    }
  }

  private assertDefined<T>(value: T, stage: string): asserts value is NonNullable<T> {
    if (value === undefined || value === null) {
      throw new DirectorEngineError(`Stage "${stage}" produced no output.`, stage);
    }
  }

  private assertNonEmpty<T>(value: T[], stage: string): void {
    if (!Array.isArray(value) || value.length === 0) {
      throw new DirectorEngineError(`Stage "${stage}" produced an empty result.`, stage);
    }
  }

  /**
   * Assembles the final Movie from the story blueprint and every pipeline
   * stage's output.
   *
   * Movie (OutputSchema v2.1) requires several fields no pipeline stage
   * produces, because no dedicated stage for them exists yet (poster/
   * thumbnail generation, localization, content rating, distribution
   * planning, music direction). Every one of those fields below is either:
   *   - a direct reuse of already-generated data (title, genres,
   *     estimatedDurationSeconds), or
   *   - a deterministic template built only from already-generated data
   *     (synopsis, posterPrompt, thumbnailPrompt, musicStyle), or
   *   - an explicit, honest "not decided yet" default (language, empty
   *     subtitleLanguage/exportFormats/distributionTargets,
   *     ContentRating.Unrated) — never invented render or business data.
   */
  private assembleMovie(
    story: StoryBlueprint,
    characters: Character[],
    environments: Environment[],
    cameraPlans: CameraPlan[],
    emotionPlans: EmotionPlan[],
    scenes: Scene[]
  ): Movie {
    const dominantEmotions = Array.from(new Set(emotionPlans.map((plan) => plan.dominantEmotion)));

    return {
      id: this.generateMovieId(story.title),
      title: story.title,
      logline: story.conflict,
      genres: story.genre,
      synopsis: `${story.theme} ${story.conflict} ${story.endingStyle}`.trim(),
      characters,
      environments,
      cameraPlans,
      emotionPlans,
      scenes,
      posterPrompt: `Movie poster for "${story.title}" — ${story.visualStyle} style. Genres: ${story.genre.join(", ")}.`,
      thumbnailPrompt: `Thumbnail for "${story.title}" — ${story.visualStyle} style. Genres: ${story.genre.join(", ")}.`,
      // No localization stage exists yet; "en" is a neutral default.
      language: "en",
      // No localization stage exists yet; none selected.
      subtitleLanguage: [],
      // No content-rating stage exists yet.
      contentRating: ContentRating.Unrated,
      // No distribution/export-planning stage exists yet.
      exportFormats: [],
      distributionTargets: [],
      musicStyle:
        dominantEmotions.length > 0
          ? `Score reflecting the scene-by-scene emotional arc: ${dominantEmotions.join(", ")}.`
          : "",
      estimatedDurationSeconds: story.estimatedDuration,
      createdAt: new Date().toISOString(),
    };
  }

  /**
   * Generates a stable, human-readable movie ID derived from the story's
   * title.
   */
  private generateMovieId(title: string): EntityId {
    const slug =
      title
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "") || "movie";

    return `movie-${slug}-${Date.now()}`;
  }
}
