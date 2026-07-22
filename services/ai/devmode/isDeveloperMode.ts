/**
 * isDeveloperMode.ts
 *
 * Single source of truth for whether AI_MODE=development is active. Used
 * by ProviderFactory.ts to choose mock vs. real providers, and by
 * MovieProductionFactory.ts to skip the GEMINI_API_KEY requirement when no
 * real Gemini client will ever be constructed.
 */
export function isDeveloperMode(): boolean {
  return (process.env.AI_MODE ?? "").trim().toLowerCase() === "development";
}