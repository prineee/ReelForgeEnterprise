/**
 * BillingEngine.ts
 *
 * The Credit & Billing Engine's single entry point: every production is
 * meant to reserve, spend, and (if needed) release or refund credits
 * through this class rather than touching CreditManager/UsageTracker/
 * CreditCalculator directly. Wraps them the same way AIOrchestrator wraps
 * ProviderSelector/CostEstimator/GenerationEstimator, and QueueManager
 * wraps JobQueue/JobScheduler/JobWorker.
 *
 * Not wired into MovieProductionService, the Queue, or the Orchestrator —
 * this is a standalone module a future caller can adopt (e.g. reserving
 * credits before QueueManager.submit(), or charging usage as each
 * MovieProductionService stage completes) without any change to those
 * files. No payment gateway, no database, no network calls anywhere here.
 */

import type { CreditBalance, CreditReservation, CreditTransactionRecord, ProductionId, UsageCategory, UserId } from './BillingTypes'
import { CreditManager } from './CreditManager'
import { UsageTracker } from './UsageTracker'
import type { CreditCalculationInput } from './CreditCalculator'
import { CreditCalculator } from './CreditCalculator'
import { InMemoryCreditLedger } from './CreditTransaction'
import type { CreditLedger } from './CreditTransaction'
import { getPlan } from './SubscriptionPolicy'
import type { SubscriptionPlanId } from './SubscriptionPolicy'

export class BillingEngineError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message)
    this.name = 'BillingEngineError'
  }
}

export interface ProductionEstimateInput {
  storyCalls?: number
  imageCount?: number
  videoLengthSeconds?: number
  sceneCount?: number
  providerId: string
  categories?: UsageCategory[]
}

export class BillingEngine {
  constructor(
    private readonly creditManager: CreditManager,
    private readonly usageTracker: UsageTracker,
    private readonly calculator: CreditCalculator
  ) {}

  getBalance(userId: UserId): CreditBalance {
    return this.creditManager.getBalance(userId)
  }

  getHistory(userId: UserId): CreditTransactionRecord[] {
    return this.creditManager.getHistory(userId)
  }

  /** Grants a subscription plan's monthly credit allotment. */
  grantMonthlyCredits(userId: UserId, planId: SubscriptionPlanId): CreditTransactionRecord {
    const plan = getPlan(planId)
    return this.creditManager.grantCredits(userId, plan.monthlyCredits, `Monthly grant — ${plan.displayName} plan`)
  }

  /**
   * Reserves credits for a production up front, priced across every
   * capability it's expected to need. Throws InsufficientCreditsError if
   * the user's available balance can't cover the estimate.
   */
  reserveForProduction(userId: UserId, productionId: ProductionId, inputs: CreditCalculationInput[]): CreditReservation {
    const results = this.calculator.calculateMany(inputs)
    const totalCredits = results.reduce((sum, r) => sum + r.credits, 0)
    return this.creditManager.reserve(
      userId,
      productionId,
      totalCredits,
      `Reservation for production "${productionId}" (${results.length} capabilities estimated)`
    )
  }

  /**
   * Prices and records one real usage event, then spends it from the
   * production's open reservation. This is the call a pipeline stage
   * makes as work actually happens (e.g. once a scene's video comes
   * back), as opposed to reserveForProduction()'s up-front estimate.
   */
  chargeUsage(
    reservationId: string,
    userId: UserId,
    productionId: ProductionId,
    input: CreditCalculationInput
  ): CreditTransactionRecord {
    const result = this.calculator.calculate(input)

    this.usageTracker.record({
      userId,
      productionId,
      category: input.category,
      providerId: input.providerId,
      units: result.units,
      creditsCharged: result.credits,
    })

    return this.creditManager.consume(reservationId, result.credits, input.category, `${input.category} via ${input.providerId} (${result.note})`)
  }

  /** Returns an entire unused reservation — e.g. the production was cancelled before any usage. */
  releaseReservation(reservationId: string, reason?: string): CreditTransactionRecord {
    return this.creditManager.release(reservationId, reason)
  }

  /** Returns credits after the fact, outside the reserve/consume flow. */
  refund(userId: UserId, amount: number, productionId: ProductionId | undefined, reason: string): CreditTransactionRecord {
    return this.creditManager.refund(userId, amount, productionId, reason)
  }

  getUsageForProduction(productionId: ProductionId) {
    return this.usageTracker.summarizeForProduction(productionId)
  }
}

/**
 * Wires the default in-memory ledger, credit manager, usage tracker, and
 * calculator into a ready-to-use BillingEngine. No setup required — pass
 * an explicit ledger instead if a caller wants to share balances across
 * multiple BillingEngine instances (mirrors
 * services/orchestrator/AIOrchestrator.ts's createDefaultAIOrchestrator()).
 */
export function createDefaultBillingEngine(ledger: CreditLedger = new InMemoryCreditLedger()): BillingEngine {
  const creditManager = new CreditManager(ledger)
  const usageTracker = new UsageTracker()
  const calculator = new CreditCalculator()
  return new BillingEngine(creditManager, usageTracker, calculator)
}
