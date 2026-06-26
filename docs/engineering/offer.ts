/**
 * @file types/offer.ts
 * @description Defines the core data structures for all commercial offers in ReelForge.
 * This serves as the single source of truth for offer-related type definitions.
 */

export type OfferId =
  | "starter"
  | "pro"
  | "agency"
  | "vip"
  | "order-bump"
  | "oto-1"
  | "oto-2"
  | "oto-3"
  | "oto-4"
  | "black-friday-2026-pro";

export type BillingType = "one-time" | "monthly" | "annual";
export type Currency = "USD" | "INR";

export interface Offer {
  id: OfferId;
  /** Unique URL-friendly identifier for the offer page. */
  slug: string;
  name: string;
  headline: string;
  subtitle?: string;
  description?: string;
  price: number;
  originalPrice?: number;
  currency: Currency;
  billingType: BillingType;
  recommended?: boolean;
  badge?: string;
  features: string[];
  bonuses?: string[];
  guarantee?: string;
  ctaText: string;
  purchaseUrl: string;
  /** The ID of the next offer in the funnel sequence. */
  nextOffer?: OfferId;
  /** The ID of the previous offer in the funnel sequence. */
  previousOffer?: OfferId;
  /** Should this offer be displayed on the main pricing page? */
  visible: boolean;
  /** Is this offer currently active and purchasable? */
  active: boolean;
  priority: number;
  theme?: "default" | "premium" | "vip";
  analyticsKey?: string;
}