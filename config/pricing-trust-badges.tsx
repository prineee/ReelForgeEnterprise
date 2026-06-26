import { FunnelTrustBadges } from "@/components/funnel";

/**
 * Renders the trust badges section for the main pricing page.
 * It's a server component that reuses the funnel component.
 */
export function PricingTrustBadges() {
  // The FunnelTrustBadges component is self-contained and does not
  // require external data, so we can just render it directly.
  return <FunnelTrustBadges />;
}