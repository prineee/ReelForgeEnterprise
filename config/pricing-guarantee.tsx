import { MoneyBackGuarantee } from "@/components/funnel";
import { PRICING_GUARANTEE } from "@/config/pricing";

export function PricingGuarantee() {
  return (
    <MoneyBackGuarantee
      days={PRICING_GUARANTEE.days}
      title={PRICING_GUARANTEE.title}
      description={PRICING_GUARANTEE.description}
    />
  );
}