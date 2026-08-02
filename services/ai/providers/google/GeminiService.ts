/**
 * GeminiService.ts
 *
 * Translation layer between generic text/JSON generation calls and
 * Gemini's request/response shape. generateText() calls @google/genai
 * directly — a single await, no wrapper, no timeout, no retry.
 */

// @ts-ignore - @google/genai ships a d.ts that TS module resolution flags as "not a module"
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

/**
 * Request shape expected by the injected Gemini client's generate()
 * method. Deliberately carries no model name — model selection is the
 * injected client's responsibility, not this service's.
 */
export interface GeminiRequest {
  prompt: string;
  temperature?: number;
  maxOutputTokens?: number;
  responseFormat: "text" | "json";
}

/**
 * Token accounting for a single generate() call.
 */
export interface GeminiUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

/**
 * Response shape returned by the injected Gemini client's generate()
 * method.
 */
export interface GeminiResponse {
  text: string;
  usage: GeminiUsage;
  finishReason: string;
}

/**
 * Caller-supplied generation tuning options.
 */
export interface GeminiOptions {
  temperature?: number;
  maxOutputTokens?: number;
}

/**
 * Minimal contract GeminiService needs from a Gemini client
 * implementation. Deliberately independent of any actual SDK type — a
 * real implementation adapts the genuine Gemini SDK to this shape
 * elsewhere.
 */
export interface GeminiClient {
  generate(request: GeminiRequest): Promise<GeminiResponse>;
  countTokens(text: string): Promise<number>;
}

/**
 * Thrown when a Gemini response fails validation or cannot be parsed as
 * the requested structured JSON.
 */
export class GeminiServiceError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = "GeminiServiceError";
  }
}

/**
 * Translates generic generation requests into GeminiRequest calls and
 * GeminiResponse results back into validated, optionally JSON-parsed
 * output. Pure translation — no prompt engineering, no orchestration, no
 * business logic beyond request/response shaping and validation.
 */
export class GeminiService {
  constructor(private readonly client: GeminiClient) {}

  /**
   * Generates plain text from a prompt and returns the validated response.
   */
  async generateText(prompt: string): Promise<GeminiResponse> {
    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
    });

    const text = response.text;

    if (!text) throw new Error("Gemini returned empty response");

    return {
      text,
      usage: {
        promptTokens: response.usageMetadata?.promptTokenCount ?? 0,
        completionTokens: response.usageMetadata?.candidatesTokenCount ?? 0,
        totalTokens: response.usageMetadata?.totalTokenCount ?? 0,
      },
      finishReason: response.candidates?.[0]?.finishReason ?? "UNKNOWN",
    };
  }

  /**
   * Generates JSON from a prompt and safely parses it into T. Throws
   * GeminiServiceError if the response is invalid or is not valid JSON.
   */
  async generateStructuredJson<T>(prompt: string, options?: GeminiOptions): Promise<T> {
    const request = this.toGeminiRequest(prompt, options, "json");
    const response = await this.client.generate(request);
    this.validateResponse(response);
    return this.parseJson<T>(response.text);
  }

  /**
   * Counts the tokens a piece of text would consume, via the injected
   * client.
   */
  async countTokens(text: string): Promise<number> {
    return this.client.countTokens(text);
  }

  // ── Translation ──────────────────────────────────────────────────────

  private toGeminiRequest(
    prompt: string,
    options: GeminiOptions | undefined,
    responseFormat: "text" | "json"
  ): GeminiRequest {
    return {
      prompt,
      temperature: options?.temperature,
      maxOutputTokens: options?.maxOutputTokens,
      responseFormat,
    };
  }

  // ── Validation ───────────────────────────────────────────────────────

  private validateResponse(response: GeminiResponse): void {
    if (typeof response.text !== "string" || response.text.trim().length === 0) {
      throw new GeminiServiceError("Gemini response contained no text.");
    }
    if (!response.usage) {
      throw new GeminiServiceError("Gemini response did not include usage information.");
    }
  }

  private parseJson<T>(text: string): T {
    try {
      return JSON.parse(text) as T;
    } catch (error) {
      throw new GeminiServiceError(
        `Gemini response was not valid JSON: ${error instanceof Error ? error.message : String(error)}`,
        error
      );
    }
  }
}
