import { FunnelComparisonTable } from "@/components/funnel";
import { getComparisonPlans } from "@/config/pricing";

/**
 * Renders the feature comparison table for the main pricing page.
 * It's a server component that fetches its data directly from the
 * centralized pricing configuration.
 */
export function PricingComparison() {
  return <FunnelComparisonTable plans={getComparisonPlans()} />;
}