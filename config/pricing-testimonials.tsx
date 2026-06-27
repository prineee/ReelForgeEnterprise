import { TestimonialWall } from "@/components/funnel";
import { PRICING_TESTIMONIALS } from "@/config/pricing";

/**
 * Renders customer testimonials for the pricing page.
 */
export function PricingTestimonials() {
  return (
    <TestimonialWall
      testimonials={PRICING_TESTIMONIALS}
      columns={3}
    />
  );
}