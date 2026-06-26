import { FunnelCta } from "@/components/funnel";
import { RECOMMENDED_PLAN } from "@/config/pricing";

/**
 * Renders the final call-to-action section for the pricing page.
 * It's a server component that fetches its data directly from the
 * centralized pricing configuration.
 */
export function PricingCTA() {
  return (
    <FunnelCta
      title="Ready to Create at the Speed of Thought?"
      description={`Join thousands of creators and businesses scaling their video output with ReelForge. Get lifetime access to the ${RECOMMENDED_PLAN.name} plan today.`}
      ctaText={`Upgrade to ${RECOMMENDED_PLAN.name}`}
      ctaHref={RECOMMENDED_PLAN.purchaseUrl}
      variant="final"
    />
  );
}