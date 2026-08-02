/**
 * MovieAssembler.ts
 *
 * Assembles a MovieBlueprint's scenes and a BatchGenerationResult's
 * generated videos into an ordered movie timeline with duration
 * statistics. Performs no video merging, no FFmpeg work, and no file I/O
 * — it only validates, sorts, and computes metadata over data that already
 * exists.
 *
 * assemble() needs no collaborators beyond the two arguments it's called
 * with, so MovieAssembler takes no constructor dependencies — dependency
 * injection is used only where required, and none is required here.
 *
 * Note: BatchGenerationResult carries no movieId field (unlike
 * MovieBlueprint or the other *Result types earlier in this pipeline), so
 * scene/video correspondence is validated purely by matching sceneId
 * between MovieBlueprint.scenes and BatchGenerationResult.generatedVideos.
 */

import type { BatchGenerationResult } from "./VeoGenerator";
import type { MovieBlueprint } from "../director/DirectorEngine";

type GeneratedVideo = BatchGenerationResult["generatedVideos"][number];

/**
 * One scene's generated video, placed on the movie timeline.
 */
export interface AssembledScene {
  sceneId: string;
  sceneNumber: number;
  videoUrl: string;
  thumbnailUrl: string;
  duration: number;
  resolution: string;
  startTimeSeconds: number;
  endTimeSeconds: number;
}

/**
 * The full ordered sequence of a movie's assembled scenes.
 */
export interface MovieTimeline {
  scenes: AssembledScene[];
  totalDurationSeconds: number;
}

/**
 * Duration and coverage statistics for an assembled movie.
 */
export interface MovieStatistics {
  totalScenes: number;
  assembledScenes: number;
  totalDurationSeconds: number;
  averageSceneDurationSeconds: number;
}

/**
 * The complete result of assembling a movie's timeline.
 */
export interface MovieAssemblyResult {
  movieId: string;
  timeline: MovieTimeline;
  statistics: MovieStatistics;
}

/**
 * Thrown when a MovieBlueprint and BatchGenerationResult cannot be
 * assembled: duplicate scene IDs, or a scene with no corresponding
 * generated video.
 */
export class MovieAssemblyError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = "MovieAssemblyError";
  }
}

/**
 * Builds an ordered movie timeline from a MovieBlueprint's scenes and a
 * BatchGenerationResult's generated videos. Pure computation over
 * already-generated data — no rendering, no merging, no file I/O.
 */
export class MovieAssembler {
  /**
   * Validates, sorts, and assembles the movie's scenes into a timeline
   * with duration statistics.
   */
  assemble(movie: MovieBlueprint, batch: BatchGenerationResult): MovieAssemblyResult {
    this.validateNoDuplicateSceneIds(movie, batch);

    const videoBySceneId = new Map<string, GeneratedVideo>(
      batch.generatedVideos.map((video) => [video.sceneId, video])
    );
    this.validateAllScenesHaveVideos(movie, batch, videoBySceneId);

    const orderedScenes = [...movie.scenes].sort((a, b) => a.sceneNumber - b.sceneNumber);

    let cumulativeSeconds = 0;
    const assembledScenes: AssembledScene[] = orderedScenes.map((scene) => {
      // Presence guaranteed by validateAllScenesHaveVideos.
      const video = videoBySceneId.get(scene.id) as GeneratedVideo;
      const startTimeSeconds = cumulativeSeconds;
      const endTimeSeconds = startTimeSeconds + video.duration;
      cumulativeSeconds = endTimeSeconds;

      return {
        sceneId: scene.id,
        sceneNumber: scene.sceneNumber,
        videoUrl: video.videoUrl,
        thumbnailUrl: video.thumbnailUrl,
        duration: video.duration,
        resolution: video.resolution,
        startTimeSeconds,
        endTimeSeconds,
      };
    });

    const totalDurationSeconds = cumulativeSeconds;
    const averageSceneDurationSeconds =
      assembledScenes.length > 0 ? totalDurationSeconds / assembledScenes.length : 0;

    return {
      movieId: movie.movie.id,
      timeline: {
        scenes: assembledScenes,
        totalDurationSeconds,
      },
      statistics: {
        totalScenes: movie.scenes.length,
        assembledScenes: assembledScenes.length,
        totalDurationSeconds,
        averageSceneDurationSeconds,
      },
    };
  }

  /**
   * Detects duplicate scene IDs in either input — required to safely build
   * the sceneId → video lookup without silently dropping a conflicting
   * entry.
   */
  private validateNoDuplicateSceneIds(movie: MovieBlueprint, batch: BatchGenerationResult): void {
    const seenSceneIds = new Set<string>();
    for (const scene of movie.scenes) {
      if (seenSceneIds.has(scene.id)) {
        throw new MovieAssemblyError(`Duplicate sceneId in MovieBlueprint: ${scene.id}`);
      }
      seenSceneIds.add(scene.id);
    }

    const seenVideoSceneIds = new Set<string>();
    for (const video of batch.generatedVideos) {
      if (seenVideoSceneIds.has(video.sceneId)) {
        throw new MovieAssemblyError(
          `Duplicate sceneId in BatchGenerationResult.generatedVideos: ${video.sceneId}`
        );
      }
      seenVideoSceneIds.add(video.sceneId);
    }
  }

  /**
   * Validates every scene in the movie has a corresponding generated
   * video, enriching the error with the failure reason from
   * batch.failedOperations when available.
   */
  private validateAllScenesHaveVideos(
    movie: MovieBlueprint,
    batch: BatchGenerationResult,
    videoBySceneId: Map<string, GeneratedVideo>
  ): void {
    if (movie.scenes.length === 0) {
      throw new MovieAssemblyError("MovieBlueprint has no scenes.");
    }

    const missing = movie.scenes.filter((scene) => !videoBySceneId.has(scene.id));
    if (missing.length > 0) {
      const failureReasons = new Map(
        batch.failedOperations.map((failure) => [failure.sceneId, failure.reason])
      );
      const details = missing
        .map((scene) => {
          const reason = failureReasons.get(scene.id);
          return reason ? `${scene.id} (${reason})` : scene.id;
        })
        .join(", ");
      throw new MovieAssemblyError(`Missing generated video for scene(s): ${details}`);
    }
  }
}
