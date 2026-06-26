import { FunnelGuarantee } from "@/components/funnel";
import { PRICING_GUARANTEE } from "@/config/pricing";

/**
 * Renders the guarantee section for the main pricing page.
 * It's a server component that fetches its data directly from the
 * centralized pricing configuration.
 */
export function PricingGuarantee() {
  return <FunnelGuarantee {...PRICING_GUARANTEE} />;
}