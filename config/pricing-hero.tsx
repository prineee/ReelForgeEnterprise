import { FunnelHero } from "@/components/funnel";

/**
 * Renders the hero section for the main pricing page.
 */
export function PricingHero() {
  return (
    <FunnelHero
      title="Choose Your Plan"
      description="Join thousands of creators who trust ReelForge to automate their video production. All plans include lifetime access and a 30-day money-back guarantee."
      pillText="No subscription needed"
      className="max-w-3xl"
      titleClassName="text-5xl"
    />
  );
}