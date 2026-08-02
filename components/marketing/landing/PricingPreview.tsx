import { MarketingSection } from "@/components/shared";
import { SectionTitle, PricingCard } from "@/components/ui";
import { PLANS as CANONICAL_PLANS } from "@/lib/plans";

const PLANS = CANONICAL_PLANS.map((plan) => ({
  name: plan.name,
  price: `$${plan.priceUSD}`,
  period: plan.billing === "monthly" ? "/mo" : " one-time",
  description: plan.tagline,
  features: plan.features,
  href: `/register?plan=${plan.key}`,
  highlighted: plan.highlight,
  badge: plan.badge,
}));

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
