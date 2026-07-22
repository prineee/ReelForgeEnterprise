/**
 * CreditCalculator.ts
 *
 * Pure pricing math: turns "this much generation" into "this many
 * credits." No ledger access, no state, no network calls — CreditManager
 * and BillingEngine call this to find out *how much* something costs, then
 * decide separately what to do with that number.
 *
 * Deliberately does not import services/orchestrator/CostEstimator.ts even
 * though the two solve a similar-sounding problem: that file estimates
 * cost for *planning* purposes before a production exists, while this one
 * computes the *actual charge* for usage that already happened. Keeping
 * them independent lets billing pricing diverge from planning estimates
 * (e.g. a promotional rate, a corrected price) without touching the
 * orchestrator, and vice versa — exactly the kind of accidental coupling
 * "DO NOT modify Orchestrator" is guarding against.
 *
 * It does import the orchestrator's ProviderId type (type-only, from a
 * zero-logic contracts file) purely so its per-provider rate table can
 * reference the same provider identifiers used elsewhere in the platform.
 * Any provider *not* in that union — a brand-new one, or a typo — still
 * prices correctly via DEFAULT_PROVIDER_MULTIPLIER, which is what makes
 * this calculator provider-independent rather than provider-locked.
 */

import type { ProviderId } from '../orchestrator/OrchestratorTypes'
import type { UsageCategory } from './BillingTypes'

export class CreditCalculatorError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'CreditCalculatorError'
  }
}

export interface CreditCalculationInput {
  category: UsageCategory
  providerId: string
  generationTimeSeconds?: number
  videoLengthSeconds?: number
  imageCount?: number
  sceneCount?: number
}

export interface CreditCalculationResult {
  category: UsageCategory
  providerId: string
  units: number
  credits: number
  note: string
}

type RateUnit = 'call' | 'image' | 'second' | 'scene'

interface CategoryRate {
  perUnit: number
  unit: RateUnit
}

/** Baseline credits per unit, before any provider multiplier. Placeholder pricing, not billing truth. */
const BASE_RATES: Record<UsageCategory, CategoryRate> = {
  STORY_GENERATION: { perUnit: 1, unit: 'call' },
  IMAGES: { perUnit: 2, unit: 'image' },
  VIDEOS: { perUnit: 1, unit: 'second' },
  VOICE: { perUnit: 0.15, unit: 'second' },
  RENDERING: { perUnit: 3, unit: 'scene' },
  STORAGE: { perUnit: 0.05, unit: 'scene' },
}

/** How much more (>1) or less (<1) a given provider costs relative to baseline. */
const PROVIDER_MULTIPLIER: Partial<Record<ProviderId, number>> = {
  GEMINI: 1,
  IMAGEN: 1,
  VEO: 1.1,
  CLOUDINARY: 0.8,
  ELEVENLABS: 1,
  OPENAI: 1.2,
  ANTHROPIC: 1.3,
  DEEPSEEK: 0.6,
  GROQ: 0.5,
  OPENROUTER: 0.9,
}

const DEFAULT_PROVIDER_MULTIPLIER = 1

/** Fallback seconds-per-scene used when neither videoLengthSeconds nor generationTimeSeconds is supplied. */
const DEFAULT_SCENE_SECONDS = 8

function getProviderMultiplier(providerId: string): number {
  return PROVIDER_MULTIPLIER[providerId as ProviderId] ?? DEFAULT_PROVIDER_MULTIPLIER
}

export class CreditCalculator {
  /** The raw quantity a rate's unit resolves to for a given input — exposed so UsageTracker can log the same number this calculator priced. */
  resolveUnitCount(input: CreditCalculationInput, unit: RateUnit): number {
    switch (unit) {
      case 'call':
        return 1
      case 'image':
        return Math.max(0, input.imageCount ?? 1)
      case 'second':
        return Math.max(
          0,
          input.videoLengthSeconds ?? input.generationTimeSeconds ?? (input.sceneCount ?? 1) * DEFAULT_SCENE_SECONDS
        )
      case 'scene':
        return Math.max(0, input.sceneCount ?? 1)
    }
  }

  calculate(input: CreditCalculationInput): CreditCalculationResult {
    const rate = BASE_RATES[input.category]
    if (!rate) {
      throw new CreditCalculatorError(`No rate configured for category "${input.category}".`)
    }

    const units = this.resolveUnitCount(input, rate.unit)
    const multiplier = getProviderMultiplier(input.providerId)
    const credits = Math.max(0, Math.ceil(units * rate.perUnit * multiplier))

    return {
      category: input.category,
      providerId: input.providerId,
      units,
      credits,
      note: `${units} ${rate.unit}(s) × ${rate.perUnit} credits × ${multiplier}x provider factor`,
    }
  }

  /** Convenience for pricing several capabilities of one production at once. */
  calculateMany(inputs: CreditCalculationInput[]): CreditCalculationResult[] {
    return inputs.map((input) => this.calculate(input))
  }
}
