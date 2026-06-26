/**
 * Centralized pricing configuration.
 *
 * Every plan is defined here — never inside UI components. The pricing page,
 * and future Order Bump / OTO pages, all import from this single source.
 */

export type PlanId = "starter" | "pro" | "agency" | "vip";

export interface PricingPlan {
  id: PlanId;
  name: string;
  tagline: string;
  /** Headline price, e.g. "$29". */
  price: string;
  originalPrice?: string;
  savings?: string;
  /** Billing model shown to the buyer. */
  billing: "one-time" | "monthly";
  billingNote: string;

  // Required per-plan attributes
  aiCredits: string;
  exportQuality: string;
  commercialUsage: string;
  priority: string;
  support: string;
  limits: string[];
  features: string[];

  recommended?: boolean;
  badge?: string;

  /** Configurable purchase URL — CTAs route here only (no payment logic). */
  purchaseUrl: string;
  ctaText?: string;
}

/** The plan promoted in upgrade CTAs. */
export const RECOMMENDED_PLAN_ID: PlanId = "pro";