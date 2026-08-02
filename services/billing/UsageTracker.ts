/**
 * UsageTracker.ts
 *
 * Records what was actually generated — one UsageEvent per charge, tagged
 * by production, category, and provider — independently of the credit
 * ledger's balance bookkeeping. BillingEngine writes to this whenever it
 * charges usage via CreditCalculator/CreditManager; this file itself never
 * touches balances or reservations. Kept separate from CreditTransaction.ts
 * because usage history (what was made) and credit history (what it cost)
 * answer different questions and a caller may want one without the other.
 */

import { randomUUID } from 'crypto'
import type { ProductionId, UsageCategory, UsageEvent, UsageSummary, UserId } from './BillingTypes'

export class UsageTrackerError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'UsageTrackerError'
  }
}

export type NewUsageEventInput = Omit<UsageEvent, 'id' | 'recordedAt'>

export class UsageTracker {
  private readonly events: UsageEvent[] = []

  record(input: NewUsageEventInput): UsageEvent {
    if (input.units < 0) {
      throw new UsageTrackerError('UsageEvent.units cannot be negative.')
    }
    if (input.creditsCharged < 0) {
      throw new UsageTrackerError('UsageEvent.creditsCharged cannot be negative.')
    }

    const event: UsageEvent = { ...input, id: randomUUID(), recordedAt: new Date().toISOString() }
    this.events.push(event)
    return event
  }

  getEventsForProduction(productionId: ProductionId): UsageEvent[] {
    return this.events.filter((e) => e.productionId === productionId)
  }

  getEventsForUser(userId: UserId): UsageEvent[] {
    return this.events.filter((e) => e.userId === userId)
  }

  /** Aggregates every recorded category, optionally scoped to one user. */
  summarizeByCategory(userId?: UserId): UsageSummary[] {
    const scoped = userId ? this.events.filter((e) => e.userId === userId) : this.events
    return this.aggregate(scoped)
  }

  summarizeForProduction(productionId: ProductionId): UsageSummary[] {
    return this.aggregate(this.getEventsForProduction(productionId))
  }

  private aggregate(events: UsageEvent[]): UsageSummary[] {
    const byCategory = new Map<UsageCategory, UsageSummary>()

    for (const event of events) {
      const existing = byCategory.get(event.category)
      if (existing) {
        existing.totalUnits += event.units
        existing.totalCredits += event.creditsCharged
        existing.eventCount += 1
      } else {
        byCategory.set(event.category, {
          category: event.category,
          totalUnits: event.units,
          totalCredits: event.creditsCharged,
          eventCount: 1,
        })
      }
    }

    return Array.from(byCategory.values())
  }
}
