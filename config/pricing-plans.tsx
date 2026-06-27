import Section from "@/components/ui/Section";
import { PricingCardGrid } from "./pricing-card-grid";

/**
 * The main pricing plans section, containing the grid of plans.
 */
export function PricingPlans() {
  return (
    <Section>
      <PricingCardGrid />
    </Section>
  );
}