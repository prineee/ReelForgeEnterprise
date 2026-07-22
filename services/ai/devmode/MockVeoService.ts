/**
 * MockVeoService.ts
 *
 * Deterministic, network-free VeoService for AI_MODE=development.
 * VeoService.ts is not modified — this subclasses it (a true VeoService
 * wherever one is expected) and only injects a fake VeoClient via super();
 * VeoService's real methods already delegate every call to the injected
 * client, so no method override is needed here. The mock client reports
 * every operation as already COMPLETED so generateVideo() resolves
 * synchronously instead of requiring the caller to poll.
 */

import { VeoService } from "../providers/google/VeoService";
import type { VeoClient, VeoRequest, VeoResponse, GeneratedVideo } from "../providers/google/VeoService";

const MOCK_VIDEO_URL = "https://mock.local/mock-video.mp4";

class MockVeoClient implements VeoClient {
  async generate(_request: VeoRequest): Promise<VeoResponse> {
    return {
      operationId: `mock-veo-${Date.now()}`,
      status: "COMPLETED",
      usage: { videosGenerated: 1 },
    };
  }

  async checkStatus(operationId: string): Promise<VeoResponse> {
    return { operationId, status: "COMPLETED" };
  }

  async download(_operationId: string): Promise<GeneratedVideo> {
    return { url: MOCK_VIDEO_URL, durationSeconds: 8, resolution: "720p" };
  }
}

export class MockVeoService extends VeoService {
  constructor() {
    super(new MockVeoClient());
  }
}