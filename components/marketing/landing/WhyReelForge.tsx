import { Zap, Wallet, Infinity as InfinityIcon, Sparkles, LayoutGrid, HeartHandshake } from "lucide-react";
import { MarketingSection } from "@/components/shared";
import { SectionTitle, FeatureCard } from "@/components/ui";

const REASONS = [
  {
    icon: <Zap className="h-6 w-6" />,
    title: "Insanely fast",
    description: "Go from idea to finished video in under two minutes — not days.",
  },
  {
    icon: <Wallet className="h-6 w-6" />,
    title: "Fraction of the cost",
    description: "Replace editors, voice artists and stock subscriptions with one plan.",
  },
  {
    icon: <LayoutGrid className="h-6 w-6" />,
    title: "All-in-one studio",
    description: "Films, cartoons, reels, ads and avatars — every workflow in one place.",
  },
  {
    icon: <InfinityIcon className="h-6 w-6" />,
    title: "Endless consistency",
    description: "Reusable characters and brand styles keep every video on-message.",
  },
  {
    icon: <Sparkles className="h-6 w-6" />,
    title: "Always improving",
    description: "New models and features ship continuously — included in your plan.",
  },
  {
    icon: <HeartHandshake className="h-6 w-6" />,
    title: "Creator-first support",
    description: "Real humans, fast responses and resources to help you grow.",
  },
];

/** "Why ReelForge" value-proposition grid. */
export function WhyReelForge() {
  return (
    <MarketingSection id="why">
      <SectionTitle
        eyebrow="Why ReelForge"
        title="The unfair advantage for creators"
        subtitle="Everything a modern content team needs — minus the cost, complexity and wait."
      />
      <div className="mt-14 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {REASONS.map((r) => (
          <FeatureCard key={r.title} icon={r.icon} title={r.title} description={r.description} />
        ))}
      </div>
    </MarketingSection>
  );
}

export default WhyReelForge;
