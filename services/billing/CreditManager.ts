/**
 * CreditManager.ts
 *
 * The credit lifecycle: grant, reserve, consume, release, refund. This is
 * the layer that decides *whether* a transaction is allowed (enough
 * available balance, reservation still HELD, …) and records it through the
 * injected CreditLedger. Reservation state (HELD/CONSUMED/RELEASED) is
 * tracked here rather than in the ledger, since a reservation is a
 * business decision in progress, not an immutable past event.
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

export class InsufficientCreditsError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'InsufficientCreditsError'
  }
}

export class CreditManagerError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'CreditManagerError'
  }
}

export class CreditManager {
  private readonly reservations = new Map<ReservationId, CreditReservation>()

  constructor(private readonly ledger: CreditLedger) {}

  getBalance(userId: UserId): CreditBalance {
    return this.ledger.getBalance(userId)
  }

  getHistory(userId: UserId): CreditTransactionRecord[] {
    return this.ledger.getHistory(userId)
  }

  /** Adds credits outright — a purchase, a monthly subscription grant, or a goodwill adjustment. */
  grantCredits(userId: UserId, amount: number, reason: string): CreditTransactionRecord {
    if (amount <= 0) {
      throw new CreditManagerError('grantCredits() amount must be positive.')
    }
    return this.ledger.append({ userId, type: TransactionType.Purchase, amount, reason })
  }

  /** Holds `amount` credits against a production before generation begins. Throws if available balance is insufficient. */
  reserve(userId: UserId, productionId: ProductionId, amount: number, reason: string): CreditReservation {
    if (amount <= 0) {
      throw new CreditManagerError('reserve() amount must be positive.')
    }

    const balance = this.ledger.getBalance(userId)
    if (balance.available < amount) {
      throw new InsufficientCreditsError(
        `User "${userId}" has ${balance.available} available credits, but ${amount} were requested for production "${productionId}".`
      )
    }

    const record = this.ledger.append({ userId, type: TransactionType.Reservation, amount, productionId, reason })

    const reservation: CreditReservation = {
      id: record.id,
      userId,
      productionId,
      amount,
      status: 'HELD',
      createdAt: record.createdAt,
    }
    this.reservations.set(reservation.id, reservation)
    return reservation
  }

  getReservation(reservationId: ReservationId): CreditReservation | undefined {
    return this.reservations.get(reservationId)
  }

  /**
   * Spends `amount` (defaulting to the full held amount) from a HELD
   * reservation. If `amount` is less than the hold, the unused remainder
   * is automatically released back to available in the same call.
   */
  consume(reservationId: ReservationId, amount?: number, category?: UsageCategory, reason: string = 'Usage charge'): CreditTransactionRecord {
    const reservation = this.requireHeldReservation(reservationId)
    const spend = amount ?? reservation.amount

    if (spend <= 0) {
      throw new CreditManagerError('consume() amount must be positive.')
    }
    if (spend > reservation.amount) {
      throw new CreditManagerError(
        `Cannot consume ${spend} credits from reservation "${reservationId}": only ${reservation.amount} were held. ` +
          `Reserve additional credits first.`
      )
    }

    const record = this.ledger.append({
      userId: reservation.userId,
      type: TransactionType.Consumption,
      amount: spend,
      productionId: reservation.productionId,
      category,
      reservationId,
      reason,
    })

    const unused = reservation.amount - spend
    if (unused > 0) {
      this.ledger.append({
        userId: reservation.userId,
        type: TransactionType.ReservationRelease,
        amount: unused,
        productionId: reservation.productionId,
        reservationId,
        reason: 'Unused portion of reservation released after partial consumption',
      })
    }

    this.reservations.set(reservationId, { ...reservation, status: 'CONSUMED' })
    return record
  }

  /** Returns an entire unused hold to available — e.g. a production was cancelled before any spend. */
  release(reservationId: ReservationId, reason: string = 'Reservation released'): CreditTransactionRecord {
    const reservation = this.requireHeldReservation(reservationId)

    const record = this.ledger.append({
      userId: reservation.userId,
      type: TransactionType.ReservationRelease,
      amount: reservation.amount,
      productionId: reservation.productionId,
      reservationId,
      reason,
    })

    this.reservations.set(reservationId, { ...reservation, status: 'RELEASED' })
    return record
  }

  /** Returns credits after the fact — outside the reserve/consume flow entirely. */
  refund(userId: UserId, amount: number, productionId: ProductionId | undefined, reason: string): CreditTransactionRecord {
    if (amount <= 0) {
      throw new CreditManagerError('refund() amount must be positive.')
    }
    return this.ledger.append({ userId, type: TransactionType.Refund, amount, productionId, reason })
  }

  private requireHeldReservation(reservationId: ReservationId): CreditReservation {
    const reservation = this.reservations.get(reservationId)
    if (!reservation) {
      throw new CreditManagerError(`No reservation found for id "${reservationId}".`)
    }
    if (reservation.status !== 'HELD') {
      throw new CreditManagerError(`Reservation "${reservationId}" is already ${reservation.status.toLowerCase()}.`)
    }
    return reservation
  }
}
