/**
 * BillingTypes.ts
 *
 * The public vocabulary for the Credit & Billing Engine: balances,
 * transactions, reservations, usage events, and invoices. Type-only — no
 * business logic, no classes, no imports — mirroring the same rule
 * OrchestratorTypes.ts and QueueTypes.ts follow, so this stays a stable
 * contract independent of whatever ledger implementation sits underneath
 * it (in-memory today, a database later).
 *
 * Deliberately provider-independent: `providerId` fields here are plain
 * strings, not the orchestrator's ProviderId union — this ledger must be
 * able to bill for a provider it's never heard of without a type change.
 * (CreditCalculator.ts, which actually prices by provider, imports the
 * stricter type where it's useful and falls back gracefully otherwise —
 * see its file header.)
 */

export type UserId = string
export type ProductionId = string
export type TransactionId = string
export type ReservationId = string
export type ISODateTimeString = string

/** The kinds of AI work credits get spent on — one per real pipeline stage that costs money. */
export enum UsageCategory {
  StoryGeneration = 'STORY_GENERATION',
  Images = 'IMAGES',
  Videos = 'VIDEOS',
  Voice = 'VOICE',
  Rendering = 'RENDERING',
  Storage = 'STORAGE',
}

/**
 * Every kind of ledger entry. Purchase/Refund/Adjustment always increase
 * available+total. Reservation moves credits from available to reserved
 * (total unchanged — nothing is spent yet). Consumption spends from a
 * reservation (reserved and total both decrease). ReservationRelease
 * returns an unused hold to available (total unchanged). See
 * CreditTransaction.ts for the exact balance arithmetic.
 */
export enum TransactionType {
  Purchase = 'PURCHASE',
  Reservation = 'RESERVATION',
  Consumption = 'CONSUMPTION',
  Refund = 'REFUND',
  ReservationRelease = 'RESERVATION_RELEASE',
  Adjustment = 'ADJUSTMENT',
}

export type ReservationStatus = 'HELD' | 'CONSUMED' | 'RELEASED'

export interface CreditTransactionRecord {
  id: TransactionId
  userId: UserId
  type: TransactionType
  /** Always non-negative; direction is implied by `type`. */
  amount: number
  balanceAfter: CreditBalance
  productionId?: ProductionId
  category?: UsageCategory
  /** Present on Consumption/ReservationRelease entries — points back at the Reservation they settle. */
  reservationId?: ReservationId
  reason: string
  createdAt: ISODateTimeString
}

export interface CreditReservation {
  id: ReservationId
  userId: UserId
  productionId: ProductionId
  amount: number
  status: ReservationStatus
  createdAt: ISODateTimeString
}

export interface CreditBalance {
  userId: UserId
  /** Spendable now. */
  available: number
  /** Held against in-flight productions via an open Reservation. */
  reserved: number
  /** available + reserved. */
  total: number
}

export interface UsageEvent {
  id: string
  userId: UserId
  productionId: ProductionId
  category: UsageCategory
  providerId: string
  /** Raw quantity this charge was based on — meaning depends on category (images, seconds, scenes, …). */
  units: number
  creditsCharged: number
  recordedAt: ISODateTimeString
}

export interface UsageSummary {
  category: UsageCategory
  totalUnits: number
  totalCredits: number
  eventCount: number
}

export interface InvoiceLineItem {
  label: string
  quantity: number
  amountUsd: number
}

export interface Invoice {
  id: string
  userId: UserId
  periodStart: ISODateTimeString
  periodEnd: ISODateTimeString
  creditsPurchased: number
  creditsUsed: number
  creditsRefunded: number
  lineItems: InvoiceLineItem[]
  subtotalUsd: number
  taxRate: number
  taxUsd: number
  totalUsd: number
  generatedAt: ISODateTimeString
}
