import { Section } from "@/components/ui/section";
import { PricingCardGrid } from "./pricing-card-grid";

/**
 * The main pricing plans section, containing the grid of plan cards.
 */
export function PricingPlans() {
  return (
    <Section id="pricing-plans">
      <PricingCardGrid />
    </Section>
  );
}