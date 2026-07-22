/**
 * ProviderRegistry.ts
 *
 * Holds every AI provider's identity, availability, and per-capability
 * cost/speed profile. This is placeholder metadata only — no SDK imports,
 * no API keys, no network calls (this sprint is planning logic only; the
 * real network calls already live in services/ai/providers/*).
 *
 * ProviderSelector, CostEstimator, and GenerationEstimator all depend on
 * this registry rather than hardcoding provider facts themselves, which is
 * what lets a provider be added, repriced, or swapped without touching
 * MovieProductionService or any other consumer of this module.
 */

import type { ProviderCapabilityProfile, ProviderId, ProviderRegistryEntry } from './OrchestratorTypes'
import { AICapability, ProviderAvailability } from './OrchestratorTypes'

export class ProviderRegistryError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ProviderRegistryError'
  }
}

function profile(creditsPerUnit: number, usdPerUnit: number, secondsPerUnit: number, concurrency: number): ProviderCapabilityProfile {
  return {
    cost: { creditsPerUnit, usdPerUnit },
    speed: { secondsPerUnit, concurrency },
  }
}

/**
 * Providers wired into the real pipeline today (services/ai/providers/*,
 * services/infrastructure/MovieProductionFactory.ts). Cost/speed numbers
 * are placeholder estimates for planning purposes, not billing truth.
 */
const ACTIVE_PROVIDERS: ProviderRegistryEntry[] = [
  {
    id: 'GEMINI',
    displayName: 'Google Gemini',
    status: ProviderAvailability.Available,
    capabilities: {
      [AICapability.StoryGeneration]: profile(1, 0.01, 8, 1),
    },
  },
  {
    id: 'IMAGEN',
    displayName: 'Google Imagen',
    status: ProviderAvailability.Available,
    capabilities: {
      [AICapability.CharacterImage]: profile(2, 0.04, 14, 4),
      [AICapability.SceneImage]: profile(2, 0.04, 14, 4),
    },
  },
  {
    id: 'VEO',
    displayName: 'Google Veo',
    status: ProviderAvailability.Available,
    capabilities: {
      [AICapability.VideoGeneration]: profile(8, 0.35, 140, 3),
    },
  },
  {
    id: 'CLOUDINARY',
    displayName: 'Cloudinary',
    status: ProviderAvailability.Available,
    capabilities: {
      [AICapability.Rendering]: profile(3, 0.02, 20, 1),
      [AICapability.Storage]: profile(1, 0.001, 1, 8),
    },
  },
  {
    id: 'ELEVENLABS',
    displayName: 'ElevenLabs',
    status: ProviderAvailability.Available,
    capabilities: {
      [AICapability.VoiceSynthesis]: profile(1, 0.02, 8, 4),
    },
  },
]

/**
 * Providers reserved for future integration. None are ProviderAvailability.Available
 * yet — no SDK is installed for any of them (mirrors the documented
 * NotConfiguredAudioClient pattern in MovieProductionFactory.ts: reserve
 * the seam, don't fake the capability). ProviderSelector will never choose
 * a Planned provider.
 */
const PLANNED_PROVIDERS: ProviderRegistryEntry[] = [
  { id: 'OPENAI', displayName: 'OpenAI', status: ProviderAvailability.Planned, capabilities: {} },
  { id: 'DEEPSEEK', displayName: 'DeepSeek', status: ProviderAvailability.Planned, capabilities: {} },
  { id: 'GROQ', displayName: 'Groq', status: ProviderAvailability.Planned, capabilities: {} },
  { id: 'OPENROUTER', displayName: 'OpenRouter', status: ProviderAvailability.Planned, capabilities: {} },
  { id: 'ANTHROPIC', displayName: 'Anthropic', status: ProviderAvailability.Planned, capabilities: {} },
]

export interface ProviderRegistry {
  register(entry: ProviderRegistryEntry): void
  get(providerId: ProviderId): ProviderRegistryEntry
  has(providerId: ProviderId): boolean
  listAll(): ProviderRegistryEntry[]
  /** Providers that declare a profile for `capability`, available or planned alike. */
  listByCapability(capability: AICapability): ProviderRegistryEntry[]
}

/** In-memory registry, pre-seeded with every active and planned provider. */
export class InMemoryProviderRegistry implements ProviderRegistry {
  private readonly entries = new Map<ProviderId, ProviderRegistryEntry>()

  constructor(seed: ProviderRegistryEntry[] = [...ACTIVE_PROVIDERS, ...PLANNED_PROVIDERS]) {
    for (const entry of seed) {
      this.entries.set(entry.id, entry)
    }
  }

  register(entry: ProviderRegistryEntry): void {
    this.entries.set(entry.id, entry)
  }

  get(providerId: ProviderId): ProviderRegistryEntry {
    const entry = this.entries.get(providerId)
    if (!entry) {
      throw new ProviderRegistryError(`No provider registered for id "${providerId}".`)
    }
    return entry
  }

  has(providerId: ProviderId): boolean {
    return this.entries.has(providerId)
  }

  listAll(): ProviderRegistryEntry[] {
    return Array.from(this.entries.values())
  }

  listByCapability(capability: AICapability): ProviderRegistryEntry[] {
    return this.listAll().filter((entry) => entry.capabilities[capability] !== undefined)
  }
}
