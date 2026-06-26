import { Metadata } from "next";
import { PricingComparison } from "@/components/marketing/pricing/pricing-comparison";
import { PricingCTA } from "@/components/marketing/pricing/pricing-cta";
import { PricingFAQ } from "@/components/marketing/pricing/pricing-faq";
import { PricingGuarantee } from "@/components/marketing/pricing/pricing-guarantee";
import { PricingHero } from "@/components/marketing/pricing/pricing-hero";
import { PricingPlans } from "@/components/marketing/pricing/pricing-plans";
import { PricingTestimonials } from "@/components/marketing/pricing/pricing-testimonials";
import { PricingTrustBadges } from "@/components/marketing/pricing/pricing-trust-badges";
import { StickyUpgradeBar } from "@/components/marketing/pricing/sticky-upgrade-bar";
import { Section } from "@/components/ui/section";

export const metadata: Metadata = {
  title: "Pricing - ReelForge",
  description:
    "Choose the perfect plan for your video creation needs. Lifetime access, no subscriptions. 30-day money-back guarantee.",
};

/**
 * The main pricing page, assembled from reusable server components.
 * All data is sourced from the centralized pricing configuration.
 */
export default function PricingPage() {
  return (
    <>
      <PricingHero />
      <PricingPlans />
      <Section>
        <PricingComparison />
      </Section>
      <Section>
        <PricingTestimonials />
      </Section>
      <Section>
        <PricingFAQ />
      </Section>
      <Section>
        <PricingGuarantee />
      </Section>
      <Section>
        <PricingTrustBadges />
      </Section>
      <PricingCTA />
      <StickyUpgradeBar />
    </>
  );
}