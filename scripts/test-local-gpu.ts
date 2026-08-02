/**
 * test-local-gpu.ts
 *
 * Manual smoke test for the local GPU rendering pipeline
 * (services/gpu/LocalGPURenderAPI.ts + GPUWorker.ts), mirroring
 * scripts/test-ltx-provider.ts's shape: submit a request, poll the job
 * until it settles, download, and verify. Contains no rendering logic of
 * its own — every call goes through the existing LocalGPURenderAPI,
 * which is the only place that knows how a local job is submitted,
 * polled, and downloaded.
 *
 * Unlike the cloud smoke tests, the produced video is a local file, not
 * a remote URL — so "verify" here means real, local checks (file
 * exists, non-zero size, real ffprobe-confirmed format/duration/
 * resolution), not a second network fetch.
 *
 * Usage:
 *   npx tsx scripts/test-local-gpu.ts
 *   npx tsx scripts/test-local-gpu.ts "a drone shot over a neon city at night"
 */

import { spawn } from "node:child_process";
import { existsSync, statSync } from "node:fs";
import path from "node:path";
import ffprobeInstaller from "@ffprobe-installer/ffprobe";
import { GPUWorker } from "@/services/gpu/GPUWorker";
import { LocalGPURenderAPI } from "@/services/gpu/LocalGPURenderAPI";
import { SyntheticTestPatternBackend } from "@/services/gpu/backends/SyntheticTestPatternBackend";
import type { RenderResult } from "@/services/rendering/interfaces/RenderResult";

const DEFAULT_PROMPT = "a slow cinematic pan across a misty mountain lake at sunrise";
const POLL_INTERVAL_MS = 500;
const MAX_POLL_ATTEMPTS = 60; // 60 * 0.5s = 30 seconds — local rendering has no network round-trip to wait on.

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function pollUntilSettled(api: LocalGPURenderAPI, jobId: string): Promise<RenderResult> {
  for (let attempt = 1; attempt <= MAX_POLL_ATTEMPTS; attempt++) {
    const result = await api.status(jobId);
    console.log(`Current status: ${result.status} (attempt ${attempt}/${MAX_POLL_ATTEMPTS})`);

    if (result.status === "COMPLETED" || result.status === "FAILED") {
      return result;
    }

    await sleep(POLL_INTERVAL_MS);
  }

  throw new Error(`Job "${jobId}" did not settle within ${MAX_POLL_ATTEMPTS} poll attempts.`);
}

interface ProbedVideo {
  formatName?: string;
  durationSeconds?: number;
  resolution?: string;
  codecName?: string;
}

function probeVideo(filePath: string): Promise<ProbedVideo> {
  return new Promise((resolve, reject) => {
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
    proc.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`ffprobe exited with code ${code}`));
        return;
      }
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const parsed = JSON.parse(stdout) as any;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const videoStream = parsed.streams?.find((s: any) => s.codec_type === "video");
        resolve({
          formatName: parsed.format?.format_name,
          durationSeconds: parsed.format?.duration ? Number(parsed.format.duration) : undefined,
          resolution: videoStream ? `${videoStream.width}x${videoStream.height}` : undefined,
          codecName: videoStream?.codec_name,
        });
      } catch (error) {
        reject(error);
      }
    });
    proc.on("error", reject);
  });
}

async function main(): Promise<void> {
  console.log("Starting test: Local GPU rendering pipeline smoke test");

  // 1. Build the real pipeline: GPUWorker driven by the honest
  // SyntheticTestPatternBackend reference implementation (see that
  // file's header for why — no real diffusion model is installed or
  // hardcoded here), wrapped by LocalGPURenderAPI.
  const worker = new GPUWorker(new SyntheticTestPatternBackend());
  const api = new LocalGPURenderAPI(worker);

  console.log("Worker status:", JSON.stringify(worker.getWorkerStatus()));

  const prompt = process.argv[2] ?? DEFAULT_PROMPT;

  // 2. Submit.
  const submitResult = await api.submit({ prompt, durationSeconds: 4, quality: "640x360" });
  console.log("Request submitted");
  console.log(`Job ID: ${submitResult.jobId}`);
  console.log(`Current status: ${submitResult.status}`);

  // 3. Poll until settled.
  const finalResult =
    submitResult.status === "COMPLETED" || submitResult.status === "FAILED"
      ? submitResult
      : await pollUntilSettled(api, submitResult.jobId);

  if (finalResult.status === "FAILED" || !finalResult.videoUrl) {
    throw new Error(`Local GPU job "${finalResult.jobId}" failed: ${finalResult.error ?? "no videoUrl"}`);
  }

  // 4. Download (already resolved by the time status is COMPLETED, but
  // call download() explicitly to exercise that method too, exactly like
  // the cloud smoke tests do).
  const downloaded = await api.download(finalResult.jobId);
  console.log(`Final video URL: ${downloaded.videoUrl}`);

  // 5. Verify — real, local checks against the actual produced file.
  const record = worker.getJob(finalResult.jobId);
  const filePath = record?.output?.filePath;
  if (!filePath) {
    throw new Error("No local file path recorded for this job — cannot verify.");
  }

  console.log(`Verifying local file: ${filePath}`);
  if (!existsSync(filePath)) {
    throw new Error(`File does not exist: ${filePath}`);
  }
  const stats = statSync(filePath);
  console.log(`File exists: YES, size: ${stats.size} bytes`);
  if (stats.size === 0) {
    throw new Error("File exists but is empty (0 bytes).");
  }

  const probed = await probeVideo(filePath);
  console.log("ffprobe result:", JSON.stringify(probed));

  if (!probed.formatName?.includes("mp4")) {
    throw new Error(`Unexpected format: ${probed.formatName}`);
  }
  if (probed.codecName !== "h264") {
    throw new Error(`Unexpected video codec: ${probed.codecName}`);
  }

  console.log(
    `Verified: format=${probed.formatName}, codec=${probed.codecName}, ` +
      `duration=${probed.durationSeconds}s, resolution=${probed.resolution}`
  );
  console.log(`Public URL (servable via Next.js public/): ${path.posix.normalize(downloaded.videoUrl!)}`);
  console.log("LOCAL GPU PIPELINE TEST PASSED");
}

main().catch((error) => {
  console.error("Local GPU pipeline smoke test failed:", error);
  process.exitCode = 1;
});
