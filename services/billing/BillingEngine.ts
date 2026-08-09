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
 * files. No payment gateway integration and no network calls in this file
 * itself — every method here delegates to CreditManager, whose injected
 * CreditLedger is what actually talks to Postgres (see CreditTransaction.ts).
 */

import type { CreditBalance, CreditReservation, CreditTransactionRecord, ProductionId, UsageCategory, UserId } from './BillingTypes'
import { CreditManager } from './CreditManager'
import { UsageTracker } from './UsageTracker'
import type { CreditCalculationInput } from './CreditCalculator'
import { CreditCalculator } from './CreditCalculator'
import { SupabaseCreditLedger } from './CreditTransaction'
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

  getBalance(userId: UserId): Promise<CreditBalance> {
    return this.creditManager.getBalance(userId)
  }

  getHistory(userId: UserId): Promise<CreditTransactionRecord[]> {
    return this.creditManager.getHistory(userId)
  }

  /** Grants a subscription plan's monthly credit allotment. */
  grantMonthlyCredits(userId: UserId, planId: SubscriptionPlanId): Promise<CreditTransactionRecord> {
    const plan = getPlan(planId)
    return this.creditManager.grantCredits(userId, plan.monthlyCredits, `Monthly grant — ${plan.displayName} plan`)
  }

  /**
   * Reserves credits for a production up front, priced across every
   * capability it's expected to need. Throws InsufficientCreditsError if
   * the user's available balance can't cover the estimate.
   *
   * `inputs` is priced as one combined amount but reserved as a single
   * CreditManager.reserve() call keyed by `inputs[0]`'s category — in
   * practice every caller (WorkflowExecutor.reservePerCategory()) passes
   * exactly one input per call, one call per category, so this always
   * reserves against a single well-defined category. That category is
   * also this reservation's idempotency key together with productionId
   * (see CreditLedger.reserve()'s doc comment) — a retried call for the
   * same production and category returns the original reservation
   * instead of reserving a second time.
   */
  reserveForProduction(userId: UserId, productionId: ProductionId, inputs: CreditCalculationInput[]): Promise<CreditReservation> {
    const results = this.calculator.calculateMany(inputs)
    const totalCredits = results.reduce((sum, r) => sum + r.credits, 0)
    return this.creditManager.reserve(
      userId,
      productionId,
      totalCredits,
      inputs[0]?.category,
      inputs[0]?.providerId,
      `Reservation for production "${productionId}" (${results.length} capabilities estimated)`
    )
  }

  /**
   * Prices and records one real usage event, then spends it from the
   * production's open reservation. This is the call a pipeline stage
   * makes as work actually happens (e.g. once a scene's video comes
   * back), as opposed to reserveForProduction()'s up-front estimate.
   */
  async chargeUsage(
    reservationId: string,
    userId: UserId,
    productionId: ProductionId,
    input: CreditCalculationInput
  ): Promise<CreditTransactionRecord> {
    const result = this.calculator.calculate(input)

    this.usageTracker.record({
      userId,
      productionId,
      category: input.category,
      providerId: input.providerId,
      units: result.units,
      creditsCharged: result.credits,
    })

    return this.creditManager.consume(reservationId, result.credits, `${input.category} via ${input.providerId} (${result.note})`)
  }

  /** Returns an entire unused reservation — e.g. the production was cancelled before any usage. */
  releaseReservation(reservationId: string, reason?: string): Promise<CreditTransactionRecord> {
    return this.creditManager.release(reservationId, reason)
  }

  /** Returns credits after the fact, outside the reserve/consume flow. */
  refund(userId: UserId, amount: number, productionId: ProductionId | undefined, reason: string): Promise<CreditTransactionRecord> {
    return this.creditManager.refund(userId, amount, productionId, reason)
  }

  getUsageForProduction(productionId: ProductionId) {
    return this.usageTracker.summarizeForProduction(productionId)
  }
}

/**
 * Wires a ready-to-use BillingEngine. Defaults to SupabaseCreditLedger —
 * public.users.credits as the authoritative balance — not
 * InMemoryCreditLedger: a production billing path must not depend on
 * per-process memory (see CreditTransaction.ts's file header). Pass an
 * explicit ledger for tests (InMemoryCreditLedger) or to share one ledger
 * instance across multiple BillingEngine instances (mirrors
 * services/orchestrator/AIOrchestrator.ts's createDefaultAIOrchestrator()).
 */
export function createDefaultBillingEngine(ledger: CreditLedger = new SupabaseCreditLedger()): BillingEngine {
  const creditManager = new CreditManager(ledger)
  const usageTracker = new UsageTracker()
  const calculator = new CreditCalculator()
  return new BillingEngine(creditManager, usageTracker, calculator)
}
