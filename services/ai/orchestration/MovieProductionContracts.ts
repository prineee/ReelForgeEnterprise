/**
 * MovieProductionContracts.ts
 *
 * The public API contract for the movie production pipeline: the stable
 * vocabulary a caller (an API route, a job runner, a UI) uses to request a
 * production, track its progress, and receive its result.
 *
 * This file is type-only. It contains no business logic, no orchestration,
 * no classes, and no imports — including no imports from the director
 * layer, the production layer, or any provider implementation. That
 * separation is deliberate: these contracts describe the pipeline's public
 * surface, and must stay stable even as internal types (MovieBlueprint,
 * RenderPlan, provider request/response shapes, etc.) change. No field
 * here is provider-specific or Movie-domain-specific — everything is
 * expressed in generic production/stage/artifact terms.
 */

/**
 * Opaque identifier for a single production (an end-to-end movie
 * generation request).
 */
export type ProductionId = string;

/**
 * Opaque identifier for a single stage execution within a production. Not
 * the same thing as ProductionStage: ProductionStage names which *kind* of
 * stage this is, StageId identifies *this particular run* of it (so a
 * retried stage gets a new StageId while keeping the same ProductionStage).
 */
export type StageId = string;

/**
 * ISO 8601 timestamp string (e.g. "2026-07-17T12:00:00.000Z").
 */
export type ISODateTimeString = string;

/**
 * The distinct phases a production moves through, from initial story
 * analysis through to the final rendered movie.
 */
export enum ProductionStage {
  StoryAnalysis = "STORY_ANALYSIS",
  CharacterDevelopment = "CHARACTER_DEVELOPMENT",
  EnvironmentDesign = "ENVIRONMENT_DESIGN",
  CameraPlanning = "CAMERA_PLANNING",
  EmotionPlanning = "EMOTION_PLANNING",
  ScenePlanning = "SCENE_PLANNING",
  ReferenceImageGeneration = "REFERENCE_IMAGE_GENERATION",
  PromptComposition = "PROMPT_COMPOSITION",
  VideoGeneration = "VIDEO_GENERATION",
  MovieAssembly = "MOVIE_ASSEMBLY",
  FinalRendering = "FINAL_RENDERING",
}

/**
 * The lifecycle status of a production, or of a single stage within one.
 */
export enum ProductionStatus {
  Queued = "QUEUED",
  InProgress = "IN_PROGRESS",
  Completed = "COMPLETED",
  Failed = "FAILED",
  Cancelled = "CANCELLED",
}

/**
 * Tunable, provider-agnostic knobs for a production run. Contains no
 * provider-specific settings (no model names, no vendor request shapes) —
 * only business-level preferences a caller can express regardless of which
 * backend ends up fulfilling them.
 */
export interface ProductionOptions {
  targetDurationSeconds?: number;
  maxScenes?: number;
  qualityTier?: "draft" | "standard" | "high";
  priority?: "low" | "normal" | "high";
}

/**
 * Everything required to start a movie generation request: who is asking,
 * what idea to turn into a movie, and how the run should be tuned.
 */
export interface ProductionRequest {
  productionId: ProductionId;
  userId: string;
  userIdea: string;
  options?: ProductionOptions;
  requestedAt: ISODateTimeString;
}

/**
 * The progress of a single stage execution within a production.
 */
export interface StageProgress {
  stageId: StageId;
  stage: ProductionStage;
  status: ProductionStatus;
  startedAt?: ISODateTimeString;
  completedAt?: ISODateTimeString;
  /** 0-100. */
  percentComplete: number;
  message?: string;
}

/**
 * A point-in-time progress snapshot for an entire production, aggregating
 * every stage's individual progress alongside the production's overall
 * status.
 */
export interface ProductionProgress {
  productionId: ProductionId;
  overallStatus: ProductionStatus;
  /** 0-100. */
  overallPercentComplete: number;
  currentStage?: ProductionStage;
  stages: StageProgress[];
  updatedAt: ISODateTimeString;
  /** Present only when overallStatus is Failed — the failing stage's error message. */
  error?: string;
}

/**
 * A single generated asset produced somewhere in the pipeline — a script,
 * an image, a video clip, an audio clip, the assembled movie, a thumbnail,
 * or similar.
 */
export interface ProductionArtifact {
  artifactId: string;
  stageId: StageId;
  stage: ProductionStage;
  type: "SCRIPT" | "IMAGE" | "VIDEO" | "AUDIO" | "MOVIE" | "THUMBNAIL";
  url: string;
  createdAt: ISODateTimeString;
  metadata?: Record<string, string | number | boolean>;
}

/**
 * A non-fatal diagnostic raised during a stage — something a caller should
 * know about, but that did not stop the production from continuing.
 */
export interface ProductionWarning {
  stageId: StageId;
  stage: ProductionStage;
  code: string;
  message: string;
  occurredAt: ISODateTimeString;
}

/**
 * A fatal diagnostic describing why a production or stage failed.
 * `stage`/`stageId` are optional because some failures (e.g. an invalid
 * ProductionRequest) occur before any stage begins executing.
 */
export interface ProductionErrorInfo {
  stageId?: StageId;
  stage?: ProductionStage;
  code: string;
  message: string;
  occurredAt: ISODateTimeString;
  /** Whether retrying the production (or this stage) could plausibly succeed. */
  recoverable: boolean;
}

/**
 * The outcome of a single completed (or failed) stage execution.
 */
export interface StageResult {
  stageId: StageId;
  stage: ProductionStage;
  status: ProductionStatus;
  startedAt: ISODateTimeString;
  completedAt: ISODateTimeString;
  artifacts: ProductionArtifact[];
  warnings: ProductionWarning[];
}

/**
 * The final outcome of a production: its overall status, every artifact it
 * produced, a per-stage breakdown, any warnings collected along the way,
 * and — if it failed — structured error information.
 */
export interface ProductionResult {
  productionId: ProductionId;
  status: ProductionStatus;
  artifacts: ProductionArtifact[];
  stageResults: StageResult[];
  warnings: ProductionWarning[];
  error?: ProductionErrorInfo;
  startedAt: ISODateTimeString;
  completedAt: ISODateTimeString;
  totalDurationSeconds: number;
}
