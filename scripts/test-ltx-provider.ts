/**
 * test-ltx-provider.ts
 *
 * Manual smoke test for LTXVideoClient (services/ai/providers/ltx/LTXVideoClient.ts).
 * Exercises the real LTX hosted API end-to-end: submit a text-to-video
 * request, poll the operation until it finishes, and print the resulting
 * video URL. Contains no LTX API logic of its own — every request goes
 * through the existing LTXVideoClient, which is the only place that knows
 * LTX's endpoints, auth header, and payload shape.
 *
 * Usage:
 *   LTX_API_KEY=... npx tsx scripts/test-ltx-provider.ts
 *   LTX_API_KEY=... npx tsx scripts/test-ltx-provider.ts "a drone shot over a neon city at night"
 */

import { LTXVideoClient } from "@/services/ai/providers/ltx/LTXVideoClient";
import type { VeoResponse } from "@/services/ai/providers/google/VeoService";

const DEFAULT_PROMPT = "a slow cinematic pan across a misty mountain lake at sunrise";
const POLL_INTERVAL_MS = 5000;
const MAX_POLL_ATTEMPTS = 24; // 24 * 5s = 2 minutes

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function pollUntilSettled(client: LTXVideoClient, operationId: string): Promise<VeoResponse> {
  for (let attempt = 1; attempt <= MAX_POLL_ATTEMPTS; attempt++) {
    const response = await client.checkStatus(operationId);
    console.log(`Current status: ${response.status} (attempt ${attempt}/${MAX_POLL_ATTEMPTS})`);

    if (response.status === "COMPLETED" || response.status === "FAILED") {
      return response;
    }

    await sleep(POLL_INTERVAL_MS);
  }

  throw new Error(`Operation "${operationId}" did not settle within ${MAX_POLL_ATTEMPTS} poll attempts.`);
}

async function main(): Promise<void> {
  console.log("Starting test: LTXVideoClient smoke test");

  // 1. Read LTX_API_KEY from environment (LTXVideoClient throws a clear
  // error itself if it's missing, so no duplicate check here).
  const client = new LTXVideoClient();

  const prompt = process.argv[2] ?? DEFAULT_PROMPT;

  // 2. Submit a text-to-video request.
  const submitResponse = await client.generate({ prompt });
  console.log("Request submitted");
  console.log(`Operation ID: ${submitResponse.operationId}`);
  console.log(`Current status: ${submitResponse.status}`);

  // 3. Check generation status (poll until COMPLETED or FAILED).
  const finalStatus =
    submitResponse.status === "COMPLETED" || submitResponse.status === "FAILED"
      ? submitResponse
      : await pollUntilSettled(client, submitResponse.operationId);

  if (finalStatus.status === "FAILED") {
    throw new Error(`LTX operation "${finalStatus.operationId}" failed.`);
  }

  // 4. Download the generated video URL.
  const video = await client.download(finalStatus.operationId);
  console.log(`Final video URL: ${video.url}`);
}

main().catch((error) => {
  console.error("LTX provider smoke test failed:", error);
  process.exitCode = 1;
});
