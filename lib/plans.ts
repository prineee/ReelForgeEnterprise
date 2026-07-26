/**
 * plans.ts
 *
 * Single source of truth for every paid plan: pricing (USD — used by Stripe
 * and PayPal; INR — used by Razorpay, where available), credits, plan-gated
 * feature access, and affiliate commission rate. Every payment route
 * (Stripe, Razorpay, PayPal) and every feature gate (e.g. Movie Studio)
 * reads from PLANS/PLAN_BY_KEY here — nothing else in the codebase should
 * define its own plan or pricing data.
 */

export type PlanKey = "starter" | "pro" | "agency" | "vip";

/** Value stored in the users.plan column. */
export type DbPlan = "free" | "starter" | "pro" | "enterprise" | "vip";

export interface Plan {
  key: PlanKey;
  dbPlan: DbPlan;
  name: string;
  tagline: string;
  /** USD price — always available; Stripe and PayPal both charge in USD. */
  priceUSD: number;
  /**
   * INR price for Razorpay checkout. A plan without one isn't purchasable
   * via Razorpay yet — the Razorpay route rejects it rather than charging
   * an incorrect/NaN amount.
   */
  priceINR?: number;
  billing: "one-time" | "monthly";
  credits: number;
  /** Whether this plan unlocks the AI Movie Studio. */
  movieStudioAccess: boolean;
  features: string[];
  highlight?: boolean;
  badge?: string;
}

export const PLANS: Plan[] = [
  {
    key: "starter",
    dbPlan: "starter",
    name: "Starter",
    tagline: "For solo creators getting started.",
    priceUSD: 29,
    priceINR: 2999,
    billing: "one-time",
    credits: 100,
    movieStudioAccess: false,
    features: [
      "100 credits",
      "AI thumbnail generator",
      "Caption writer",
      "Script writer",
      "1080p exports",
      "Email support",
    ],
  },
  {
    key: "pro",
    dbPlan: "pro",
    name: "Pro",
    tagline: "For serious creators scaling output.",
    priceUSD: 67,
    priceINR: 4999,
    billing: "one-time",
    credits: 500,
    movieStudioAccess: true,
    highlight: true,
    badge: "Most Popular",
    features: [
      "500 credits",
      "Everything in Starter",
      "AI Movie Studio",
      "Reel generator",
      "4K exports",
      "Priority processing",
    ],
  },
  {
    key: "agency",
    dbPlan: "enterprise",
    name: "Agency",
    tagline: "For teams managing many clients.",
    priceUSD: 197,
    billing: "one-time",
    credits: 2000,
    movieStudioAccess: true,
    features: [
      "2,000 credits",
      "Everything in Pro",
      "API access",
      "White-label & custom branding",
      "Team seats",
    ],
  },
  {
    key: "vip",
    dbPlan: "vip",
    name: "VIP",
    tagline: "Maximum scale with white-glove service.",
    priceUSD: 19,
    billing: "monthly",
    credits: 10000,
    movieStudioAccess: true,
    badge: "Best Value",
    features: [
      "10,000 credits / month",
      "Everything in Agency",
      "Early access to new features",
      "Monthly credit refresh",
    ],
  },
];

export const PLAN_BY_KEY: Record<PlanKey, Plan> = Object.fromEntries(
  PLANS.map((p) => [p.key, p])
) as Record<PlanKey, Plan>;

export const PLAN_BY_DB: Partial<Record<DbPlan, Plan>> = Object.fromEntries(
  PLANS.map((p) => [p.dbPlan, p])
);

export const PLAN_CREDITS: Record<DbPlan, number> = {
  free: 10,
  starter: 100,
  pro: 500,
  enterprise: 2000,
  vip: 10000,
};

/** Affiliate commission rate (%) for a sale on this plan. */
export function getCommissionRate(plan: string): number {
  switch (plan) {
    case "starter":
      return 60;
    case "pro":
      return 40;
    case "agency":
      return 50;
    case "vip":
      return 50;
    default:
      return 30;
  }
}