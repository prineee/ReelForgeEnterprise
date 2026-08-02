/**
 * SyntheticTestPatternBackend.ts
 *
 * Honest reference implementation of LocalModelBackend — NOT a real AI
 * video-generation model. No GPU-accelerated diffusion model (Wan 2.2,
 * Hunyuan Video, CogVideoX, LTX Local, or any other) is installed or
 * hardcoded anywhere in this codebase; this machine also has no
 * CUDA/ROCm-capable discrete GPU to run one on (see
 * docs/architecture/local-gpu-provider.md).
 *
 * Instead, this uses ffmpeg's built-in `testsrc` source filter to
 * synthesize a genuine, valid, playable H.264 MP4 locally on CPU — real
 * encoded video bytes, at the requested duration/resolution, actually
 * downloadable and verifiable end-to-end (scripts/test-local-gpu.ts runs
 * ffprobe against the real output file, exactly like
 * scripts/test-ltx-provider.ts does for real LTX output). This exists so
 * LocalGPUProvider's full pipeline — submit, poll, download, verify — is
 * genuinely exercised today, without pretending to be a real model.
 *
 * Swap only this class (not GPUWorker, LocalGPURenderAPI, or
 * LocalGPUProvider) once a real local model is integrated — that is the
 * entire point of the LocalModelBackend abstraction.
 */

import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import ffmpegInstaller from "@ffmpeg-installer/ffmpeg";
import ffprobeInstaller from "@ffprobe-installer/ffprobe";
import type { RenderRequest } from "@/services/rendering/interfaces/RenderProvider";
import type { LocalModelBackend, LocalRenderOutput } from "./LocalModelBackend";

const OUTPUT_DIR = path.join(process.cwd(), "public", "renders", "local-gpu");
const PUBLIC_URL_PREFIX = "/renders/local-gpu";

const DEFAULT_DURATION_SECONDS = 8;
const DEFAULT_RESOLUTION = "1920x1080";
const DEFAULT_FPS = 24;

export class SyntheticTestPatternBackend implements LocalModelBackend {
  readonly modelName = "synthetic-test-pattern-reference";

  async generate(request: RenderRequest, signal: AbortSignal): Promise<LocalRenderOutput> {
    if (signal.aborted) throw new Error("Render was cancelled before it started.");

    await mkdir(OUTPUT_DIR, { recursive: true });

    const durationSeconds = request.durationSeconds ?? DEFAULT_DURATION_SECONDS;
    const resolution = request.quality ?? DEFAULT_RESOLUTION;
    const fileName = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}.mp4`;
    const filePath = path.join(OUTPUT_DIR, fileName);

    await this.runFFmpeg(
      [
        "-y",
        "-f", "lavfi",
        "-i", `testsrc=duration=${durationSeconds}:size=${resolution}:rate=${DEFAULT_FPS}`,
        "-pix_fmt", "yuv420p",
        filePath,
      ],
      signal
    );

    const actual = await this.probe(filePath);

    return {
      filePath,
      publicUrl: `${PUBLIC_URL_PREFIX}/${fileName}`,
      durationSeconds: actual.durationSeconds ?? durationSeconds,
      resolution: actual.resolution ?? resolution,
    };
  }

  private runFFmpeg(args: string[], signal: AbortSignal): Promise<void> {
    return new Promise((resolve, reject) => {
      const proc = spawn(ffmpegInstaller.path, args);
      let stderr = "";

      const onAbort = () => proc.kill();
      signal.addEventListener("abort", onAbort);

      proc.stderr.on("data", (chunk: Buffer) => {
        stderr += chunk.toString();
      });
      proc.on("error", (error) => {
        signal.removeEventListener("abort", onAbort);
        reject(error);
      });
      proc.on("close", (code, killSignal) => {
        signal.removeEventListener("abort", onAbort);
        if (signal.aborted) {
          reject(new Error("Render was cancelled."));
        } else if (code === 0) {
          resolve();
        } else {
          reject(new Error(`ffmpeg exited with code ${code}${killSignal ? ` (signal ${killSignal})` : ""}: ${stderr.slice(-500)}`));
        }
      });
    });
  }

  /** Reads back the real, encoded duration/resolution from the file ffmpeg just produced — not just an echo of the request. */
  private probe(filePath: string): Promise<{ durationSeconds?: number; resolution?: string }> {
    return new Promise((resolve) => {
      const proc = spawn(ffprobeInstaller.path, [
        "-v", "quiet",
        "-print_format", "json",
        "-show_format",
        "-show_streams",
        filePath,
      ]);
      let stdout = "";
      proc.stdout.on("data", (chunk: Buffer) => {
        stdout += chunk.toString();
      });
      proc.on("close", () => {
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const parsed = JSON.parse(stdout) as any;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const videoStream = parsed.streams?.find((s: any) => s.codec_type === "video");
          const durationSeconds = parsed.format?.duration ? Number(parsed.format.duration) : undefined;
          const resolution = videoStream?.width && videoStream?.height ? `${videoStream.width}x${videoStream.height}` : undefined;
          resolve({ durationSeconds, resolution });
        } catch {
          // ffprobe failing to parse doesn't invalidate a successfully-encoded file — fall back to the request's values (handled by the caller).
          resolve({});
        }
      });
      proc.on("error", () => resolve({}));
    });
  }
}
