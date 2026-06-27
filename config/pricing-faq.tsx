import { FAQAccordion } from "@/components/funnel";
import { PRICING_FAQ } from "@/config/pricing";

export function PricingFAQ() {
  return (
    <FAQAccordion
      items={PRICING_FAQ}
    />
  );
}