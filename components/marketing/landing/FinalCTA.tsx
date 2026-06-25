import { CTASection } from "@/components/ui";

/** Final call-to-action — reuses the design-system CTASection. */
export function FinalCTA() {
  return (
    <CTASection
      title="Ready to create your first AI film?"
      subtitle="Join 10,000+ creators turning ideas into scroll-stopping videos. Start free — no credit card required."
      primaryLabel="Start for Free"
      primaryHref="/register"
      secondaryLabel="View Pricing"
      secondaryHref="#pricing"
    />
  );
}

export default FinalCTA;
