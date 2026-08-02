/**
 * MockImagenService.ts
 *
 * Deterministic, network-free ImagenService for AI_MODE=development.
 * ImagenService.ts is not modified — this subclasses it (a true
 * ImagenService wherever one is expected) and only injects a fake
 * ImagenClient via super(); ImagenService's real methods already delegate
 * every call to the injected client, so no method override is needed here.
 */

import { ImagenService } from "../providers/google/ImagenService";
import type { ImagenClient, ImagenRequest, ImagenResponse, GeneratedImage } from "../providers/google/ImagenService";

const MOCK_IMAGE_DATA_URI =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";

class MockImagenClient implements ImagenClient {
  async generate(request: ImagenRequest): Promise<ImagenResponse> {
    const count = request.numberOfImages ?? 1;
    const images: GeneratedImage[] = Array.from({ length: count }, () => ({
      url: MOCK_IMAGE_DATA_URI,
      mimeType: "image/png",
    }));
    return { images, usage: { imagesGenerated: images.length } };
  }
}

export class MockImagenService extends ImagenService {
  constructor() {
    super(new MockImagenClient());
  }
}