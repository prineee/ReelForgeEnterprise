/**
 * FinalMovieRenderer.ts
 *
 * Produces a render manifest (RenderPlan) from an already-assembled movie
 * timeline: validates the timeline and segment ordering, builds render
 * segments, resolves output encoding settings, and computes render
 * statistics. Produces a manifest only — no FFmpeg, no video encoding, no
 * file I/O. A real encoder consumes the returned RenderPlan elsewhere.
 */

import type { MovieAssemblyResult } from "./MovieAssembler";

const SUPPORTED_FORMATS = ["MP4", "MOV", "WEBM", "GIF"] as const;
type SupportedFormat = (typeof SUPPORTED_FORMATS)[number];

const DEFAULT_FORMAT: SupportedFormat = "MP4";
const DEFAULT_RESOLUTION = "1080x1920";
const DEFAULT_CODEC = "H.264";
const DEFAULT_FRAME_RATE = 30;
const DEFAULT_BITRATE_KBPS = 8000;
const DEFAULT_AUDIO_CODEC = "AAC";
const DEFAULT_AUDIO_BITRATE_KBPS = 192;
const DURATION_TOLERANCE_SECONDS = 0.01;

/**
 * One scene's video placed on the render timeline.
 */
export interface RenderSegment {
  sceneId: string;
  sceneNumber: number;
  sourceUrl: string;
  startTimeSeconds: number;
  endTimeSeconds: number;
  durationSeconds: number;
}

/**
 * Resolved output encoding settings for the final render.
 */
export interface RenderOutput {
  format: string;
  resolution: string;
  codec: string;
  frameRate: number;
  bitrateKbps: number;
  audioCodec: string;
  audioBitrateKbps: number;
}

/**
 * Aggregate statistics for a render plan.
 */
export interface RenderStatistics {
  totalSegments: number;
  totalDurationSeconds: number;
  averageSegmentDurationSeconds: number;
  /** Deterministic estimate from (video + audio bitrate) × duration — not a real encode. */
  estimatedOutputSizeMB: number;
}

/**
 * Caller-supplied overrides for output encoding settings. Any field left
 * unset falls back to a fixed, documented default.
 */
export interface RenderOptions {
  format?: string;
  resolution?: string;
  codec?: string;
  frameRate?: number;
  bitrateKbps?: number;
  audioCodec?: string;
  audioBitrateKbps?: number;
}

/**
 * The complete render manifest: ordered segments, resolved output
 * settings, and statistics. Contains no encoded media — it's a plan for a
 * real encoder to execute elsewhere.
 */
export interface RenderPlan {
  movieId: string;
  segments: RenderSegment[];
  output: RenderOutput;
  statistics: RenderStatistics;
}

/**
 * Thrown when a MovieAssemblyResult's timeline or segment ordering fails
 * validation, or an unsupported export format is requested.
 */
export class FinalMovieRendererError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = "FinalMovieRendererError";
  }
}

/**
 * Turns an assembled movie timeline into a render manifest. Pure planning
 * — no rendering implementation, no FFmpeg, no provider SDK, no file I/O.
 */
export class FinalMovieRenderer {
  /**
   * Validates the movie timeline and segment ordering, then builds and
   * returns the render manifest.
   */
  prepareRender(movie: MovieAssemblyResult, options?: RenderOptions): RenderPlan {
    this.validateTimeline(movie);
    this.validateSegmentOrdering(movie);

    const segments = this.buildSegments(movie);
    const totalDurationSeconds = segments.reduce((sum, segment) => sum + segment.durationSeconds, 0);
    const averageSegmentDurationSeconds =
      segments.length > 0 ? totalDurationSeconds / segments.length : 0;

    const output = this.resolveOutput(options);
    const estimatedOutputSizeMB = this.estimateOutputSizeMB(totalDurationSeconds, output);

    return {
      movieId: movie.movieId,
      segments,
      output,
      statistics: {
        totalSegments: segments.length,
        totalDurationSeconds,
        averageSegmentDurationSeconds,
        estimatedOutputSizeMB,
      },
    };
  }

  // ── Validation ────────────────────────────────────────────────────────

  private validateTimeline(movie: MovieAssemblyResult): void {
    if (!movie.timeline || movie.timeline.scenes.length === 0) {
      throw new FinalMovieRendererError("MovieAssemblyResult has an empty timeline.");
    }
    if (movie.timeline.totalDurationSeconds <= 0) {
      throw new FinalMovieRendererError(
        "MovieAssemblyResult.timeline.totalDurationSeconds must be positive."
      );
    }

    const summedDuration = movie.timeline.scenes.reduce(
      (sum, scene) => sum + (scene.endTimeSeconds - scene.startTimeSeconds),
      0
    );
    if (Math.abs(summedDuration - movie.timeline.totalDurationSeconds) > DURATION_TOLERANCE_SECONDS) {
      throw new FinalMovieRendererError(
        `Timeline duration mismatch: scenes sum to ${summedDuration}s but totalDurationSeconds is ${movie.timeline.totalDurationSeconds}s.`
      );
    }
  }

  /**
   * Validates scene numbers are strictly increasing, no scene ID repeats,
   * every segment has positive duration, and the timeline has no gaps or
   * overlaps between consecutive scenes.
   */
  private validateSegmentOrdering(movie: MovieAssemblyResult): void {
    const scenes = movie.timeline.scenes;

    const seenSceneIds = new Set<string>();
    for (const scene of scenes) {
      if (seenSceneIds.has(scene.sceneId)) {
        throw new FinalMovieRendererError(`Duplicate sceneId in timeline: ${scene.sceneId}`);
      }
      seenSceneIds.add(scene.sceneId);
    }

    for (let i = 0; i < scenes.length; i++) {
      const scene = scenes[i];

      if (scene.endTimeSeconds <= scene.startTimeSeconds) {
        throw new FinalMovieRendererError(
          `Scene ${scene.sceneId} has a non-positive duration (start ${scene.startTimeSeconds}s, end ${scene.endTimeSeconds}s).`
        );
      }

      if (i > 0) {
        const previous = scenes[i - 1];

        if (scene.sceneNumber <= previous.sceneNumber) {
          throw new FinalMovieRendererError(
            `Scene ordering is not strictly increasing: scene ${previous.sceneId} (#${previous.sceneNumber}) is followed by ${scene.sceneId} (#${scene.sceneNumber}).`
          );
        }

        if (Math.abs(scene.startTimeSeconds - previous.endTimeSeconds) > DURATION_TOLERANCE_SECONDS) {
          throw new FinalMovieRendererError(
            `Timeline gap or overlap between scene ${previous.sceneId} (ends ${previous.endTimeSeconds}s) and scene ${scene.sceneId} (starts ${scene.startTimeSeconds}s).`
          );
        }
      }
    }
  }

  // ── Segment / output construction ───────────────────────────────────────

  private buildSegments(movie: MovieAssemblyResult): RenderSegment[] {
    return movie.timeline.scenes.map((scene) => ({
      sceneId: scene.sceneId,
      sceneNumber: scene.sceneNumber,
      sourceUrl: scene.videoUrl,
      startTimeSeconds: scene.startTimeSeconds,
      endTimeSeconds: scene.endTimeSeconds,
      durationSeconds: scene.endTimeSeconds - scene.startTimeSeconds,
    }));
  }

  private resolveOutput(options?: RenderOptions): RenderOutput {
    return {
      format: this.resolveFormat(options?.format),
      resolution: options?.resolution ?? DEFAULT_RESOLUTION,
      codec: options?.codec ?? DEFAULT_CODEC,
      frameRate: options?.frameRate ?? DEFAULT_FRAME_RATE,
      bitrateKbps: options?.bitrateKbps ?? DEFAULT_BITRATE_KBPS,
      audioCodec: options?.audioCodec ?? DEFAULT_AUDIO_CODEC,
      audioBitrateKbps: options?.audioBitrateKbps ?? DEFAULT_AUDIO_BITRATE_KBPS,
    };
  }

  private resolveFormat(requested: string | undefined): string {
    if (requested === undefined) {
      return DEFAULT_FORMAT;
    }

    const normalized = requested.toUpperCase();
    if (!SUPPORTED_FORMATS.includes(normalized as SupportedFormat)) {
      throw new FinalMovieRendererError(
        `Unsupported export format: "${requested}". Supported formats: ${SUPPORTED_FORMATS.join(", ")}.`
      );
    }
    return normalized;
  }

  private estimateOutputSizeMB(totalDurationSeconds: number, output: RenderOutput): number {
    const totalBitrateKbps = output.bitrateKbps + output.audioBitrateKbps;
    const totalBits = totalBitrateKbps * 1000 * totalDurationSeconds;
    const totalBytes = totalBits / 8;
    return totalBytes / (1024 * 1024);
  }
}
