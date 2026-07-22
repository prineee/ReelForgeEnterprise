/**
 * FinalMovieContracts.ts
 *
 * The public API contract for the delivery layer: the stable vocabulary
 * describing what a final movie render needs (RenderPlan), how it's
 * tracked while running (RenderJob), and what a completed render produces
 * (RenderResult).
 *
 * This file is type-only. It contains no business logic, no rendering
 * implementation, no FFmpeg, no provider code, and no imports of any
 * kind — including no imports from the production layer's own
 * FinalMovieRenderer.ts, whose similarly-named local types (RenderPlan,
 * RenderSegment, RenderOptions) this file deliberately does not reuse.
 * Same reasoning as MovieProductionContracts.ts: this is the stable public
 * surface for the delivery layer, kept independent of internal
 * implementation types so those can change without breaking it.
 */

/**
 * Opaque identifier for a single render job.
 */
export type RenderId = string;

/**
 * Opaque identifier for a single segment within a render.
 */
export type SegmentId = string;

/**
 * ISO 8601 timestamp string (e.g. "2026-07-17T12:00:00.000Z").
 */
export type ISODateTimeString = string;

/**
 * The lifecycle status of a render job.
 */
export enum RenderStatus {
  Queued = "QUEUED",
  Preparing = "PREPARING",
  Encoding = "ENCODING",
  Completed = "COMPLETED",
  Failed = "FAILED",
  Cancelled = "CANCELLED",
}

/**
 * Scheduling priority for a render job.
 */
export enum RenderPriority {
  Low = "LOW",
  Normal = "NORMAL",
  High = "HIGH",
  Urgent = "URGENT",
}

/**
 * Video codec used to encode a render's output.
 */
export enum OutputCodec {
  H264 = "H264",
  H265 = "H265",
  VP9 = "VP9",
  AV1 = "AV1",
  ProRes = "PRORES",
}

/**
 * Container/export format for a render's output.
 */
export enum OutputFormat {
  MP4 = "MP4",
  MOV = "MOV",
  WebM = "WEBM",
  GIF = "GIF",
}

/**
 * One scene's video placed on the render timeline.
 */
export interface RenderSegment {
  segmentId: SegmentId;
  sceneNumber: number;
  sourceUrl: string;
  startTimeSeconds: number;
  endTimeSeconds: number;
  durationSeconds: number;
}

/**
 * Caller-supplied overrides for a render. Any field left unset falls back
 * to whatever default the delivery layer's implementation chooses.
 */
export interface RenderOptions {
  format?: OutputFormat;
  codec?: OutputCodec;
  resolution?: string;
  frameRate?: number;
  bitrateKbps?: number;
  audioCodec?: string;
  audioBitrateKbps?: number;
  priority?: RenderPriority;
}

/**
 * Everything required to render a movie: its ordered segments and every
 * output encoding setting. A complete, self-sufficient render
 * specification — nothing else is needed to produce a RenderResult from
 * this plan.
 */
export interface RenderPlan {
  renderId: RenderId;
  movieId: string;
  segments: RenderSegment[];
  format: OutputFormat;
  codec: OutputCodec;
  resolution: string;
  frameRate: number;
  bitrateKbps: number;
  audioCodec: string;
  audioBitrateKbps: number;
  totalDurationSeconds: number;
  priority: RenderPriority;
  createdAt: ISODateTimeString;
  /** Pre-render estimate produced by FinalMovieRenderer, if computed. */
  estimatedOutputSizeBytes?: number;
  /** Pre-render estimate produced by FinalMovieRenderer, if computed. */
  estimatedRenderTimeMs?: number;
}

/**
 * Aggregate statistics for a render.
 */
export interface RenderStatistics {
  totalSegments: number;
  totalDurationSeconds: number;
  averageSegmentDurationSeconds: number;
  encodingTimeMs: number;
  outputSizeBytes: number;
}

/**
 * A non-fatal diagnostic raised during a render — something a caller
 * should know about, but that did not stop the render from completing.
 */
export interface RenderWarning {
  renderId: RenderId;
  segmentId?: SegmentId;
  code: string;
  message: string;
  occurredAt: ISODateTimeString;
}

/**
 * A fatal diagnostic describing why a render failed. segmentId is
 * optional because some failures (e.g. an invalid RenderPlan) occur
 * before any segment is processed.
 */
export interface RenderErrorInfo {
  renderId: RenderId;
  segmentId?: SegmentId;
  code: string;
  message: string;
  occurredAt: ISODateTimeString;
  /** Whether retrying the render could plausibly succeed. */
  recoverable: boolean;
}

/**
 * The completed, encoded movie produced by a render.
 */
export interface RenderResult {
  renderId: RenderId;
  movieId: string;
  status: RenderStatus;
  outputUrl: string;
  thumbnailUrl?: string;
  format: OutputFormat;
  codec: OutputCodec;
  resolution: string;
  frameRate: number;
  durationSeconds: number;
  fileSizeBytes: number;
  statistics: RenderStatistics;
  warnings: RenderWarning[];
  error?: RenderErrorInfo;
  completedAt: ISODateTimeString;
}

/**
 * A render job tracked through its lifecycle, from being queued to
 * (once finished) carrying its RenderResult or RenderErrorInfo.
 */
export interface RenderJob {
  renderId: RenderId;
  plan: RenderPlan;
  status: RenderStatus;
  /** 0-100. */
  progressPercent: number;
  attempts: number;
  queuedAt: ISODateTimeString;
  startedAt?: ISODateTimeString;
  completedAt?: ISODateTimeString;
  result?: RenderResult;
  error?: RenderErrorInfo;
}
