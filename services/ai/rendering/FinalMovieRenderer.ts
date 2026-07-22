/**
 * FinalMovieRenderer.ts
 *
 * Delivery-layer render planner: validates an assembled movie timeline and
 * produces a RenderPlan against the FinalMovieContracts public contract.
 * No dependencies — constructed with none, calls nothing external.
 *
 * This is a separate implementation from the production layer's own
 * FinalMovieRenderer.ts (services/ai/production/FinalMovieRenderer.ts),
 * which predates and is independent of the FinalMovieContracts public
 * surface — see that contract file's header for why the two aren't
 * unified. This file imports only MovieAssemblyResult and
 * FinalMovieContracts, per the delivery layer's scope.
 *
 * estimatedOutputSizeBytes/estimatedRenderTimeMs are deterministic
 * pre-render estimates: output size from (video + audio bitrate) ×
 * duration, render time from a fixed encode-throughput assumption. Both
 * are real formulas over real plan data, not guesses — and now that
 * RenderPlan has fields for them, they're not discarded.
 */

import type { MovieAssemblyResult } from "../production/MovieAssembler";
import type { RenderPlan, RenderSegment, RenderOptions } from "./FinalMovieContracts";
import { OutputFormat, OutputCodec, RenderPriority } from "./FinalMovieContracts";

const DEFAULT_FORMAT = OutputFormat.MP4;
const DEFAULT_CODEC = OutputCodec.H264;
const DEFAULT_RESOLUTION = "1080x1920";
const DEFAULT_FRAME_RATE = 30;
const DEFAULT_BITRATE_KBPS = 8000;
const DEFAULT_AUDIO_CODEC = "AAC";
const DEFAULT_AUDIO_BITRATE_KBPS = 192;
const DEFAULT_PRIORITY = RenderPriority.Normal;
const DURATION_TOLERANCE_SECONDS = 0.01;
/** Fixed assumption: seconds of encode time per second of output video. */
const ESTIMATED_ENCODE_SECONDS_PER_OUTPUT_SECOND = 1.5;

/**
 * Thrown when a MovieAssemblyResult's timeline fails validation.
 */
export class FinalMovieRendererError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = "FinalMovieRendererError";
  }
}

/**
 * Validates an assembled movie timeline and builds a RenderPlan. Pure
 * planning — no rendering, no FFmpeg, no uploads, no provider calls, no
 * queueing.
 */
export class FinalMovieRenderer {
  /**
   * Validates the movie's timeline, builds render segments, and returns a
   * complete RenderPlan with every output setting populated (from
   * `options` where provided, otherwise a fixed default) plus pre-render
   * size/time estimates.
   */
  prepareRender(movie: MovieAssemblyResult, options?: RenderOptions): RenderPlan {
    this.validateMovieAssemblyResult(movie);

    const segments = this.buildSegments(movie);
    const totalDurationSeconds = segments.reduce((sum, segment) => sum + segment.durationSeconds, 0);

    const format = options?.format ?? DEFAULT_FORMAT;
    const codec = options?.codec ?? DEFAULT_CODEC;
    const resolution = options?.resolution ?? DEFAULT_RESOLUTION;
    const frameRate = options?.frameRate ?? DEFAULT_FRAME_RATE;
    const bitrateKbps = options?.bitrateKbps ?? DEFAULT_BITRATE_KBPS;
    const audioCodec = options?.audioCodec ?? DEFAULT_AUDIO_CODEC;
    const audioBitrateKbps = options?.audioBitrateKbps ?? DEFAULT_AUDIO_BITRATE_KBPS;
    const priority = options?.priority ?? DEFAULT_PRIORITY;

    return {
      renderId: this.generateRenderId(movie.movieId),
      movieId: movie.movieId,
      segments,
      format,
      codec,
      resolution,
      frameRate,
      bitrateKbps,
      audioCodec,
      audioBitrateKbps,
      totalDurationSeconds,
      priority,
      createdAt: new Date().toISOString(),
      estimatedOutputSizeBytes: this.estimateOutputSizeBytes(totalDurationSeconds, bitrateKbps, audioBitrateKbps),
      estimatedRenderTimeMs: this.estimateRenderTimeMs(totalDurationSeconds),
    };
  }

  // ── Validation ────────────────────────────────────────────────────────

  /**
   * Validates the timeline is non-empty, has a positive, internally
   * consistent total duration, and that its scenes have unique IDs,
   * positive individual durations, strictly increasing scene numbers, and
   * no gaps or overlaps between consecutive scenes.
   */
  private validateMovieAssemblyResult(movie: MovieAssemblyResult): void {
    if (!movie.timeline || movie.timeline.scenes.length === 0) {
      throw new FinalMovieRendererError("MovieAssemblyResult has an empty timeline.");
    }
    if (movie.timeline.totalDurationSeconds <= 0) {
      throw new FinalMovieRendererError(
        "MovieAssemblyResult.timeline.totalDurationSeconds must be positive."
      );
    }

    const scenes = movie.timeline.scenes;
    const summedDuration = scenes.reduce(
      (sum, scene) => sum + (scene.endTimeSeconds - scene.startTimeSeconds),
      0
    );
    if (Math.abs(summedDuration - movie.timeline.totalDurationSeconds) > DURATION_TOLERANCE_SECONDS) {
      throw new FinalMovieRendererError(
        `Timeline duration mismatch: scenes sum to ${summedDuration}s but totalDurationSeconds is ${movie.timeline.totalDurationSeconds}s.`
      );
    }

    const seenSceneIds = new Set<string>();
    for (let i = 0; i < scenes.length; i++) {
      const scene = scenes[i];

      if (seenSceneIds.has(scene.sceneId)) {
        throw new FinalMovieRendererError(`Duplicate sceneId in timeline: ${scene.sceneId}`);
      }
      seenSceneIds.add(scene.sceneId);

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

  // ── Construction ─────────────────────────────────────────────────────

  private buildSegments(movie: MovieAssemblyResult): RenderSegment[] {
    return movie.timeline.scenes.map((scene) => ({
      segmentId: scene.sceneId,
      sceneNumber: scene.sceneNumber,
      sourceUrl: scene.videoUrl,
      startTimeSeconds: scene.startTimeSeconds,
      endTimeSeconds: scene.endTimeSeconds,
      durationSeconds: scene.endTimeSeconds - scene.startTimeSeconds,
    }));
  }

  private estimateOutputSizeBytes(
    totalDurationSeconds: number,
    bitrateKbps: number,
    audioBitrateKbps: number
  ): number {
    const totalBitrateKbps = bitrateKbps + audioBitrateKbps;
    const totalBits = totalBitrateKbps * 1000 * totalDurationSeconds;
    return totalBits / 8;
  }

  private estimateRenderTimeMs(totalDurationSeconds: number): number {
    return totalDurationSeconds * ESTIMATED_ENCODE_SECONDS_PER_OUTPUT_SECOND * 1000;
  }

  private generateRenderId(movieId: string): string {
    return `render-${movieId}-${Date.now()}`;
  }
}
