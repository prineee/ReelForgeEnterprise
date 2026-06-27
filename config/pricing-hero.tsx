import { OfferHero } from "@/components/funnel";
import { RECOMMENDED_PLAN } from "@/config/pricing";

export function PricingHero() {
  return (
    <OfferHero
      eyebrow="No subscription needed"
      title="Choose Your Plan"
      subtitle="Join thousands of creators who trust ReelForge to automate their video production. All plans include lifetime access and a 30-day money-back guarantee."
      price={RECOMMENDED_PLAN.price}
      originalPrice={RECOMMENDED_PLAN.originalPrice}
      savings={RECOMMENDED_PLAN.savings}
      ctaText={RECOMMENDED_PLAN.ctaText ?? "Get Instant Access"}
      ctaHref={RECOMMENDED_PLAN.purchaseUrl}
      guaranteeNote="30-Day Money-Back Guarantee"
    />
  );
}