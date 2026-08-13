/**
 * GoogleVeoProvider.ts
 *
 * RenderProvider adapter for Google's Veo API. Contains no Veo/GenAI
 * knowledge of its own — it delegates entirely to the existing
 * GoogleGenAIVeoClient (services/infrastructure/MovieProductionFactory.ts),
 * the same class MovieProductionFactory.ts wires into VeoService today.
 * That class was exported (previously module-private) specifically so
 * this adapter could reuse it instead of duplicating its @google/genai
 * call logic — see the file-level comment there. This is an adapter only:
 * no request/response logic is duplicated, only translated by
 * BaseVeoClientProvider.
 */

// @ts-ignore - @google/genai ships a d.ts that TS module resolution flags as "not a module" (same import already used in MovieProductionFactory.ts)
import { GoogleGenAI } from "@google/genai";
import { GoogleGenAIVeoClient } from "@/services/infrastructure/MovieProductionFactory";
import { BaseVeoClientProvider } from "./BaseVeoClientProvider";
import { VeoProviderError } from "./VeoProviderError";

export class GoogleVeoProvider extends BaseVeoClientProvider {
  readonly name = "GOOGLE";

  constructor(apiKey?: string) {
    const resolvedKey = apiKey ?? process.env.GEMINI_API_KEY;
    if (!resolvedKey) {
      throw new VeoProviderError(
        "MISSING_API_KEY",
        "GEMINI_API_KEY is not configured — GoogleVeoProvider cannot be constructed without it."
      );
    }
    super(new GoogleGenAIVeoClient(new GoogleGenAI({ apiKey: resolvedKey })));
  }
}
