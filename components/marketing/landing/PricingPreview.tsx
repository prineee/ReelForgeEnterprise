import { MarketingSection } from "@/components/shared";
import { SectionTitle, PricingCard } from "@/components/ui";

const PLANS = [
  {
    name: "Starter",
    price: "$6",
    period: "/mo",
    description: "For solo creators getting started.",
    features: ["100 credits / mo", "1080p exports", "All content tools", "Email support"],
    href: "/register?plan=starter",
  },
  {
    name: "Pro",
    price: "$18",
    period: "/mo",
    description: "For serious creators scaling output.",
    features: [
      "500 credits / mo",
      "4K exports",
      "All studios unlocked",
      "Priority support",
      "Affiliate program",
    ],
    href: "/register?plan=pro",
    highlighted: true,
    badge: "Most Popular",
  },
  {
    name: "Agency",
    price: "$60",
    period: "/mo",
    description: "For teams managing many clients.",
    features: [
      "2,000 credits / mo",
      "4K exports",
      "API access",
      "Dedicated manager",
      "Custom branding",
    ],
    href: "/register?plan=agency",
  },
  {
    name: "VIP",
    price: "$199",
    period: "/mo",
    description: "Maximum scale, white-glove service.",
    features: [
      "10,000 credits / mo",
      "Early access features",
      "White-label exports",
      "1:1 onboarding",
      "Priority rendering",
    ],
    href: "/register?plan=vip",
    badge: "Best Value",
  },
];

/** Pricing preview — links into the signup funnel (no purchase logic here). */
export function PricingPreview() {
  return (
    <MarketingSection id="pricing">
      <SectionTitle
        eyebrow="Pricing"
        title="Simple, transparent pricing"
        subtitle="Start free, then scale as you grow. Every plan includes all studios."
      />
      <div className="mt-14 grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-4">
        {PLANS.map((plan) => (
          <PricingCard
            key={plan.name}
            name={plan.name}
            price={plan.price}
            period={plan.period}
            description={plan.description}
            features={plan.features}
            ctaLabel={`Choose ${plan.name}`}
            ctaHref={plan.href}
            highlighted={plan.highlighted}
            badge={plan.badge}
          />
        ))}
      </div>
      <p className="mt-8 text-center text-sm text-zinc-500">
        Indian users pay in ₹ via Razorpay · International users pay in $ via Stripe
      </p>
    </MarketingSection>
  );
}

export default PricingPreview;
