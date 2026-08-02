/**
 * ProviderFactory.ts
 *
 * Chooses a mock (AI_MODE=development, see ../devmode/isDeveloperMode.ts)
 * or real (otherwise) instance for each of the four AI providers. Real
 * construction is supplied lazily by the caller via `createReal` — the
 * caller (MovieProductionFactory.ts) already knows how to build each real
 * client — so no real credential or client is ever constructed when a
 * mock is returned instead.
 *
 * Each createX() returns the same concrete Service class either way
 * (GeminiService/ImagenService/VeoService/ElevenLabsService), never a
 * separate interface — MockGeminiService/MockImagenService/MockVeoService/
 * MockElevenLabsService in ../devmode are subclasses of those exact
 * classes, so callers (MovieProductionService, GeminiLanguageModelProvider)
 * need no special-casing for either mode.
 */

import { isDeveloperMode } from "../devmode/isDeveloperMode";
import { MockGeminiService } from "../devmode/MockGeminiService";
import { MockImagenService } from "../devmode/MockImagenService";
import { MockVeoService } from "../devmode/MockVeoService";
import { MockElevenLabsService } from "../devmode/MockElevenLabsService";
import type { GeminiService } from "./google/GeminiService";
import type { ImagenService } from "./google/ImagenService";
import type { VeoService } from "./google/VeoService";
import type { ElevenLabsService } from "./audio/ElevenLabsService";

export class ProviderFactory {
  static createGemini(createReal: () => GeminiService): GeminiService {
    return isDeveloperMode() ? new MockGeminiService() : createReal();
  }

  static createImagen(createReal: () => ImagenService): ImagenService {
    return isDeveloperMode() ? new MockImagenService() : createReal();
  }

  static createVeo(createReal: () => VeoService): VeoService {
    return isDeveloperMode() ? new MockVeoService() : createReal();
  }

  static createElevenLabs(createReal: () => ElevenLabsService): ElevenLabsService {
    return isDeveloperMode() ? new MockElevenLabsService() : createReal();
  }
}