/**
 * MovieProductionService.ts
 *
 * The top-level movie production orchestrator: the single entry point that
 * drives a ProductionRequest through the director pipeline, reference image
 * generation, prompt composition, queued video generation, movie assembly,
 * and final rendering — exposing only the four methods a caller needs
 * (start, track progress, cancel, retry a stage).
 *
 * Every dependency is constructor-injected. All six stages are
 * implemented: runStoryPlanningStage() (Story Planning), runReferenceImageStage()
 * (Reference Image Generation), runScenePromptStage() (Scene Prompt
 * Generation), runVideoGenerationStage() (Scene Video Generation),
 * runMovieAssemblyStage() (Movie Assembly), and runFinalRenderingStage()
 * (Final Rendering — see that method's doc comment: it produces a render
 * manifest via FinalMovieRenderer, not an encoded video file, since no
 * real video-encoding pipeline exists in this codebase yet).
 * startProduction() runs all six and returns a completed ProductionResult.
 * getProgress() is implemented (see below). cancelProduction()/retryStage()
 * are still TODO scaffolds.
 *
 * Infrastructure note: all per-stage intermediate data now lives in an
 * injected ProductionContextRepository (services/infrastructure/
 * ProductionContextRepository.ts) rather than a private Map on this class.
 * This is what makes getProgress() meaningful across requests:
 * MovieProductionFactory injects the same repository instance into every
 * MovieProductionService it constructs, so a service built to handle a
 * later status-check request can see state a different service instance
 * wrote while handling an earlier start-production request. Each stage
 * still reads only the fields it depends on and writes only the field it
 * owns; the storage mechanism moved, the per-stage read/write ownership
 * didn't.
 *
 * Design note: runStoryPlanningStage() calls DirectorEngine's single
 * public method, createMovieBlueprint(userIdea) — it does not reach into
 * StoryAnalyzer or any other director-layer stage directly, and builds no
 * adapters. Because createMovieBlueprint() internally runs the entire
 * director pipeline (StoryAnalyzer → CharacterDirector →
 * EnvironmentDirector → CameraDirector → EmotionDirector → ScenePlanner)
 * in one call, this single orchestration-layer stage is what completes all
 * six of those ProductionStage values at once — IMPLEMENTED_STAGES below
 * reflects that. The resulting MovieBlueprint is cached in
 * ProductionContext.movieBlueprint, since MovieProductionContracts'
 * StageResult has no field for raw internal domain data by design (see
 * that file's header comment) — only ProductionArtifact (concrete,
 * URL-addressable assets), which a MovieBlueprint isn't.
 *
 * Design note: runReferenceImageStage() builds a CharacterConsistencyPack
 * (CharacterConsistencyEngine), derives prompts from it
 * (ReferenceImageGenerator, now a pure prompt-generation module — see its
 * file header), generates one image per prompt (ImagenService), and
 * uploads each through CloudinaryService. The resulting
 * UploadedReferenceAsset[] (characterId + assetId + url + the prompt
 * actually used + provider + generationTimeMs + optional
 * width/height/mimeType) is cached in ProductionContext.uploadedReferenceAssets
 * — internal production-context data, not yet part of the public
 * contracts. Unlike Stage 1, this stage DOES produce real, URL-addressable
 * assets, so — unlike Stage 1's empty artifacts array — its
 * StageResult.artifacts is populated with one ProductionArtifact (type
 * "IMAGE") per uploaded reference image.
 *
 * Design note: runScenePromptStage() calls
 * ScenePromptBuilder.buildSceneRequests(movie, referencePromptPlan) — per
 * that module's actual contract, it needs a ReferencePromptPlan (prompt
 * text), not the UploadedReferenceAsset[] cached by Stage 2 (which only
 * has uploaded URLs, no prompt text to recover). So this stage re-derives
 * a fresh ReferencePromptPlan via CharacterConsistencyEngine +
 * ReferenceImageGenerator (both pure, synchronous, no network/API calls —
 * cheap to recompute) and reads context.uploadedReferenceAssets only as a
 * precondition check that Stage 2 completed. The resulting
 * SceneGenerationRequest[] is cached in
 * ProductionContext.sceneGenerationRequests for later stages.
 *
 * Design note (Sprint 2 — Render Orchestrator integration):
 * runVideoGenerationStage() calls the injected RenderOrchestrator
 * directly, one renderAndWait() call per scene — it does not instantiate
 * VeoGenerator, build a provider adapter, or implement RenderQueue's
 * batching/polling/retry behavior itself. RenderOrchestrator.renderAndWait()
 * owns the submit -> poll -> download sequence (see RenderOrchestrator.ts);
 * this stage only translates its RenderRequest/RenderResult, exactly the
 * way it previously translated VeoRequest/VeoResponse. No provider
 * (LTX, Google, or any future GPU backend) or provider-specific object is
 * ever visible past RenderOrchestrator's boundary — this stage only ever
 * sees RenderResult. VeoService remains constructor-injected and fully
 * functional but is no longer what drives real generation; it is kept for
 * backwards compatibility (nothing else in this class currently reads
 * it). Handling multi-scene batching/queueing beyond one renderAndWait()
 * per scene is still explicitly RenderQueue's future responsibility, not
 * this stage's.
 *
 * Design note: runMovieAssemblyStage() calls MovieAssembler.assemble(movie,
 * batch), which needs a BatchGenerationResult (VideoGenerationResult[] with
 * sceneId/operationId/etc. per scene). Stage 4 only cached plain
 * GeneratedVideo[] (no sceneId, no operationId — VeoService.generateVideo()
 * bypasses the operation-based flow entirely). toBatchGenerationResult()
 * bridges this by zipping Stage 3's SceneGenerationRequest[] (has sceneId,
 * same array order as Stage 4's videos since they were built via
 * Promise.all(requests.map(...))) with Stage 4's GeneratedVideo[] into
 * synthetic VideoGenerationResult entries, using a locally-generated
 * operationId (no real provider operation exists to report) and
 * elapsedMs/averageRenderTimeMs of 0 (Stage 4 never tracked per-scene
 * timing, so 0 is honest rather than a fabricated number). This is pure
 * reshaping of already-cached data — not a new video/assembly decision.
 *
 * Design note: getProgress() has no per-stage StageResult history to read
 * (ProductionContext only ever stored each stage's final output data, not
 * a timestamped StageResult log), so it derives StageProgress for all 11
 * ProductionStage values from field presence alone: a stage is COMPLETED
 * if its owning context field is populated, otherwise QUEUED. startedAt/
 * completedAt are left unset on derived entries rather than fabricated,
 * since no real timestamp for them was ever recorded. currentStage is the
 * first not-yet-completed stage (what happens next), which reads more
 * usefully for a status endpoint than "the last stage that finished."
 */

import type {
  ProductionRequest,
  ProductionOptions,
  ProductionProgress,
  ProductionResult,
  ProductionArtifact,
  ProductionId,
  StageId,
  StageResult,
  StageProgress,
  ProductionWarning,
  ISODateTimeString,
} from "./MovieProductionContracts";
import { ProductionStage, ProductionStatus } from "./MovieProductionContracts";
import type { DirectorEngine, MovieBlueprint } from "../director/DirectorEngine";
import type { PromptComposer } from "../production/PromptComposer";
import type { CharacterConsistencyEngine } from "../production/CharacterConsistencyEngine";
import type { ReferenceImageGenerator, CharacterReferencePrompt } from "../production/ReferenceImageGenerator";
import type { ScenePromptBuilder, SceneGenerationRequest } from "../production/ScenePromptBuilder";
import type { GeminiService } from "../providers/google/GeminiService";
import type { ImagenService } from "../providers/google/ImagenService";
import type { VeoService, GeneratedVideo } from "../providers/google/VeoService";
import type { ElevenLabsService } from "../providers/audio/ElevenLabsService";
import type { CloudinaryService } from "../providers/storage/CloudinaryService";
import type { RenderQueue } from "../production/RenderQueue";
import type { RenderOrchestrator } from "../../rendering/RenderOrchestrator";
import type { BatchGenerationResult } from "../production/VeoGenerator";
import type { MovieAssembler, MovieAssemblyResult } from "../production/MovieAssembler";
import type { FinalMovieRenderer, RenderPlan } from "../production/FinalMovieRenderer";
import type {
  ProductionContextRepository,
  ProductionContext,
  UploadedReferenceAsset,
} from "../../infrastructure/ProductionContextRepository";

/**
 * Thrown by every MovieProductionService method until its orchestration
 * logic is implemented, and (once implemented) for genuine production
 * orchestration failures.
 */
export class MovieProductionServiceError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = "MovieProductionServiceError";
  }
}

/**
 * Every ProductionStage value, in pipeline order, paired with a function
 * that determines whether a given ProductionContext has completed it.
 * Used by both buildRemainingStageWarnings() (startProduction) and
 * getProgress() so the two stay consistent with each other.
 */
const STAGE_COMPLETION: ReadonlyArray<{
  stage: ProductionStage;
  isDone: (context: ProductionContext) => boolean;
}> = [
  { stage: ProductionStage.StoryAnalysis, isDone: (c) => c.movieBlueprint !== undefined },
  { stage: ProductionStage.CharacterDevelopment, isDone: (c) => c.movieBlueprint !== undefined },
  { stage: ProductionStage.EnvironmentDesign, isDone: (c) => c.movieBlueprint !== undefined },
  { stage: ProductionStage.CameraPlanning, isDone: (c) => c.movieBlueprint !== undefined },
  { stage: ProductionStage.EmotionPlanning, isDone: (c) => c.movieBlueprint !== undefined },
  { stage: ProductionStage.ScenePlanning, isDone: (c) => c.movieBlueprint !== undefined },
  {
    stage: ProductionStage.ReferenceImageGeneration,
    isDone: (c) => c.uploadedReferenceAssets !== undefined,
  },
  { stage: ProductionStage.PromptComposition, isDone: (c) => c.sceneGenerationRequests !== undefined },
  { stage: ProductionStage.VideoGeneration, isDone: (c) => c.generatedVideos !== undefined },
  { stage: ProductionStage.MovieAssembly, isDone: (c) => c.movieAssembly !== undefined },
  { stage: ProductionStage.FinalRendering, isDone: (c) => c.finalRenderPlan !== undefined },
];

/**
 * The ProductionStage values completed by the stages implemented so far —
 * every STAGE_COMPLETION entry; all eleven stages are implemented.
 */
const IMPLEMENTED_STAGES: readonly ProductionStage[] = STAGE_COMPLETION.map((entry) => entry.stage);

/**
 * The single entry point for driving a movie production end-to-end. Every
 * collaborator is constructor-injected. All six stages are implemented —
 * see the file-level comment above.
 */
export class MovieProductionService {
  constructor(
    private readonly directorEngine: DirectorEngine,
    private readonly promptComposer: PromptComposer,
    private readonly characterConsistencyEngine: CharacterConsistencyEngine,
    private readonly referenceImageGenerator: ReferenceImageGenerator,
    private readonly scenePromptBuilder: ScenePromptBuilder,
    private readonly geminiService: GeminiService,
    private readonly imagenService: ImagenService,
    private readonly veoService: VeoService,
    private readonly elevenLabsService: ElevenLabsService,
    private readonly cloudinaryService: CloudinaryService,
    private readonly renderQueue: RenderQueue,
    private readonly movieAssembler: MovieAssembler,
    private readonly finalMovieRenderer: FinalMovieRenderer,
    private readonly contextRepository: ProductionContextRepository,
    private readonly renderOrchestrator: RenderOrchestrator
  ) {}

  /**
   * Runs Stage 1 (Story Planning), Stage 2 (Reference Image Generation),
   * Stage 3 (Scene Prompt Generation), Stage 4 (Scene Video Generation),
   * Stage 5 (Movie Assembly), and Stage 6 (Final Rendering) and returns
   * the completed ProductionResult. All eleven ProductionStage values are
   * implemented, so buildRemainingStageWarnings() now always returns [] —
   * kept for symmetry/safety rather than removed outright.
   */
  async startProduction(
    request: ProductionRequest,
    options?: ProductionOptions
  ): Promise<ProductionResult> {
    console.log('[VERIFY] 4. MovieProductionService.startProduction entered') // TEMPORARY — remove after verification
    const startedAt = new Date().toISOString();

    const storyPlanningResult = await this.runStoryPlanningStage(request);
    const referenceImageResult = await this.runReferenceImageStage(request.productionId);
    const scenePromptResult = await this.runScenePromptStage(request.productionId);
    const videoGenerationResult = await this.runVideoGenerationStage(request.productionId);
    const movieAssemblyResult = await this.runMovieAssemblyStage(request.productionId);
    const finalRenderingResult = await this.runFinalRenderingStage(request.productionId);

    const completedAt = new Date().toISOString();

    return {
      productionId: request.productionId,
      status: ProductionStatus.Completed,
      artifacts: [
        ...storyPlanningResult.artifacts,
        ...referenceImageResult.artifacts,
        ...scenePromptResult.artifacts,
        ...videoGenerationResult.artifacts,
        ...movieAssemblyResult.artifacts,
        ...finalRenderingResult.artifacts,
      ],
      stageResults: [
        storyPlanningResult,
        referenceImageResult,
        scenePromptResult,
        videoGenerationResult,
        movieAssemblyResult,
        finalRenderingResult,
      ],
      warnings: this.buildRemainingStageWarnings(completedAt),
      startedAt,
      completedAt,
      totalDurationSeconds: this.secondsBetween(startedAt, completedAt),
    };
  }

  /**
   * Reports current progress for a production by deriving StageProgress
   * for every ProductionStage from its ProductionContext. See the
   * file-level design note for how completion and currentStage are
   * determined.
   */
  async getProgress(productionId: ProductionId): Promise<ProductionProgress> {
    const context = this.contextRepository.get(productionId);
    if (!context) {
      throw new MovieProductionServiceError(`No production found for productionId "${productionId}".`);
    }

    const stages: StageProgress[] = STAGE_COMPLETION.map(({ stage, isDone }) => {
      const done = isDone(context);
      const failedHere = context.failure?.stage === stage;
      return {
        stageId: `stage-${stage.toLowerCase()}`,
        stage,
        status: failedHere ? ProductionStatus.Failed : done ? ProductionStatus.Completed : ProductionStatus.Queued,
        percentComplete: done ? 100 : 0,
      };
    });

    const completedCount = stages.filter((stage) => stage.status === ProductionStatus.Completed).length;

    // A recorded failure always wins over the field-presence derivation
    // below — otherwise a failed production with nothing written yet
    // (e.g. Story Analysis itself failed) would report Queued forever,
    // which is exactly the "stuck at Story Analysis, 0%" symptom this
    // exists to prevent.
    if (context.failure) {
      return {
        productionId,
        overallStatus: ProductionStatus.Failed,
        overallPercentComplete: Math.round((completedCount / stages.length) * 100),
        currentStage: context.failure.stage,
        stages,
        updatedAt: new Date().toISOString(),
        error: context.failure.message,
      };
    }

    const overallStatus =
      completedCount === 0
        ? ProductionStatus.Queued
        : completedCount === stages.length
        ? ProductionStatus.Completed
        : ProductionStatus.InProgress;

    const firstIncomplete = stages.find((stage) => stage.status !== ProductionStatus.Completed);
    const currentStage = firstIncomplete?.stage ?? stages[stages.length - 1]?.stage;

    return {
      productionId,
      overallStatus,
      overallPercentComplete: Math.round((completedCount / stages.length) * 100),
      currentStage,
      stages,
      updatedAt: new Date().toISOString(),
    };
  }

  /**
   * Stage 1: Story Planning.
   *
   * Validates the request, calls DirectorEngine.createMovieBlueprint()
   * with the user's movie idea, writes the resulting MovieBlueprint into
   * this production's context, and returns this stage's StageResult.
   *
   * createMovieBlueprint() is the real Gemini-backed director pipeline
   * (StoryAnalyzer -> CharacterDirector -> EnvironmentDirector ->
   * CameraDirector -> EmotionDirector -> ScenePlanner), and its output —
   * the story, character roster, environment roster, camera plan, emotion
   * plan, and scene outline — is exactly what downstream consumers
   * (Workflow, Movie Library, Asset Manager) need surfaced as a real
   * artifact rather than staying buried in ProductionContext.movieBlueprint,
   * which nothing outside this class can read. ProductionArtifact.type
   * already has a "SCRIPT" value for precisely this (see
   * MovieProductionContracts.ts) — it was simply never populated. Encoded
   * as a data: URI the same way GoogleGenAIImagenClient already encodes
   * inline image bytes in MovieProductionFactory.ts, since the story
   * package has no separately-hosted URL of its own.
   */
  private async runStoryPlanningStage(request: ProductionRequest): Promise<StageResult> {
    console.log('[VERIFY] 5. runStoryPlanningStage entered') // TEMPORARY — remove after verification
    // TEMPORARY DIAGNOSTIC — trace only, Story Analysis path.
    console.log(`[TRACE][StoryAnalysis] runStoryPlanningStage() entered. productionId="${request.productionId}"`);

    this.validateRequest(request);

    const stageId = this.generateStageId(ProductionStage.StoryAnalysis);
    const startedAt = new Date().toISOString();

    // Register the production BEFORE the real (multi-stage, multi-second)
    // Gemini call below, not after it — callers (e.g. POST /api/movie/create)
    // already hand this productionId back to the client as soon as the
    // workflow is created, so GET /api/movie/status/[productionId] must be
    // able to find a context for it immediately, not only once
    // createMovieBlueprint() finishes. getOrCreate() is idempotent — the
    // second call below (once the blueprint is ready) returns this exact
    // same stored context rather than creating a duplicate.
    this.contextRepository.getOrCreate(request.productionId);

    let blueprint: MovieBlueprint;
    try {
      // TEMPORARY DIAGNOSTIC — trace only.
      console.log(`[TRACE][StoryAnalysis] before DirectorEngine.createMovieBlueprint(). productionId="${request.productionId}"`);
      blueprint = await this.directorEngine.createMovieBlueprint(request.userIdea);
      // TEMPORARY DIAGNOSTIC — trace only.
      console.log(
        `[TRACE][StoryAnalysis] after DirectorEngine.createMovieBlueprint() — resolved. productionId="${request.productionId}", ` +
          `title="${blueprint?.movie?.title}", characters=${blueprint?.characters?.length}, scenes=${blueprint?.scenes?.length}`
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      // TEMPORARY DIAGNOSTIC — trace only.
      console.error(`[TRACE][StoryAnalysis] after DirectorEngine.createMovieBlueprint() — THREW. productionId="${request.productionId}": ${message}`);

      // Record the failure on this production's context BEFORE rethrowing,
      // so getProgress() reports FAILED/StoryAnalysis/message instead of
      // leaving the dashboard reading QUEUED/0% forever — getOrCreate() is
      // idempotent and returns the same context registered above.
      const failedContext = this.contextRepository.getOrCreate(request.productionId);
      failedContext.failure = { stage: ProductionStage.StoryAnalysis, message };
      this.contextRepository.save(failedContext);

      throw new MovieProductionServiceError(
        `Story planning failed for production "${request.productionId}": ${message}`,
        error
      );
    }

    // TEMPORARY DIAGNOSTIC — trace only.
    console.log(`[TRACE][StoryAnalysis] before updating ProductionContext. productionId="${request.productionId}"`);
    const context = this.contextRepository.getOrCreate(request.productionId);
    context.movieBlueprint = blueprint;
    this.contextRepository.save(context);
    // TEMPORARY DIAGNOSTIC — trace only.
    console.log(
      `[TRACE][StoryAnalysis] after updating ProductionContext. productionId="${request.productionId}", ` +
        `movieBlueprint set=${context.movieBlueprint !== undefined}`
    );

    const completedAt = new Date().toISOString();

    return {
      stageId,
      stage: ProductionStage.StoryAnalysis,
      status: ProductionStatus.Completed,
      startedAt,
      completedAt,
      artifacts: [this.buildStoryPackageArtifact(request.productionId, blueprint, stageId, completedAt)],
      warnings: [],
    };
  }

  /**
   * Builds the real Story Package artifact from a freshly generated
   * MovieBlueprint: title/logline/genres/synopsis plus a reduced summary
   * of every character, environment, camera plan, emotion plan, and scene
   * — everything Step 1 of an AI-integration pass over this stage asks
   * for, taken directly from Gemini's real output, nothing fabricated.
   */
  private buildStoryPackageArtifact(
    productionId: ProductionId,
    blueprint: MovieBlueprint,
    stageId: StageId,
    createdAt: ISODateTimeString
  ): ProductionArtifact {
    const storyPackage = {
      title: blueprint.movie.title,
      logline: blueprint.movie.logline,
      genres: blueprint.movie.genres,
      synopsis: blueprint.movie.synopsis,
      characters: blueprint.characters.map((c) => ({
        id: c.id,
        name: c.name,
        description: c.description,
        personality: c.personality,
      })),
      environments: blueprint.environments.map((e) => ({
        id: e.id,
        name: e.name,
        description: e.description,
        location: e.location,
      })),
      cameraPlan: blueprint.cameraPlans.map((cp) => ({
        sceneNumber: cp.sceneNumber,
        shot: cp.shot,
        angle: cp.angle,
        cinematicPurpose: cp.cinematicPurpose,
      })),
      emotionPlan: blueprint.emotionPlans.map((ep) => ({
        sceneNumber: ep.sceneNumber,
        dominantEmotion: ep.dominantEmotion,
        intensity: ep.intensity,
        pacingNotes: ep.pacingNotes,
      })),
      sceneOutline: blueprint.scenes.map((s) => ({
        sceneNumber: s.sceneNumber,
        title: s.title,
        description: s.description,
      })),
    };

    const encoded = Buffer.from(JSON.stringify(storyPackage), "utf-8").toString("base64");

    return {
      artifactId: `${productionId}-story`,
      stageId,
      stage: ProductionStage.StoryAnalysis,
      type: "SCRIPT",
      url: `data:application/json;base64,${encoded}`,
      createdAt,
      metadata: {
        title: blueprint.movie.title,
        characterCount: blueprint.characters.length,
        environmentCount: blueprint.environments.length,
        sceneCount: blueprint.scenes.length,
      },
    };
  }

  /**
   * Stage 2: Reference Image Generation.
   *
   * Reads this production's context for its MovieBlueprint, builds a
   * CharacterConsistencyPack, derives reference-image prompts from it,
   * generates one image per prompt via ImagenService, uploads each via
   * CloudinaryService, writes the resulting UploadedReferenceAsset[] into
   * this production's context, and returns this stage's StageResult.
   */
  private async runReferenceImageStage(productionId: ProductionId): Promise<StageResult> {
    const context = this.getContext(productionId);
    if (!context.movieBlueprint) {
      throw new MovieProductionServiceError(
        `No MovieBlueprint found for production "${productionId}". runStoryPlanningStage() must complete first.`
      );
    }
    const movie = context.movieBlueprint;

    const stageId = this.generateStageId(ProductionStage.ReferenceImageGeneration);
    const startedAt = new Date().toISOString();

    let uploadedAssets: UploadedReferenceAsset[];
    try {
      const pack = this.characterConsistencyEngine.buildConsistencyPack(movie);
      const promptPlan = this.referenceImageGenerator.buildReferencePrompts(movie, pack);

      uploadedAssets = await Promise.all(
        promptPlan.prompts.map((entry) => this.generateAndUploadReferenceAsset(entry))
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new MovieProductionServiceError(
        `Reference image generation failed for production "${productionId}": ${message}`,
        error
      );
    }

    context.uploadedReferenceAssets = uploadedAssets;
    this.contextRepository.save(context);

    const completedAt = new Date().toISOString();

    const artifacts: ProductionArtifact[] = uploadedAssets.map((asset) => ({
      artifactId: asset.assetId,
      stageId,
      stage: ProductionStage.ReferenceImageGeneration,
      type: "IMAGE",
      url: asset.url,
      createdAt: completedAt,
      metadata: this.buildArtifactMetadata(asset),
    }));

    return {
      stageId,
      stage: ProductionStage.ReferenceImageGeneration,
      status: ProductionStatus.Completed,
      startedAt,
      completedAt,
      artifacts,
      warnings: [],
    };
  }

  /**
   * Generates one image for a character's reference prompt via
   * ImagenService and uploads it via CloudinaryService. Captures the
   * prompt actually used, the provider, and the wall-clock generation
   * time (Imagen call + Cloudinary upload) so buildArtifactMetadata() can
   * surface real values instead of leaving Asset Manager/Movie Library to
   * default them.
   */
  private async generateAndUploadReferenceAsset(
    entry: CharacterReferencePrompt
  ): Promise<UploadedReferenceAsset> {
    const startedAt = Date.now();
    const generatedImage = await this.imagenService.generateImage(entry.prompt);
    const uploadResult = await this.cloudinaryService.uploadAsset({ sourceUrl: generatedImage.url });
    const generationTimeMs = Date.now() - startedAt;

    return {
      characterId: entry.characterId,
      assetId: uploadResult.assetId,
      url: uploadResult.url,
      prompt: entry.prompt,
      provider: "IMAGEN",
      generationTimeMs,
      width: generatedImage.width,
      height: generatedImage.height,
      mimeType: generatedImage.mimeType,
    };
  }

  private buildArtifactMetadata(asset: UploadedReferenceAsset): Record<string, string | number | boolean> {
    const metadata: Record<string, string | number | boolean> = {
      characterId: asset.characterId,
      prompt: asset.prompt,
      provider: asset.provider,
      generationTimeMs: asset.generationTimeMs,
    };
    if (asset.width !== undefined) metadata.width = asset.width;
    if (asset.height !== undefined) metadata.height = asset.height;
    if (asset.mimeType !== undefined) metadata.mimeType = asset.mimeType;
    return metadata;
  }

  /**
   * Stage 3: Scene Prompt Generation.
   *
   * Reads this production's context for its MovieBlueprint and confirms
   * Stage 2 completed (uploadedReferenceAssets present), re-derives a
   * ReferencePromptPlan (see the file-level design note for why), builds
   * SceneGenerationRequest[] via ScenePromptBuilder, writes it into this
   * production's context, and returns this stage's StageResult.
   */
  private async runScenePromptStage(productionId: ProductionId): Promise<StageResult> {
    const context = this.getContext(productionId);
    if (!context.movieBlueprint) {
      throw new MovieProductionServiceError(
        `No MovieBlueprint found for production "${productionId}". runStoryPlanningStage() must complete first.`
      );
    }
    const movie = context.movieBlueprint;

    if (!context.uploadedReferenceAssets) {
      throw new MovieProductionServiceError(
        `No uploaded reference assets found for production "${productionId}". runReferenceImageStage() must complete first.`
      );
    }

    const stageId = this.generateStageId(ProductionStage.PromptComposition);
    const startedAt = new Date().toISOString();

    let requests: SceneGenerationRequest[];
    try {
      const pack = this.characterConsistencyEngine.buildConsistencyPack(movie);
      const promptPlan = this.referenceImageGenerator.buildReferencePrompts(movie, pack);
      const buildResult = this.scenePromptBuilder.buildSceneRequests(movie, promptPlan);
      requests = buildResult.requests;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new MovieProductionServiceError(
        `Scene prompt generation failed for production "${productionId}": ${message}`,
        error
      );
    }

    context.sceneGenerationRequests = requests;
    this.contextRepository.save(context);

    const completedAt = new Date().toISOString();

    return {
      stageId,
      stage: ProductionStage.PromptComposition,
      status: ProductionStatus.Completed,
      startedAt,
      completedAt,
      // No new asset was uploaded/stored for this stage — scene generation
      // requests are structured intermediate data (prompts + metadata),
      // not URL-addressable artifacts.
      artifacts: [],
      warnings: [],
    };
  }

  /**
   * Stage 4: Scene Video Generation.
   *
   * Reads this production's context for its SceneGenerationRequest[],
   * calls the injected VeoService once per scene (no VeoGenerator, no
   * adapter, no queueing — see the file-level design note), writes the
   * resulting GeneratedVideo[] into this production's context, and
   * returns this stage's StageResult.
   */
  private async runVideoGenerationStage(productionId: ProductionId): Promise<StageResult> {
    const context = this.getContext(productionId);
    if (!context.sceneGenerationRequests) {
      throw new MovieProductionServiceError(
        `No scene generation requests found for production "${productionId}". runScenePromptStage() must complete first.`
      );
    }
    const requests = context.sceneGenerationRequests;

    const stageId = this.generateStageId(ProductionStage.VideoGeneration);
    const startedAt = new Date().toISOString();

    let videos: GeneratedVideo[];
    try {
      videos = await Promise.all(requests.map((request) => this.generateSceneVideo(request)));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new MovieProductionServiceError(
        `Video generation failed for production "${productionId}": ${message}`,
        error
      );
    }

    context.generatedVideos = videos;
    this.contextRepository.save(context);

    const completedAt = new Date().toISOString();

    const artifacts: ProductionArtifact[] = videos.map((video, index) => ({
      artifactId: `${requests[index].sceneId}-video`,
      stageId,
      stage: ProductionStage.VideoGeneration,
      type: "VIDEO",
      url: video.url,
      createdAt: completedAt,
      metadata: this.buildVideoArtifactMetadata(requests[index], video),
    }));

    return {
      stageId,
      stage: ProductionStage.VideoGeneration,
      status: ProductionStatus.Completed,
      startedAt,
      completedAt,
      artifacts,
      warnings: [],
    };
  }

  /**
   * Generates one scene's video via the injected RenderOrchestrator.
   * renderAndWait() owns the submit -> poll -> download sequence and
   * returns a terminal RenderResult (COMPLETED with a videoUrl, or
   * FAILED) — this method's only job is translating that RenderResult
   * into the GeneratedVideo shape the rest of this stage (and
   * MovieAssembler downstream) already expects, the same translation
   * boundary VeoService.generateVideo() previously sat behind.
   */
  private async generateSceneVideo(request: SceneGenerationRequest): Promise<GeneratedVideo> {
    const result = await this.renderOrchestrator.renderAndWait({
      prompt: request.positivePrompt,
      negativePrompt: request.negativePrompt,
      aspectRatio: request.aspectRatio,
      durationSeconds: request.expectedDuration,
      quality: request.quality,
    });

    if (result.status !== "COMPLETED" || !result.videoUrl) {
      throw new MovieProductionServiceError(
        `Video generation failed for scene "${request.sceneId}" via provider "${result.provider}": ` +
          (result.error ?? `render ended with status ${result.status}`)
      );
    }

    return {
      url: result.videoUrl,
      thumbnailUrl: result.thumbnail,
      durationSeconds: result.duration,
      resolution: result.resolution,
    };
  }

  private buildVideoArtifactMetadata(
    request: SceneGenerationRequest,
    video: GeneratedVideo
  ): Record<string, string | number | boolean> {
    const metadata: Record<string, string | number | boolean> = {
      sceneId: request.sceneId,
      sceneNumber: request.sceneNumber,
    };
    if (video.durationSeconds !== undefined) metadata.durationSeconds = video.durationSeconds;
    if (video.resolution !== undefined) metadata.resolution = video.resolution;
    if (video.thumbnailUrl !== undefined) metadata.thumbnailUrl = video.thumbnailUrl;
    return metadata;
  }

  /**
   * Stage 5: Movie Assembly.
   *
   * Reads this production's context for its MovieBlueprint,
   * SceneGenerationRequest[], and GeneratedVideo[], reshapes the latter
   * two into a BatchGenerationResult (see the file-level design note for
   * why), calls MovieAssembler.assemble(), writes the resulting
   * MovieAssemblyResult into this production's context, and returns this
   * stage's StageResult.
   */
  private async runMovieAssemblyStage(productionId: ProductionId): Promise<StageResult> {
    const context = this.getContext(productionId);
    if (!context.movieBlueprint) {
      throw new MovieProductionServiceError(
        `No MovieBlueprint found for production "${productionId}". runStoryPlanningStage() must complete first.`
      );
    }
    const movie = context.movieBlueprint;

    if (!context.sceneGenerationRequests) {
      throw new MovieProductionServiceError(
        `No scene generation requests found for production "${productionId}". runScenePromptStage() must complete first.`
      );
    }
    const requests = context.sceneGenerationRequests;

    if (!context.generatedVideos) {
      throw new MovieProductionServiceError(
        `No generated scene videos found for production "${productionId}". runVideoGenerationStage() must complete first.`
      );
    }
    const videos = context.generatedVideos;

    const stageId = this.generateStageId(ProductionStage.MovieAssembly);
    const startedAt = new Date().toISOString();

    let assemblyResult: MovieAssemblyResult;
    try {
      const batch = this.toBatchGenerationResult(requests, videos);
      assemblyResult = this.movieAssembler.assemble(movie, batch);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new MovieProductionServiceError(
        `Movie assembly failed for production "${productionId}": ${message}`,
        error
      );
    }

    context.movieAssembly = assemblyResult;
    this.contextRepository.save(context);

    const completedAt = new Date().toISOString();

    return {
      stageId,
      stage: ProductionStage.MovieAssembly,
      status: ProductionStatus.Completed,
      startedAt,
      completedAt,
      // No new asset was uploaded/stored for this stage — the assembled
      // timeline is structured intermediate data (scene ordering and
      // duration statistics referencing already-uploaded video URLs), not
      // itself a new URL-addressable artifact.
      artifacts: [],
      warnings: [],
    };
  }

  /**
   * Stage 6: Final Rendering.
   *
   * Reads this production's context for its MovieAssemblyResult, calls
   * FinalMovieRenderer.prepareRender() to produce a RenderPlan (an ordered
   * render manifest: segments, resolved output encoding settings, and
   * statistics), writes it into this production's context, and returns
   * this stage's StageResult.
   *
   * FinalMovieRenderer is planning-only — no FFmpeg, no encoding, no file
   * I/O (see that file's header comment); no real video-encoding pipeline
   * exists anywhere in this codebase yet. The returned MOVIE artifact's
   * url is therefore the render manifest itself, encoded as a data: URI —
   * the same pattern Stage 1 already uses for its SCRIPT artifact in
   * buildStoryPackageArtifact(), since neither has a separately-hosted URL
   * of its own — not an encoded video file. A real encoder can consume
   * ProductionContext.finalRenderPlan later without this stage changing.
   */
  private async runFinalRenderingStage(productionId: ProductionId): Promise<StageResult> {
    const context = this.getContext(productionId);
    if (!context.movieAssembly) {
      throw new MovieProductionServiceError(
        `No MovieAssemblyResult found for production "${productionId}". runMovieAssemblyStage() must complete first.`
      );
    }
    const movieAssembly = context.movieAssembly;

    const stageId = this.generateStageId(ProductionStage.FinalRendering);
    const startedAt = new Date().toISOString();

    let renderPlan: RenderPlan;
    try {
      renderPlan = this.finalMovieRenderer.prepareRender(movieAssembly);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new MovieProductionServiceError(
        `Final rendering failed for production "${productionId}": ${message}`,
        error
      );
    }

    context.finalRenderPlan = renderPlan;
    this.contextRepository.save(context);

    const completedAt = new Date().toISOString();

    return {
      stageId,
      stage: ProductionStage.FinalRendering,
      status: ProductionStatus.Completed,
      startedAt,
      completedAt,
      artifacts: [this.buildRenderManifestArtifact(productionId, renderPlan, stageId, completedAt)],
      warnings: [],
    };
  }

  /**
   * Builds the MOVIE artifact for the render manifest — see
   * runFinalRenderingStage()'s doc comment for why this is the manifest
   * itself (encoded as a data: URI) rather than an encoded video file.
   */
  private buildRenderManifestArtifact(
    productionId: ProductionId,
    renderPlan: RenderPlan,
    stageId: StageId,
    createdAt: ISODateTimeString
  ): ProductionArtifact {
    const encoded = Buffer.from(JSON.stringify(renderPlan), "utf-8").toString("base64");

    return {
      artifactId: `${productionId}-render-plan`,
      stageId,
      stage: ProductionStage.FinalRendering,
      type: "MOVIE",
      url: `data:application/json;base64,${encoded}`,
      createdAt,
      metadata: {
        totalSegments: renderPlan.statistics.totalSegments,
        totalDurationSeconds: renderPlan.statistics.totalDurationSeconds,
        format: renderPlan.output.format,
        resolution: renderPlan.output.resolution,
      },
    };
  }

  /**
   * Reshapes Stage 3's SceneGenerationRequest[] and Stage 4's
   * GeneratedVideo[] into the BatchGenerationResult shape
   * MovieAssembler.assemble() expects. See the file-level design note for
   * why this reshaping is necessary and how operationId/timing fields are
   * filled in.
   */
  private toBatchGenerationResult(
    requests: SceneGenerationRequest[],
    videos: GeneratedVideo[]
  ): BatchGenerationResult {
    const completedAt = new Date().toISOString();

    const generatedVideos = requests.map((request, index) => {
      const video = videos[index];
      return {
        sceneId: request.sceneId,
        operationId: `${request.sceneId}-op`,
        videoUrl: video.url,
        thumbnailUrl: video.thumbnailUrl ?? "",
        duration: video.durationSeconds ?? request.expectedDuration,
        resolution: video.resolution ?? request.quality,
        completedAt,
      };
    });

    return {
      generatedVideos,
      failedOperations: [],
      statistics: {
        totalScenes: requests.length,
        completed: generatedVideos.length,
        failed: 0,
        elapsedMs: 0,
        averageRenderTimeMs: 0,
      },
    };
  }

  // ── Production context ──────────────────────────────────────────────

  /**
   * Returns the existing ProductionContext for a productionId via the
   * injected repository. Used by every stage after the first, which all
   * depend on data an earlier stage must have already written.
   */
  private getContext(productionId: ProductionId): ProductionContext {
    const context = this.contextRepository.get(productionId);
    if (!context) {
      throw new MovieProductionServiceError(
        `No production context found for production "${productionId}". runStoryPlanningStage() must complete first.`
      );
    }
    return context;
  }

  private validateRequest(request: ProductionRequest): void {
    if (!request.productionId || request.productionId.trim().length === 0) {
      throw new MovieProductionServiceError("ProductionRequest.productionId must be a non-empty string.");
    }
    if (!request.userId || request.userId.trim().length === 0) {
      throw new MovieProductionServiceError("ProductionRequest.userId must be a non-empty string.");
    }
    if (!request.userIdea || request.userIdea.trim().length === 0) {
      throw new MovieProductionServiceError("ProductionRequest.userIdea must be a non-empty string.");
    }
    if (!request.requestedAt || request.requestedAt.trim().length === 0) {
      throw new MovieProductionServiceError("ProductionRequest.requestedAt must be a non-empty string.");
    }
  }

  private buildRemainingStageWarnings(occurredAt: ISODateTimeString): ProductionWarning[] {
    return Object.values(ProductionStage)
      .filter((stage) => !IMPLEMENTED_STAGES.includes(stage))
      .map((stage) => ({
        stage,
        stageId: "PENDING",
        code: "STAGE_NOT_IMPLEMENTED",
        message: `TODO: the ${stage} stage is not implemented yet.`,
        occurredAt,
      }));
  }

  private generateStageId(stage: ProductionStage): StageId {
    return `stage-${stage.toLowerCase()}-${Date.now()}`;
  }

  private secondsBetween(startIso: ISODateTimeString, endIso: ISODateTimeString): number {
    return (new Date(endIso).getTime() - new Date(startIso).getTime()) / 1000;
  }

  /**
   * TODO: not implemented. Will cancel a running production.
   */
  async cancelProduction(productionId: ProductionId): Promise<void> {
    throw new MovieProductionServiceError(
      `TODO: cancelProduction() is not implemented yet. Cannot cancel production "${productionId}".`
    );
  }

  /**
   * TODO: not implemented. Will retry a single failed stage within a
   * production without re-running the stages that already succeeded.
   */
  async retryStage(productionId: ProductionId, stageId: StageId): Promise<void> {
    throw new MovieProductionServiceError(
      `TODO: retryStage() is not implemented yet. Cannot retry stage "${stageId}" for production "${productionId}".`
    );
  }
}