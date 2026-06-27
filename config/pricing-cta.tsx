import { CTASection } from "@/components/ui";
import { RECOMMENDED_PLAN } from "@/config/pricing";

export function PricingCTA() {
  return (
    <CTASection
      title="Ready to Create at the Speed of Thought?"
      subtitle={`Join thousands of creators and businesses scaling their video output with ReelForge. Get lifetime access to the ${RECOMMENDED_PLAN.name} plan today.`}
      primaryLabel={`Upgrade to ${RECOMMENDED_PLAN.name}`}
      primaryHref={RECOMMENDED_PLAN.purchaseUrl}
    />
  );
}