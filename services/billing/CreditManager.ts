/**
 * CreditManager.ts
 *
 * The credit lifecycle's thin orchestration layer: grant, reserve,
 * consume, release, refund. All atomicity and reservation-state tracking
 * now live in the injected CreditLedger (see CreditTransaction.ts) — this
 * class no longer keeps its own `reservations` Map. That in-memory map was
 * itself a Vercel-serverless correctness gap: a reservation created while
 * handling one request would be invisible to consume()/release() called
 * while handling a later request on a different instance. The ledger's
 * reservation state (public.credit_reservations for
 * SupabaseCreditLedger) is what makes consume()/release() work no matter
 * which instance created the reservation.
 *
 * Typical lifecycle for one production:
 *   reserve()  — hold an upfront estimate before generation starts
 *   consume()  — spend some or all of the hold as real usage happens
 *   release()  — return an unused hold if the production never spent it
 *   refund()   — return credits after the fact (e.g. a completed charge
 *                turned out to be wrong, or goodwill)
 */

import type { CreditBalance, CreditReservation, CreditTransactionRecord, ProductionId, ReservationId, UsageCategory, UserId } from './BillingTypes'
import { TransactionType } from './BillingTypes'
import type { CreditLedger } from './CreditTransaction'
import { InsufficientCreditsError } from './CreditTransaction'

export { InsufficientCreditsError }

export class CreditManagerError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'CreditManagerError'
  }
}

export class CreditManager {
  constructor(private readonly ledger: CreditLedger) {}

  getBalance(userId: UserId): Promise<CreditBalance> {
    return this.ledger.getBalance(userId)
  }

  getHistory(userId: UserId): Promise<CreditTransactionRecord[]> {
    return this.ledger.getHistory(userId)
  }

  /** Adds credits outright — a purchase, a monthly subscription grant, or a goodwill adjustment. */
  async grantCredits(userId: UserId, amount: number, reason: string): Promise<CreditTransactionRecord> {
    if (amount <= 0) {
      throw new CreditManagerError('grantCredits() amount must be positive.')
    }
    return this.ledger.grant(userId, amount, TransactionType.Purchase, undefined, reason)
  }

  /**
   * Holds `amount` credits against a production before generation begins.
   * Throws InsufficientCreditsError if available balance is insufficient.
   * `category` doubles as this reservation's idempotency key together with
   * `productionId` — see CreditLedger.reserve()'s doc comment.
   */
  async reserve(
    userId: UserId,
    productionId: ProductionId,
    amount: number,
    category: UsageCategory | undefined,
    providerId: string | undefined,
    reason: string
  ): Promise<CreditReservation> {
    if (amount <= 0) {
      throw new CreditManagerError('reserve() amount must be positive.')
    }
    return this.ledger.reserve(userId, productionId, category, amount, providerId, reason)
  }

  getReservation(reservationId: ReservationId): Promise<CreditReservation | undefined> {
    return this.ledger.getReservation(reservationId)
  }

  /**
   * Spends `amount` from a HELD reservation. If `amount` is less than the
   * hold, the unused remainder is automatically released back to
   * available in the same call. `category` isn't a parameter here (unlike
   * the pre-persistence version) because the ledger already knows it —
   * it's stored on the reservation itself (see CreditLedger.reserve()).
   */
  async consume(reservationId: ReservationId, amount: number, reason: string = 'Usage charge'): Promise<CreditTransactionRecord> {
    if (amount <= 0) {
      throw new CreditManagerError('consume() amount must be positive.')
    }
    return this.ledger.consume(reservationId, amount, reason)
  }

  /** Returns an entire unused hold to available — e.g. a production was cancelled before any spend. */
  async release(reservationId: ReservationId, reason: string = 'Reservation released'): Promise<CreditTransactionRecord> {
    return this.ledger.release(reservationId, reason)
  }

  /** Returns credits after the fact — outside the reserve/consume flow entirely. */
  async refund(userId: UserId, amount: number, productionId: ProductionId | undefined, reason: string): Promise<CreditTransactionRecord> {
    if (amount <= 0) {
      throw new CreditManagerError('refund() amount must be positive.')
    }
    return this.ledger.grant(userId, amount, TransactionType.Refund, productionId, reason)
  }
}
