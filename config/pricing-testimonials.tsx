import { FunnelTestimonials } from "@/components/funnel";
import { PRICING_TESTIMONIALS } from "@/config/pricing";

/**
 * Renders the testimonials section for the main pricing page.
 * It's a server component that fetches its data directly from the
 * centralized pricing configuration.
 */
export function PricingTestimonials() {
  return <FunnelTestimonials testimonials={PRICING_TESTIMONIALS} />;
}