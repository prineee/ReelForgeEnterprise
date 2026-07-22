/**
 * MockElevenLabsService.ts
 *
 * Deterministic, network-free ElevenLabsService for AI_MODE=development.
 * ElevenLabsService.ts is not modified — this subclasses it (a true
 * ElevenLabsService wherever one is expected) and only injects a fake
 * AudioClient via super(); ElevenLabsService's real methods already
 * delegate every call to the injected client, so no method override is
 * needed here.
 */

import { ElevenLabsService } from "../providers/audio/ElevenLabsService";
import type { AudioClient, SpeechRequest, SpeechResult, VoiceProfile } from "../providers/audio/ElevenLabsService";

const MOCK_AUDIO_URL = "https://mock.local/mock-audio.mp3";

class MockAudioClient implements AudioClient {
  async generateSpeech(request: SpeechRequest): Promise<SpeechResult> {
    return {
      audioUrl: MOCK_AUDIO_URL,
      durationSeconds: 1,
      format: "mp3",
      usage: { charactersUsed: request.text.length },
    };
  }

  async listVoices(): Promise<VoiceProfile[]> {
    return [{ voiceId: "mock-voice-1", name: "Mock Voice", language: "en" }];
  }
}

export class MockElevenLabsService extends ElevenLabsService {
  constructor() {
    super(new MockAudioClient());
  }
}