import { PenLine, Sparkles, SlidersHorizontal, Download } from "lucide-react";
import { MarketingSection } from "@/components/shared";
import { SectionTitle, GlassCard, AnimatedDivider } from "@/components/ui";

const STEPS = [
  {
    icon: <PenLine className="h-6 w-6" />,
    title: "Describe your idea",
    description: "Type a topic, plot or product. The AI understands context, tone and intent.",
  },
  {
    icon: <Sparkles className="h-6 w-6" />,
    title: "AI generates everything",
    description: "Script, voiceover and visuals are produced automatically in seconds.",
  },
  {
    icon: <SlidersHorizontal className="h-6 w-6" />,
    title: "Refine & customise",
    description: "Tweak scenes, captions, voices and pacing until it's exactly right.",
  },
  {
    icon: <Download className="h-6 w-6" />,
    title: "Export & publish",
    description: "Download in 1080p or 4K, or publish straight to your channels.",
  },
];

/** Four-step "How ReelForge Works" walkthrough. */
export function HowItWorks() {
  return (
    <MarketingSection id="how-it-works">
      <SectionTitle
        eyebrow="How it works"
        title="From idea to published in 4 steps"
        subtitle="No timelines, no plugins, no learning curve — just describe what you want and let the AI build it."
      />
      <div className="mt-8">
        <AnimatedDivider />
      </div>
      <ol className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {STEPS.map((step, i) => (
          <li key={step.title}>
            <GlassCard className="h-full">
              <div className="flex items-center justify-between">
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-500/20 to-purple-600/20 text-orange-400 ring-1 ring-white/10">
                  {step.icon}
                </span>
                <span className="text-4xl font-black text-white/10">
                  {String(i + 1).padStart(2, "0")}
                </span>
              </div>
              <h3 className="mt-5 text-lg font-bold text-white">{step.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-zinc-400">{step.description}</p>
            </GlassCard>
          </li>
        ))}
      </ol>
    </MarketingSection>
  );
}

export default HowItWorks;
