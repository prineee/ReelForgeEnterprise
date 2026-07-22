/**
 * InvoiceGenerator.ts
 *
 * Builds an Invoice model from a user's ledger history over a billing
 * period. Reads through CreditLedger only — no payment gateway, no
 * database, no rendering (PDF/HTML generation is a future concern layered
 * on top of this model, not this file's job).
 *
 * Billing semantics: what's actually charged (subtotal/total) is credits
 * *purchased* during the period minus any *refunds*, priced at
 * usdPerCredit — not credits *used*, since usage was already paid for at
 * purchase time (or granted free via a subscription). Credits Used is
 * reported on the invoice for transparency but doesn't add to the total.
 */

import { randomUUID } from 'crypto'
import type { CreditTransactionRecord, Invoice, InvoiceLineItem, ISODateTimeString, UserId } from './BillingTypes'
import type { CreditLedger } from './CreditTransaction'

export class InvoiceGeneratorError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'InvoiceGeneratorError'
  }
}

export interface InvoiceGeneratorOptions {
  usdPerCredit: number
  taxRate: number
}

export const DEFAULT_INVOICE_OPTIONS: InvoiceGeneratorOptions = {
  usdPerCredit: 0.02,
  taxRate: 0.08,
}

function sumAmount(records: CreditTransactionRecord[]): number {
  return records.reduce((sum, r) => sum + r.amount, 0)
}

export class InvoiceGenerator {
  constructor(private readonly ledger: CreditLedger, private readonly options: InvoiceGeneratorOptions = DEFAULT_INVOICE_OPTIONS) {}

  generate(userId: UserId, periodStart: ISODateTimeString, periodEnd: ISODateTimeString): Invoice {
    const start = new Date(periodStart).getTime()
    const end = new Date(periodEnd).getTime()
    if (Number.isNaN(start) || Number.isNaN(end) || start >= end) {
      throw new InvoiceGeneratorError(`Invalid invoice period: periodStart must be before periodEnd (got "${periodStart}" .. "${periodEnd}").`)
    }

    const history = this.ledger
      .getHistory(userId)
      .filter((t) => {
        const at = new Date(t.createdAt).getTime()
        return at >= start && at < end
      })

    const purchases = history.filter((t) => t.type === 'PURCHASE')
    const consumptions = history.filter((t) => t.type === 'CONSUMPTION')
    const refunds = history.filter((t) => t.type === 'REFUND')

    const creditsPurchased = sumAmount(purchases)
    const creditsUsed = sumAmount(consumptions)
    const creditsRefunded = sumAmount(refunds)

    const lineItems: InvoiceLineItem[] = [
      ...purchases.map((t) => ({ label: `Credit purchase — ${t.reason}`, quantity: t.amount, amountUsd: this.toUsd(t.amount) })),
      ...refunds.map((t) => ({ label: `Refund — ${t.reason}`, quantity: -t.amount, amountUsd: -this.toUsd(t.amount) })),
    ]

    if (creditsUsed > 0) {
      lineItems.push({ label: 'Credits used this period (already paid)', quantity: creditsUsed, amountUsd: 0 })
    }

    const subtotalUsd = this.toUsd(creditsPurchased) - this.toUsd(creditsRefunded)
    const taxUsd = Number((subtotalUsd * this.options.taxRate).toFixed(2))
    const totalUsd = Number((subtotalUsd + taxUsd).toFixed(2))

    return {
      id: randomUUID(),
      userId,
      periodStart,
      periodEnd,
      creditsPurchased,
      creditsUsed,
      creditsRefunded,
      lineItems,
      subtotalUsd: Number(subtotalUsd.toFixed(2)),
      taxRate: this.options.taxRate,
      taxUsd,
      totalUsd,
      generatedAt: new Date().toISOString(),
    }
  }

  private toUsd(credits: number): number {
    return Number((credits * this.options.usdPerCredit).toFixed(2))
  }
}
