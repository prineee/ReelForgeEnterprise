import InternationalPricing from "@/components/pricing/InternationalPricing";
import type { Metadata } from "next";
import { CTASection } from "@/components/ui";
import {
  OfferCard,
  OfferSection,
  PricingComparisonTable,
  TestimonialWall,
  FAQAccordion,
  MoneyBackGuarantee,
  TrustBadges,
} from "@/components/funnel";
import {
  PRICING_PLANS,
  PRICING_FAQ,
  PRICING_GUARANTEE,
  PRICING_TESTIMONIALS,
  RECOMMENDED_PLAN,
  getComparisonPlans,
  getPlanHighlights,
} from "@/config/pricing";

export const metadata: Metadata = {
  title: "Pricing",
  description:
    "ReelForge pricing — Starter, Pro, Agency and VIP plans. Create AI videos, films and reels with one-time or monthly options, backed by a 30-day money-back guarantee.",
  alternates: { canonical: "/pricing" },
  openGraph: {
    title: "ReelForge Pricing",
    description:
      "Simple, transparent pricing for the all-in-one AI video studio. Starter, Pro, Agency and VIP.",
    url: "https://reelforge.fabricaipro.com/pricing",
    type: "website",
  },
};

const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: PRICING_FAQ.map((f) => ({
    "@type": "Question",
    name: f.q,
    acceptedAnswer: { "@type": "Answer", text: f.a },
  })),
};

export default function PricingPage() {
  return (
    <main className="min-h-screen text-white">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />

      {/* Plans */}
      <OfferSection
        id="pricing"
        eyebrow="Pricing"
        title="Simple pricing that scales with you"
        subtitle="Choose a one-time plan or go monthly with VIP. Every plan unlocks all AI studios and is backed by a 30-day money-back guarantee."
      >
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-4">
          {PRICING_PLANS.map((plan) => (
            <OfferCard
              key={plan.id}
              title={plan.name}
              description={plan.tagline}
              price={plan.price}
              originalPrice={plan.originalPrice}
              savings={plan.savings}
              features={getPlanHighlights(plan)}
              ctaText={plan.ctaText ?? `Choose ${plan.name}`}
              ctaHref={plan.purchaseUrl}
              highlighted={plan.recommended}
              badge={plan.badge}
            />
          ))}
        </div>

        <TrustBadges className="mt-12" />
      </OfferSection>

      {/* Feature comparison */}
      <OfferSection
        eyebrow="Compare plans"
        title="Every feature, side by side"
        subtitle="See exactly what's included in each plan."
        width="wide"
        tight
      >
        <PricingComparisonTable plans={getComparisonPlans()} />
      </OfferSection>

      {/* Guarantee */}
      <OfferSection width="narrow" tight>
        <div className="rounded-3xl border border-white/10 bg-white/5 p-8 backdrop-blur-xl">
          <MoneyBackGuarantee
            days={PRICING_GUARANTEE.days}
            title={PRICING_GUARANTEE.title}
            description={PRICING_GUARANTEE.description}
          />
        </div>
      </OfferSection>

      {/* Testimonials */}
      <OfferSection
        eyebrow="Loved by creators"
        title="Trusted by 10,000+ creators & agencies"
      >
        <TestimonialWall testimonials={PRICING_TESTIMONIALS} />
      </OfferSection>

      {/* FAQ */}
      <OfferSection eyebrow="FAQ" title="Pricing questions, answered" width="narrow" tight>
        <FAQAccordion items={PRICING_FAQ} />
      </OfferSection>

      {/* Upgrade CTA */}
      <CTASection
        title="Ready to upgrade your content?"
        subtitle="Join thousands of creators producing cinematic AI videos at scale. Start today, risk-free."
        primaryLabel={`Get ${RECOMMENDED_PLAN.name} — ${RECOMMENDED_PLAN.price}`}
        primaryHref={RECOMMENDED_PLAN.purchaseUrl}
        secondaryLabel="Compare plans"
        secondaryHref="#pricing"
      /><InternationalPricing />
    </main>
  );
}
