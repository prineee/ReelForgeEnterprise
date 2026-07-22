/**
 * CreditTransaction.ts
 *
 * The append-only credit ledger: every balance change is recorded as an
 * immutable CreditTransactionRecord, and each user's CreditBalance is
 * derived by folding transactions in as they're appended (not
 * recomputed from full history on every read — this stays O(1) per
 * append/read, same tradeoff a real database ledger table + materialized
 * balance column would make).
 *
 * This is pure bookkeeping: it doesn't decide *whether* a transaction
 * should happen (insufficient-funds checks, reservation state machine —
 * that's CreditManager.ts), only how one changes a balance once it's been
 * decided. In-memory only, swappable later behind the same interface.
 */

import { randomUUID } from 'crypto'
import type { CreditBalance, CreditTransactionRecord, UserId } from './BillingTypes'
import { TransactionType } from './BillingTypes'

export class CreditTransactionError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'CreditTransactionError'
  }
}

export type NewTransactionInput = Omit<CreditTransactionRecord, 'id' | 'createdAt' | 'balanceAfter'>

export interface CreditLedger {
  append(entry: NewTransactionInput): CreditTransactionRecord
  getBalance(userId: UserId): CreditBalance
  getHistory(userId: UserId): CreditTransactionRecord[]
  getAllHistory(): CreditTransactionRecord[]
}

function emptyBalance(userId: UserId): CreditBalance {
  return { userId, available: 0, reserved: 0, total: 0 }
}

/**
 * Development-only starting balance for a user this ledger has never seen
 * before. InMemoryCreditLedger has no connection to any external credit
 * system (see file header) — a brand-new instance starts with an empty
 * `balances` Map, and nothing in the Billing Engine ever grants a new user
 * an initial balance, so every real production's ReserveCredits stage
 * throws InsufficientCreditsError against a real 0. This seed exists so a
 * developer running the workflow locally has something to reserve against,
 * without hardcoding unlimited credits or bypassing reserve()'s own
 * insufficient-funds check (it still runs normally against whatever
 * balance results). Configurable via BILLING_DEV_SEED_CREDITS; set it to 0
 * to disable seeding entirely and restore the original real-zero-balance
 * behavior. 500 is the default — enough to cover one full production's
 * five reservations (story/images/video/voice/rendering) at the current
 * placeholder BASE_RATES in CreditCalculator.ts with room for more than
 * one test run, not an arbitrarily large/unlimited number.
 */
const DEV_SEED_CREDITS = (() => {
  const raw = process.env.BILLING_DEV_SEED_CREDITS
  if (raw === undefined) return 500
  const parsed = Number(raw)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 500
})()

/**
 * Applies one transaction's effect to a balance. See BillingTypes.ts's
 * TransactionType doc comment for the arithmetic each type performs.
 */
function applyTransaction(balance: CreditBalance, type: TransactionType, amount: number): CreditBalance {
  switch (type) {
    case 'PURCHASE':
    case 'REFUND':
    case 'ADJUSTMENT':
      return { ...balance, available: balance.available + amount, total: balance.total + amount }
    case 'RESERVATION':
      return { ...balance, available: balance.available - amount, reserved: balance.reserved + amount }
    case 'CONSUMPTION':
      return { ...balance, reserved: balance.reserved - amount, total: balance.total - amount }
    case 'RESERVATION_RELEASE':
      return { ...balance, reserved: balance.reserved - amount, available: balance.available + amount }
    default:
      return balance
  }
}

export class InMemoryCreditLedger implements CreditLedger {
  private readonly transactions: CreditTransactionRecord[] = []
  private readonly balances = new Map<UserId, CreditBalance>()

  append(entry: NewTransactionInput): CreditTransactionRecord {
    if (entry.amount < 0) {
      throw new CreditTransactionError('Transaction amount cannot be negative.')
    }

    const current = this.balances.get(entry.userId) ?? emptyBalance(entry.userId)
    const next = applyTransaction(current, entry.type, entry.amount)

    if (next.available < 0 || next.reserved < 0 || next.total < 0) {
      throw new CreditTransactionError(
        `Transaction would produce a negative balance for user "${entry.userId}" (available=${next.available}, reserved=${next.reserved}, total=${next.total}).`
      )
    }

    this.balances.set(entry.userId, next)

    const record: CreditTransactionRecord = {
      ...entry,
      id: randomUUID(),
      createdAt: new Date().toISOString(),
      balanceAfter: next,
    }
    this.transactions.push(record)
    return record
  }

  getBalance(userId: UserId): CreditBalance {
    const existing = this.balances.get(userId)
    if (existing) return existing

    if (DEV_SEED_CREDITS > 0) {
      // First time this ledger has ever seen this userId: grant the
      // one-time development seed through the normal append() path (same
      // arithmetic as any other real grant, fully reflected in
      // getHistory()), then return the resulting balance. Every later
      // getBalance() call for this userId hits the `existing` branch
      // above instead, so this only ever runs once per user per process.
      return this.append({
        userId,
        type: TransactionType.Adjustment,
        amount: DEV_SEED_CREDITS,
        reason: `Development seed grant (BILLING_DEV_SEED_CREDITS=${DEV_SEED_CREDITS})`,
      }).balanceAfter
    }

    return emptyBalance(userId)
  }

  getHistory(userId: UserId): CreditTransactionRecord[] {
    return this.transactions.filter((t) => t.userId === userId)
  }

  getAllHistory(): CreditTransactionRecord[] {
    return [...this.transactions]
  }
}
