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

/**
 * Every AI provider currently wired into the platform, plus provider ids
 * reserved for future integrations. Reserving the id here (see
 * ProviderRegistry.ts) is what lets a future provider be registered without
 * any change to this type.
 */
export type ProviderId =
  | 'GEMINI'
  | 'IMAGEN'
  | 'VEO'
  | 'CLOUDINARY'
  | 'ELEVENLABS'
  | 'OPENAI'
  | 'DEEPSEEK'
  | 'GROQ'
  | 'OPENROUTER'
  | 'ANTHROPIC'

/**
 * The distinct kinds of AI work a production needs. Each maps to one stage
 * of the real pipeline (services/ai/orchestration/MovieProductionService.ts)
 * without depending on it directly.
 */
export enum AICapability {
  StoryGeneration = 'STORY_GENERATION',
  CharacterImage = 'CHARACTER_IMAGE',
  SceneImage = 'SCENE_IMAGE',
  VideoGeneration = 'VIDEO_GENERATION',
  VoiceSynthesis = 'VOICE_SYNTHESIS',
  Rendering = 'RENDERING',
  Storage = 'STORAGE',
}

/** Whether a registered provider can be selected today, or is reserved for later. */
export enum ProviderAvailability {
  Available = 'AVAILABLE',
  Planned = 'PLANNED',
}

/** Operational health of a provider, as last reported to ProviderHealth. */
export enum ProviderHealthStatus {
  Online = 'ONLINE',
  Offline = 'OFFLINE',
  RateLimited = 'RATE_LIMITED',
  Maintenance = 'MAINTENANCE',
  Unknown = 'UNKNOWN',
}

export type QualityTier = 'draft' | 'standard' | 'high'
export type Priority = 'low' | 'normal' | 'high'

/** Cost of one unit of a capability. "Unit" meaning is capability-specific — see CostEstimator.ts. */
export interface ProviderCostProfile {
  creditsPerUnit: number
  usdPerUnit: number
}

/**
 * Time to produce one unit of a capability, plus how many units this
 * provider can work on at once (used by GenerationEstimator to model
 * parallel stages like Promise.all-based image/video generation).
 */
export interface ProviderSpeedProfile {
  secondsPerUnit: number
  concurrency: number
}

export interface ProviderCapabilityProfile {
  cost: ProviderCostProfile
  speed: ProviderSpeedProfile
}

/** One provider's registry entry: identity, availability, and a cost/speed profile per capability it supports. */
export interface ProviderRegistryEntry {
  id: ProviderId
  displayName: string
  status: ProviderAvailability
  capabilities: Partial<Record<AICapability, ProviderCapabilityProfile>>
}

/**
 * Rough sizing input a caller supplies before a production exists. Every
 * field is an estimate — none of it is authoritative until the real
 * pipeline runs.
 */
export interface OrchestrationRequest {
  estimatedSceneCount: number
  estimatedCharacterCount: number
  targetDurationSecondsPerScene: number
  qualityTier: QualityTier
  priority: Priority
  /** How many productions are already ahead of this one — used for queue delay only. */
  currentQueueDepth: number
}

export interface ExpectedCost {
  credits: number
  usd: number
}

/** ProviderSelector's decision for a single capability. */
export interface ProviderSelection {
  capability: AICapability
  providerId: ProviderId
  reason: string
  expectedCost: ExpectedCost
  expectedDurationSeconds: number
  priority: Priority
}

export interface CostBreakdownEntry {
  capability: AICapability
  providerId: ProviderId | null
  units: number
  credits: number
  usd: number
}

export interface CostEstimate {
  breakdown: CostBreakdownEntry[]
  totalCredits: number
  totalUsd: number
}

export interface GenerationBreakdownEntry {
  capability: AICapability
  units: number
  secondsTotal: number
}

export interface GenerationEstimate {
  breakdown: GenerationBreakdownEntry[]
  totalRuntimeSeconds: number
  perSceneRuntimeSeconds: number
  queueDelaySeconds: number
  expectedCompletionAt: string
}

/** The AIOrchestrator's full output: what to use, what it costs, how long it takes. */
export interface OrchestrationPlan {
  request: OrchestrationRequest
  selections: ProviderSelection[]
  cost: CostEstimate
  generation: GenerationEstimate
  createdAt: string
}
