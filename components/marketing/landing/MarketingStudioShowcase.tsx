import { Megaphone } from "lucide-react";
import { StudioShowcase } from "./StudioShowcase";

/** Marketing Studio showcase section. */
export function MarketingStudioShowcase() {
  return (
    <StudioShowcase
      id="marketing-studio"
      eyebrow="Marketing Studio"
      title="From product URL to scroll-stopping ad"
      description="Paste a product link and generate high-converting UGC, CGI and cinematic ad videos tailored to each platform — no agency, no shoot, no editing."
      icon={<Megaphone className="h-3.5 w-3.5" />}
      bullets={[
        "URL-to-video ad generation",
        "UGC, CGI & cinematic formats",
        "Platform-optimised aspect ratios",
        "Built for performance marketing",
      ]}
      ctaLabel="Open Marketing Studio"
      ctaHref="/register?plan=agency"
      mediaSide="right"
      accent="bg-gradient-to-br from-orange-500 via-amber-500 to-pink-600"
    />
  );
}

export default MarketingStudioShowcase;
