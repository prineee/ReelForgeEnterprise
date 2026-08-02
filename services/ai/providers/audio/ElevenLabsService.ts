/**
 * ElevenLabsService.ts
 *
 * Translation layer between generic text-to-speech calls and an audio
 * provider's request/response shape. Contains no SDK imports, no API
 * keys, no environment variable access, and no network implementation —
 * the actual audio client is injected via the AudioClient interface,
 * which the real caller of this class is responsible for constructing
 * (with whatever SDK, credentials, and transport it needs, ElevenLabs or
 * otherwise). ElevenLabsService itself only translates requests/responses
 * and validates them; it has no knowledge of Movie, Character, or any AI
 * orchestration concept.
 */

/**
 * Request shape expected by the injected audio client's generateSpeech()
 * method. Deliberately carries no model name — model selection is the
 * injected client's responsibility, not this service's.
 */
export interface SpeechRequest {
  text: string;
  voiceId?: string;
  stability?: number;
  similarityBoost?: number;
  speed?: number;
}

/**
 * A single available voice, in a shape generic enough to represent any
 * text-to-speech backend's voice catalog.
 */
export interface VoiceProfile {
  voiceId: string;
  name: string;
  language?: string;
  gender?: string;
  previewUrl?: string;
}

/**
 * Usage accounting for a speech generation call.
 */
export interface AudioUsage {
  charactersUsed: number;
  charactersRemaining?: number;
}

/**
 * Response shape returned by the injected audio client's generateSpeech()
 * method.
 */
export interface SpeechResult {
  audioUrl: string;
  durationSeconds?: number;
  format?: string;
  usage?: AudioUsage;
}

/**
 * Caller-supplied generation tuning options.
 */
export interface SpeechOptions {
  voiceId?: string;
  stability?: number;
  similarityBoost?: number;
  speed?: number;
}

/**
 * Minimal contract ElevenLabsService needs from an audio client
 * implementation. Deliberately independent of any actual SDK type — a
 * real implementation adapts the genuine audio SDK (ElevenLabs or
 * otherwise) to this shape elsewhere.
 */
export interface AudioClient {
  generateSpeech(request: SpeechRequest): Promise<SpeechResult>;
  listVoices(): Promise<VoiceProfile[]>;
}

/**
 * Thrown when a speech generation response or voice list fails
 * validation.
 */
export class ElevenLabsServiceError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = "ElevenLabsServiceError";
  }
}

/**
 * Translates generic speech generation requests into AudioClient calls
 * and results back into validated generic objects. Pure translation — no
 * business logic, no Movie/Character knowledge, no orchestration.
 */
export class ElevenLabsService {
  constructor(private readonly client: AudioClient) {}

  /**
   * Generates speech from text and returns the validated result.
   */
  async generateSpeech(text: string, options?: SpeechOptions): Promise<SpeechResult> {
    if (!text || text.trim().length === 0) {
      throw new ElevenLabsServiceError("text must be a non-empty string.");
    }

    const request = this.toSpeechRequest(text, options);
    const result = await this.client.generateSpeech(request);
    this.validateResult(result);
    return result;
  }

  /**
   * Retrieves and validates the available voice catalog.
   */
  async getAvailableVoices(): Promise<VoiceProfile[]> {
    const voices = await this.client.listVoices();
    this.validateVoices(voices);
    return voices;
  }

  // ── Translation ──────────────────────────────────────────────────────

  private toSpeechRequest(text: string, options?: SpeechOptions): SpeechRequest {
    return {
      text,
      voiceId: options?.voiceId,
      stability: options?.stability,
      similarityBoost: options?.similarityBoost,
      speed: options?.speed,
    };
  }

  // ── Validation ───────────────────────────────────────────────────────

  private validateResult(result: SpeechResult): void {
    if (!result.audioUrl || result.audioUrl.trim().length === 0) {
      throw new ElevenLabsServiceError("Speech generation response did not include an audioUrl.");
    }
  }

  private validateVoices(voices: VoiceProfile[]): void {
    if (!Array.isArray(voices)) {
      throw new ElevenLabsServiceError("listVoices() response was not an array.");
    }
    for (const voice of voices) {
      if (!voice.voiceId || voice.voiceId.trim().length === 0) {
        throw new ElevenLabsServiceError("A voice profile was returned with no voiceId.");
      }
      if (!voice.name || voice.name.trim().length === 0) {
        throw new ElevenLabsServiceError(`Voice profile "${voice.voiceId}" was returned with no name.`);
      }
    }
  }
}
