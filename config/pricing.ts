import type {
  ComparisonPlan,
  FAQAccordionItem,
  FunnelGuarantee,
  FunnelTestimonial,
} from "@/components/funnel";

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

export const PRICING_PLANS: PricingPlan[] = [
  {
    id: "starter",
    name: "Starter",
    tagline: "For solo creators getting started.",
    price: "$29",
    billing: "one-time",
    billingNote: "One-time payment · lifetime access",
    aiCredits: "100 AI credits",
    exportQuality: "1080p HD",
    commercialUsage: "Personal use",
    priority: "Standard",
    support: "Email support",
    limits: ["100 AI credits", "Up to 1080p exports", "1 user seat"],
    features: ["All AI studios", "Caption burner", "Thumbnail maker"],
    purchaseUrl: "/register?plan=starter",
  },
  {
    id: "pro",
    name: "Pro",
    tagline: "For serious creators scaling output.",
    price: "$67",
    originalPrice: "$97",
    savings: "Save $30",
    billing: "one-time",
    billingNote: "One-time payment · lifetime access",
    aiCredits: "500 AI credits",
    exportQuality: "4K Ultra HD",
    commercialUsage: "Commercial license",
    priority: "Priority",
    support: "Priority email support",
    limits: ["500 AI credits", "Up to 4K exports", "1 user seat"],
    features: [
      "Everything in Starter",
      "Affiliate program access",
      "Priority rendering queue",
    ],
    recommended: true,
    badge: "Most Popular",
    purchaseUrl: "/register?plan=pro",
  },
  {
    id: "agency",
    name: "Agency",
    tagline: "For teams managing many clients.",
    price: "$197",
    originalPrice: "$297",
    savings: "Save $100",
    billing: "one-time",
    billingNote: "One-time payment · lifetime access",
    aiCredits: "2,000 AI credits",
    exportQuality: "4K Ultra HD",
    commercialUsage: "Commercial license + white-label",
    priority: "Highest",
    support: "Dedicated account manager",
    limits: ["2,000 AI credits", "Up to 4K exports", "Up to 5 user seats"],
    features: [
      "Everything in Pro",
      "API access",
      "White-label & custom branding",
      "Team seats",
    ],
    purchaseUrl: "/register?plan=agency",
  },
  {
    id: "vip",
    name: "VIP",
    tagline: "Maximum scale with white-glove service.",
    price: "$19",
    billing: "monthly",
    billingNote: "Billed monthly · cancel anytime",
    aiCredits: "10,000 AI credits / mo",
    exportQuality: "4K Ultra HD",
    commercialUsage: "Commercial license",
    priority: "Highest (VIP queue)",
    support: "1:1 onboarding + priority",
    limits: ["10,000 monthly credits", "Up to 4K exports", "Priority rendering"],
    features: [
      "Everything in Agency",
      "Early access to new features",
      "Monthly credit refresh",
    ],
    badge: "Best Value",
    purchaseUrl: "/register?plan=vip",
  },
];

/** Capability matrix powering the feature comparison table. */
export const COMPARISON_FEATURES: { label: string; plans: Record<PlanId, boolean> }[] = [
  { label: "All AI studios (Movie, Cartoon, Reel, Marketing)", plans: { starter: true, pro: true, agency: true, vip: true } },
  { label: "Commercial usage license", plans: { starter: false, pro: true, agency: true, vip: true } },
  { label: "4K Ultra HD exports", plans: { starter: false, pro: true, agency: true, vip: true } },
  { label: "Priority rendering queue", plans: { starter: false, pro: true, agency: true, vip: true } },
  { label: "Affiliate program", plans: { starter: false, pro: true, agency: true, vip: true } },
  { label: "API access", plans: { starter: false, pro: false, agency: true, vip: true } },
  { label: "White-label & custom branding", plans: { starter: false, pro: false, agency: true, vip: true } },
  { label: "Team seats", plans: { starter: false, pro: false, agency: true, vip: true } },
  { label: "Dedicated account manager", plans: { starter: false, pro: false, agency: true, vip: true } },
  { label: "Early access to new features", plans: { starter: false, pro: false, agency: false, vip: true } },
];

export const PRICING_GUARANTEE: Required<FunnelGuarantee> = {
  days: 30,
  title: "30-Day Money-Back Guarantee",
  description:
    "Try ReelForge risk-free. If it's not the right fit within 30 days, email us for a full refund — no questions asked.",
};

export const PRICING_TESTIMONIALS: FunnelTestimonial[] = [
  {
    quote:
      "Upgrading to Pro paid for itself in a week. The 4K exports and priority rendering are a game changer for client work.",
    author: "Sarah Johnson",
    role: "Fitness Creator",
    company: "420K followers",
    rating: 5,
  },
  {
    quote:
      "We run the Agency plan across our whole team. White-label exports and API access let us scale to 40+ clients.",
    author: "Marcus Chen",
    role: "Founder",
    company: "Chen Media",
    rating: 5,
  },
  {
    quote:
      "VIP is unreal value. 10,000 credits a month plus early access means we're always ahead of competitors.",
    author: "Priya Sharma",
    role: "Head of Content",
    company: "Sharma Studios",
    rating: 5,
  },
];

export const PRICING_FAQ: FAQAccordionItem[] = [
  {
    q: "What's the difference between one-time plans and VIP?",
    a: "Starter, Pro and Agency are one-time payments with lifetime access to that credit tier. VIP is a monthly subscription that refreshes 10,000 credits every month and includes early access to new features.",
  },
  {
    q: "What are AI credits?",
    a: "Credits are spent when you generate videos, scripts, voiceovers and images. Each plan includes a different monthly or lifetime allocation, and you can always top up later.",
  },
  {
    q: "Can I use ReelForge content commercially?",
    a: "Pro, Agency and VIP include a commercial license so you can use generated content for clients and paid work. Starter is intended for personal use.",
  },
  {
    q: "Can I upgrade my plan later?",
    a: "Yes. You can upgrade at any time and only pay the difference — your existing credits carry over.",
  },
  {
    q: "Is there a money-back guarantee?",
    a: "Absolutely. Every plan is backed by a 30-day money-back guarantee. If you're not satisfied, contact support for a full refund.",
  },
  {
    q: "What payment methods do you accept?",
    a: "International customers pay in USD via Stripe and Indian customers pay in INR via Razorpay. Checkout is secure and encrypted.",
  },
];

/** Build comparison-table columns from the plans + capability matrix. */
export function getComparisonPlans(): ComparisonPlan[] {
  return PRICING_PLANS.map((plan) => ({
    name: plan.name,
    price: plan.price,
    originalPrice: plan.originalPrice,
    description: plan.tagline,
    highlighted: plan.recommended,
    badge: plan.badge,
    ctaText: plan.ctaText ?? `Choose ${plan.name}`,
    ctaHref: plan.purchaseUrl,
    features: COMPARISON_FEATURES.map((row) => ({
      label: row.label,
      included: row.plans[plan.id],
    })),
  }));
}

/** Build the highlight bullet list shown on a plan's offer card. */
export function getPlanHighlights(plan: PricingPlan): string[] {
  return [
    plan.billingNote,
    plan.aiCredits,
    `${plan.exportQuality} exports`,
    plan.commercialUsage,
    `${plan.priority} priority`,
    plan.support,
    ...plan.features,
  ];
}

/** Lookup helper for future Order Bump / OTO pages. */
export function getPlan(id: PlanId): PricingPlan | undefined {
  return PRICING_PLANS.find((p) => p.id === id);
}

/** The plan promoted in upgrade CTAs. */
export const RECOMMENDED_PLAN: PricingPlan =
  PRICING_PLANS.find((p) => p.recommended) ?? PRICING_PLANS[0];
