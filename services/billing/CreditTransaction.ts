/**
 * CreditTransaction.ts
 *
 * The credit ledger's storage contract (CreditLedger) plus two
 * implementations: InMemoryCreditLedger (process-local, for tests/dev) and
 * SupabaseCreditLedger (the production implementation, backed by
 * public.users.credits as the one authoritative balance, plus
 * public.credit_reservations for the HELD/CONSUMED/RELEASED lifecycle and
 * public.credit_transactions for history — see
 * supabase/migrations/20260809140000_persistent_credit_ledger.sql).
 *
 * Every balance-mutating method here is async and, for SupabaseCreditLedger,
 * backed by a single atomic Postgres function call (reserve_credits/
 * consume_credits/release_credits/grant_credits) — never a
 * read-balance-then-write-balance pair from this file, which would be
 * exactly the race two concurrent requests could exploit to double-spend.
 * The atomicity itself lives in the SQL functions (row-level locking via
 * `select ... for update`); this file only calls them and maps results/
 * errors to and from CreditManager's existing types.
 *
 * CreditLedger.reserve() takes `category` because it doubles as the
 * idempotency key together with `productionId` — a retried ReserveCredits
 * call for the same workflow (WorkflowContext.id, already used as
 * productionId everywhere in this module — see WorkflowExecutor.ts) and
 * the same category returns the original reservation instead of reserving
 * a second time. This was a real gap before: nothing previously prevented
 * a retried reserveCredits() from reserving twice.
 */

import { randomUUID } from 'crypto'
import type {
  CreditBalance,
  CreditReservation,
  CreditTransactionRecord,
  ProductionId,
  ReservationId,
  ReservationStatus,
  UsageCategory,
  UserId,
} from './BillingTypes'
import { TransactionType } from './BillingTypes'
import { createAdminClient } from '@/lib/supabase/admin'

export class CreditTransactionError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'CreditTransactionError'
  }
}

/**
 * Thrown by CreditLedger.reserve() when the user's available balance can't
 * cover the requested amount. Defined here (not in CreditManager.ts, which
 * re-exports it for backward compatibility) because both ledger
 * implementations detect and throw it directly — CreditManager.ts no
 * longer computes "insufficient" itself from a separately-fetched balance
 * (see file header on why that would be an unsafe check-then-act race).
 */
export class InsufficientCreditsError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'InsufficientCreditsError'
  }
}

export type NewTransactionInput = Omit<CreditTransactionRecord, 'id' | 'createdAt' | 'balanceAfter'>

export interface CreditLedger {
  /**
   * Atomically reserves `amount` for `userId` against a single
   * (productionId, category) key — the idempotency key described in the
   * file header. Throws InsufficientCreditsError if the available balance
   * can't cover it.
   */
  reserve(
    userId: UserId,
    productionId: ProductionId,
    category: UsageCategory | undefined,
    amount: number,
    providerId: string | undefined,
    reason: string
  ): Promise<CreditReservation>

  /** Finalizes `amount` (<= the held amount) from a HELD reservation; any unused remainder returns to the available balance. */
  consume(reservationId: ReservationId, amount: number, reason: string): Promise<CreditTransactionRecord>

  /** Returns an entire unused HELD reservation to the available balance. */
  release(reservationId: ReservationId, reason: string): Promise<CreditTransactionRecord>

  /** Adds credits outright (purchase/refund/adjustment) — no availability check. */
  grant(userId: UserId, amount: number, type: TransactionType, productionId: ProductionId | undefined, reason: string): Promise<CreditTransactionRecord>

  getReservation(reservationId: ReservationId): Promise<CreditReservation | undefined>
  getBalance(userId: UserId): Promise<CreditBalance>
  getHistory(userId: UserId): Promise<CreditTransactionRecord[]>
  getAllHistory(): Promise<CreditTransactionRecord[]>
}

function emptyBalance(userId: UserId): CreditBalance {
  return { userId, available: 0, reserved: 0, total: 0 }
}

/**
 * Development-only starting balance for a user this ledger has never seen
 * before. See the class-level comment on InMemoryCreditLedger for why this
 * class is no longer what production uses.
 */
const DEV_SEED_CREDITS = (() => {
  const raw = process.env.BILLING_DEV_SEED_CREDITS
  if (raw !== undefined) {
    const parsed = Number(raw)
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : 500
  }
  return process.env.NODE_ENV === 'production' ? 0 : 500
})()

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

/**
 * In-process CreditLedger — no persistence, no cross-instance visibility.
 * Kept for tests and local single-process use; createDefaultBillingEngine()
 * no longer defaults to this in application code (see BillingEngine.ts) —
 * a production billing path must not depend on it, since Vercel serverless
 * instances share no memory.
 */
export class InMemoryCreditLedger implements CreditLedger {
  private readonly transactions: CreditTransactionRecord[] = []
  private readonly balances = new Map<UserId, CreditBalance>()
  private readonly reservations = new Map<ReservationId, CreditReservation & { category?: UsageCategory }>()
  private readonly reservationByKey = new Map<string, ReservationId>()

  private idempotencyKey(productionId: ProductionId, category: UsageCategory | undefined): string {
    return `${productionId}:${category ?? ''}`
  }

  private append(entry: NewTransactionInput): CreditTransactionRecord {
    if (entry.amount < 0) {
      throw new CreditTransactionError('Transaction amount cannot be negative.')
    }

    const current = this.balances.get(entry.userId) ?? this.seedIfNeeded(entry.userId)
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

  private seedIfNeeded(userId: UserId): CreditBalance {
    const existing = this.balances.get(userId)
    if (existing) return existing
    if (DEV_SEED_CREDITS <= 0) return emptyBalance(userId)

    const seeded = applyTransaction(emptyBalance(userId), TransactionType.Adjustment, DEV_SEED_CREDITS)
    this.balances.set(userId, seeded)
    this.transactions.push({
      id: randomUUID(),
      userId,
      type: TransactionType.Adjustment,
      amount: DEV_SEED_CREDITS,
      reason: `Development seed grant (BILLING_DEV_SEED_CREDITS=${DEV_SEED_CREDITS})`,
      createdAt: new Date().toISOString(),
      balanceAfter: seeded,
    })
    return seeded
  }

  private requireHeld(reservationId: ReservationId): CreditReservation & { category?: UsageCategory } {
    const reservation = this.reservations.get(reservationId)
    if (!reservation) {
      throw new CreditTransactionError(`No reservation found for id "${reservationId}".`)
    }
    if (reservation.status !== 'HELD') {
      throw new CreditTransactionError(`Reservation "${reservationId}" is already ${reservation.status.toLowerCase()}.`)
    }
    return reservation
  }

  async reserve(
    userId: UserId,
    productionId: ProductionId,
    category: UsageCategory | undefined,
    amount: number,
    providerId: string | undefined,
    reason: string
  ): Promise<CreditReservation> {
    if (amount <= 0) {
      throw new CreditTransactionError('reserve() amount must be positive.')
    }

    const key = this.idempotencyKey(productionId, category)
    const existingId = this.reservationByKey.get(key)
    if (existingId) {
      return this.reservations.get(existingId)!
    }

    const balance = this.balances.get(userId) ?? this.seedIfNeeded(userId)
    if (balance.available < amount) {
      throw new InsufficientCreditsError(
        `User "${userId}" has ${balance.available} available credits, but ${amount} were requested for production "${productionId}".`
      )
    }

    const record = this.append({ userId, type: TransactionType.Reservation, amount, productionId, category, reason })
    void providerId // recorded on SupabaseCreditLedger's credit_reservations.provider_id; not modeled in this in-memory map.

    const reservation: CreditReservation & { category?: UsageCategory } = {
      id: record.id,
      userId,
      productionId,
      amount,
      status: 'HELD',
      createdAt: record.createdAt,
      category,
    }
    this.reservations.set(reservation.id, reservation)
    this.reservationByKey.set(key, reservation.id)
    return reservation
  }

  async consume(reservationId: ReservationId, amount: number, reason: string): Promise<CreditTransactionRecord> {
    const reservation = this.requireHeld(reservationId)
    if (amount <= 0) {
      throw new CreditTransactionError('consume() amount must be positive.')
    }
    if (amount > reservation.amount) {
      throw new CreditTransactionError(
        `Cannot consume ${amount} credits from reservation "${reservationId}": only ${reservation.amount} were held.`
      )
    }

    const record = this.append({
      userId: reservation.userId,
      type: TransactionType.Consumption,
      amount,
      productionId: reservation.productionId,
      category: reservation.category,
      reservationId,
      reason,
    })

    const unused = reservation.amount - amount
    if (unused > 0) {
      this.append({
        userId: reservation.userId,
        type: TransactionType.ReservationRelease,
        amount: unused,
        productionId: reservation.productionId,
        category: reservation.category,
        reservationId,
        reason: 'Unused portion of reservation released after partial consumption',
      })
    }

    this.reservations.set(reservationId, { ...reservation, status: 'CONSUMED' })
    return record
  }

  async release(reservationId: ReservationId, reason: string): Promise<CreditTransactionRecord> {
    const reservation = this.requireHeld(reservationId)

    const record = this.append({
      userId: reservation.userId,
      type: TransactionType.ReservationRelease,
      amount: reservation.amount,
      productionId: reservation.productionId,
      category: reservation.category,
      reservationId,
      reason,
    })

    this.reservations.set(reservationId, { ...reservation, status: 'RELEASED' })
    return record
  }

  async grant(userId: UserId, amount: number, type: TransactionType, productionId: ProductionId | undefined, reason: string): Promise<CreditTransactionRecord> {
    if (amount <= 0) {
      throw new CreditTransactionError('grant() amount must be positive.')
    }
    return this.append({ userId, type, amount, productionId, reason })
  }

  async getReservation(reservationId: ReservationId): Promise<CreditReservation | undefined> {
    return this.reservations.get(reservationId)
  }

  async getBalance(userId: UserId): Promise<CreditBalance> {
    return this.balances.get(userId) ?? this.seedIfNeeded(userId)
  }

  async getHistory(userId: UserId): Promise<CreditTransactionRecord[]> {
    return this.transactions.filter((t) => t.userId === userId)
  }

  async getAllHistory(): Promise<CreditTransactionRecord[]> {
    return [...this.transactions]
  }
}

// ── Supabase-backed ledger (production) ────────────────────────────────────

/** Matches reserve_credits()'s `raise exception 'INSUFFICIENT_CREDITS:%:%:%', userId, available, requested`. */
const INSUFFICIENT_CREDITS_PATTERN = /^INSUFFICIENT_CREDITS:([^:]*):(-?\d+):(-?\d+)/

interface ReservationRow {
  id: string
  user_id: string
  production_id: string
  category: string | null
  amount: number
  status: ReservationStatus
  created_at: string
}

interface TransactionRow {
  id: string
  user_id: string
  type: string
  amount: number
  description: string | null
  production_id: string | null
  reservation_id: string | null
  category: string | null
  balance_after: number | null
  created_at: string
}

function toReservation(row: ReservationRow): CreditReservation {
  return {
    id: row.id,
    userId: row.user_id,
    productionId: row.production_id,
    amount: row.amount,
    status: row.status,
    createdAt: row.created_at,
  }
}

/**
 * A transaction row's balanceAfter reflects only public.users.credits
 * (available), not reserved/total — CreditBalance.total/reserved aren't
 * reconstructable from a single row without a second query, and no caller
 * of CreditTransactionRecord.balanceAfter today reads anything but
 * .available in practice (InvoiceGenerator sums .amount, not
 * .balanceAfter). available is set correctly; reserved/total are
 * best-effort zero rather than fabricated.
 */
function toTransactionRecord(row: TransactionRow): CreditTransactionRecord {
  const available = row.balance_after ?? 0
  return {
    id: row.id,
    userId: row.user_id,
    type: row.type as TransactionType,
    amount: row.amount,
    balanceAfter: { userId: row.user_id, available, reserved: 0, total: available },
    productionId: row.production_id ?? undefined,
    category: (row.category as UsageCategory) ?? undefined,
    reservationId: row.reservation_id ?? undefined,
    reason: row.description ?? '',
    createdAt: row.created_at,
  }
}

function throwIfInsufficientCredits(message: string): never | void {
  const match = message.match(INSUFFICIENT_CREDITS_PATTERN)
  if (match) {
    const [, userId, available, requested] = match
    throw new InsufficientCreditsError(
      `User "${userId}" has ${available} available credits, but ${requested} were requested.`
    )
  }
}

/**
 * Production CreditLedger: public.users.credits is the one authoritative
 * balance (same column the dashboard, Razorpay purchase flow, and
 * lib/credits.ts's requireCredits() already read/write); reserve/consume/
 * release/grant each call one atomic Postgres function
 * (supabase/migrations/20260809140000_persistent_credit_ledger.sql) via
 * the service-role client — never exposed to the browser (see
 * lib/supabase/admin.ts).
 */
export class SupabaseCreditLedger implements CreditLedger {
  async reserve(
    userId: UserId,
    productionId: ProductionId,
    category: UsageCategory | undefined,
    amount: number,
    providerId: string | undefined,
    reason: string
  ): Promise<CreditReservation> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = (await (createAdminClient() as any).rpc('reserve_credits', {
      p_user_id: userId,
      p_production_id: productionId,
      p_category: category ?? null,
      p_amount: amount,
      p_label: category ?? null,
      p_provider_id: providerId ?? null,
      p_reason: reason,
    })) as { data: ReservationRow | null; error: { message: string } | null }

    if (error) {
      throwIfInsufficientCredits(error.message)
      throw new CreditTransactionError(`reserve_credits failed: ${error.message}`)
    }
    if (!data) {
      throw new CreditTransactionError('reserve_credits returned no reservation.')
    }
    return toReservation(data)
  }

  async consume(reservationId: ReservationId, amount: number, reason: string): Promise<CreditTransactionRecord> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = (await (createAdminClient() as any).rpc('consume_credits', {
      p_reservation_id: reservationId,
      p_amount: amount,
      p_reason: reason,
    })) as { data: TransactionRow | null; error: { message: string } | null }

    if (error) throw new CreditTransactionError(`consume_credits failed: ${error.message}`)
    if (!data) throw new CreditTransactionError('consume_credits returned no transaction.')
    return toTransactionRecord(data)
  }

  async release(reservationId: ReservationId, reason: string): Promise<CreditTransactionRecord> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = (await (createAdminClient() as any).rpc('release_credits', {
      p_reservation_id: reservationId,
      p_reason: reason,
    })) as { data: TransactionRow | null; error: { message: string } | null }

    if (error) throw new CreditTransactionError(`release_credits failed: ${error.message}`)
    if (!data) throw new CreditTransactionError('release_credits returned no transaction.')
    return toTransactionRecord(data)
  }

  async grant(userId: UserId, amount: number, type: TransactionType, productionId: ProductionId | undefined, reason: string): Promise<CreditTransactionRecord> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = (await (createAdminClient() as any).rpc('grant_credits', {
      p_user_id: userId,
      p_amount: amount,
      p_type: type,
      p_production_id: productionId ?? null,
      p_reason: reason,
    })) as { data: TransactionRow | null; error: { message: string } | null }

    if (error) throw new CreditTransactionError(`grant_credits failed: ${error.message}`)
    if (!data) throw new CreditTransactionError('grant_credits returned no transaction.')
    return toTransactionRecord(data)
  }

  async getReservation(reservationId: ReservationId): Promise<CreditReservation | undefined> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = (await (createAdminClient() as any)
      .from('credit_reservations')
      .select('*')
      .eq('id', reservationId)
      .maybeSingle()) as { data: ReservationRow | null; error: { message: string } | null }

    if (error) throw new CreditTransactionError(`getReservation failed: ${error.message}`)
    return data ? toReservation(data) : undefined
  }

  async getBalance(userId: UserId): Promise<CreditBalance> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [{ data: userRow, error: userError }, { data: heldRows, error: heldError }] = await Promise.all([
      (createAdminClient() as any).from('users').select('credits').eq('id', userId).maybeSingle(),
      (createAdminClient() as any).from('credit_reservations').select('amount').eq('user_id', userId).eq('status', 'HELD'),
    ]) as [
      { data: { credits: number } | null; error: { message: string } | null },
      { data: { amount: number }[] | null; error: { message: string } | null },
    ]

    if (userError) throw new CreditTransactionError(`getBalance failed: ${userError.message}`)
    if (heldError) throw new CreditTransactionError(`getBalance failed: ${heldError.message}`)

    const available = userRow?.credits ?? 0
    const reserved = (heldRows ?? []).reduce((sum, r) => sum + r.amount, 0)
    return { userId, available, reserved, total: available + reserved }
  }

  async getHistory(userId: UserId): Promise<CreditTransactionRecord[]> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = (await (createAdminClient() as any)
      .from('credit_transactions')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: true })
      .limit(5000)) as { data: TransactionRow[] | null; error: { message: string } | null }

    if (error) throw new CreditTransactionError(`getHistory failed: ${error.message}`)
    return (data ?? []).map(toTransactionRecord)
  }

  async getAllHistory(): Promise<CreditTransactionRecord[]> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = (await (createAdminClient() as any)
      .from('credit_transactions')
      .select('*')
      .order('created_at', { ascending: true })
      .limit(5000)) as { data: TransactionRow[] | null; error: { message: string } | null }

    if (error) throw new CreditTransactionError(`getAllHistory failed: ${error.message}`)
    return (data ?? []).map(toTransactionRecord)
  }
}
