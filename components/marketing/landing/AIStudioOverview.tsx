import { Clapperboard, Tv, Megaphone, Smartphone } from "lucide-react";
import { MarketingSection } from "@/components/shared";
import { SectionTitle, FeatureCard } from "@/components/ui";

const STUDIOS = [
  {
    icon: <Clapperboard className="h-6 w-6" />,
    title: "Movie Studio",
    description:
      "Shot-by-shot AI filmmaking with camera, lighting and genre direction — full cinematic control.",
  },
  {
    icon: <Tv className="h-6 w-6" />,
    title: "Cartoon Studio",
    description:
      "Generate animated stories with consistent characters, dialogue and scene continuity.",
  },
  {
    icon: <Megaphone className="h-6 w-6" />,
    title: "Marketing Studio",
    description:
      "Turn any product URL into UGC, CGI or cinematic ad videos for any platform.",
  },
  {
    icon: <Smartphone className="h-6 w-6" />,
    title: "Reel Studio",
    description:
      "Topic to viral reel in 60 seconds — AI script, voiceover and matched stock footage.",
  },
];

/** High-level overview of the ReelForge AI studios. */
export function AIStudioOverview() {
  return (
    <MarketingSection id="studios">
      <SectionTitle
        eyebrow="One platform, every format"
        title="The complete AI video studio"
        subtitle="ReelForge unifies every creative workflow — from cinematic films to viral shorts — in a single, credit-based platform."
      />
      <div className="mt-14 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {STUDIOS.map((s) => (
          <FeatureCard
            key={s.title}
            icon={s.icon}
            title={s.title}
            description={s.description}
          />
        ))}
      </div>
    </MarketingSection>
  );
}

export default AIStudioOverview;
