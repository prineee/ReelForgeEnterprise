"use strict";
/**
 * OrchestratorTypes.ts
 *
 * The public vocabulary for the AI Orchestrator: the planning layer that
 * decides which provider to use, and estimates cost/credits/time, BEFORE a
 * production begins. This file is type-only — no business logic, no
 * classes, no imports — mirroring MovieProductionContracts.ts's own rule
 * that contract files stay stable and provider-agnostic.
 *
 * This module is deliberately independent of
 * services/ai/orchestration/MovieProductionContracts.ts: it plans BEFORE a
 * ProductionRequest can even be built (scene count isn't known until
 * StoryAnalyzer has run), so OrchestrationRequest expresses rough sizing
 * inputs a caller estimates up front, not the real pipeline's request
 * shape. Keeping the two decoupled is what lets this module be dropped in
 * or swapped out without touching MovieProductionService.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProviderHealthStatus = exports.ProviderAvailability = exports.AICapability = void 0;
/**
 * The distinct kinds of AI work a production needs. Each maps to one stage
 * of the real pipeline (services/ai/orchestration/MovieProductionService.ts)
 * without depending on it directly.
 */
var AICapability;
(function (AICapability) {
    AICapability["StoryGeneration"] = "STORY_GENERATION";
    AICapability["CharacterImage"] = "CHARACTER_IMAGE";
    AICapability["SceneImage"] = "SCENE_IMAGE";
    AICapability["VideoGeneration"] = "VIDEO_GENERATION";
    AICapability["VoiceSynthesis"] = "VOICE_SYNTHESIS";
    AICapability["Rendering"] = "RENDERING";
    AICapability["Storage"] = "STORAGE";
})(AICapability || (exports.AICapability = AICapability = {}));
/** Whether a registered provider can be selected today, or is reserved for later. */
var ProviderAvailability;
(function (ProviderAvailability) {
    ProviderAvailability["Available"] = "AVAILABLE";
    ProviderAvailability["Planned"] = "PLANNED";
})(ProviderAvailability || (exports.ProviderAvailability = ProviderAvailability = {}));
/** Operational health of a provider, as last reported to ProviderHealth. */
var ProviderHealthStatus;
(function (ProviderHealthStatus) {
    ProviderHealthStatus["Online"] = "ONLINE";
    ProviderHealthStatus["Offline"] = "OFFLINE";
    ProviderHealthStatus["RateLimited"] = "RATE_LIMITED";
    ProviderHealthStatus["Maintenance"] = "MAINTENANCE";
    ProviderHealthStatus["Unknown"] = "UNKNOWN";
})(ProviderHealthStatus || (exports.ProviderHealthStatus = ProviderHealthStatus = {}));
