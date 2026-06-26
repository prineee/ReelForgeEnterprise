import { FunnelFAQ } from "@/components/funnel";
import { PRICING_FAQ } from "@/config/pricing";

/**
 * Renders the FAQ section for the main pricing page.
 * It's a server component that fetches its data directly from the
 * centralized pricing configuration.
 */
export function PricingFAQ() {
  return <FunnelFAQ items={PRICING_FAQ} />;
}