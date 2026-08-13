/**
 * VeoProviderError.ts
 *
 * VGE-02: typed, provider-specific errors for the Google Veo path
 * (GoogleGenAIVeoClient in services/infrastructure/MovieProductionFactory.ts,
 * GoogleVeoProvider.ts). Before this, every failure — missing credentials,
 * an invalid request, a real SDK/API error, a stalled poll — surfaced as
 * either a generic Error or, further up, RenderOrchestrator's catch-all
 * FAILED RenderResult with only whatever message the SDK happened to
 * throw. VeoProviderError gives each of those a distinct, checkable code
 * instead.
 *
 * Deliberately does NOT trigger a fallback to another provider anywhere —
 * per VGE-02's scope, provider fallback belongs to the future Provider
 * Router. A VeoProviderError propagates up to RenderOrchestrator exactly
 * like any other thrown error does today (caught once, turned into a
 * FAILED RenderResult) — this file only makes *what* failed identifiable,
 * not what happens next.
 */

export type VeoProviderErrorCode =
  | "MISSING_API_KEY"
  | "AUTHENTICATION_FAILED"
  | "INVALID_REQUEST"
  | "UNSUPPORTED_CAPABILITY"
  | "INVALID_DURATION"
  | "INVALID_RESOLUTION"
  | "GENERATION_FAILED"
  | "POLLING_FAILED"
  | "TIMEOUT"
  | "OPERATION_FAILED"
  | "DOWNLOAD_FAILED";

export class VeoProviderError extends Error {
  constructor(
    public readonly code: VeoProviderErrorCode,
    message: string,
    public readonly cause?: unknown
  ) {
    super(message);
    this.name = "VeoProviderError";
  }
}

/**
 * Heuristic classification of an unknown error thrown by the @google/genai
 * SDK into a VeoProviderErrorCode, for the cases where the SDK doesn't
 * give us a structured error type to switch on (it doesn't — errors
 * arrive as plain Error/HTTP-shaped objects with a message string). Falls
 * back to `fallbackCode` when nothing matches, rather than guessing.
 */
export function classifySdkError(error: unknown, fallbackCode: VeoProviderErrorCode): VeoProviderError {
  if (error instanceof VeoProviderError) return error;

  const message = error instanceof Error ? error.message : String(error);
  const lower = message.toLowerCase();

  if (lower.includes("api key") || lower.includes("api_key") || lower.includes("unauthenticated")) {
    return new VeoProviderError("AUTHENTICATION_FAILED", `Veo authentication failed: ${message}`, error);
  }
  if (lower.includes("permission") || lower.includes("forbidden") || lower.includes("401") || lower.includes("403")) {
    return new VeoProviderError("AUTHENTICATION_FAILED", `Veo authentication/authorization failed: ${message}`, error);
  }
  if (lower.includes("invalid") && (lower.includes("argument") || lower.includes("request") || lower.includes("400"))) {
    return new VeoProviderError("INVALID_REQUEST", `Veo rejected the request: ${message}`, error);
  }
  if (lower.includes("timeout") || lower.includes("timed out") || lower.includes("deadline")) {
    return new VeoProviderError("TIMEOUT", `Veo request timed out: ${message}`, error);
  }

  return new VeoProviderError(fallbackCode, `Veo request failed: ${message}`, error);
}
