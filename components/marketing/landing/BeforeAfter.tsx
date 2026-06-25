import { Check, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { MarketingSection } from "@/components/shared";
import { SectionTitle, GlassCard } from "@/components/ui";

const WITHOUT = [
  "3–4 hours per video",
  "Need pro editing skills",
  "Expensive gear & software",
  "Writer's block on scripts",
  "Inconsistent posting",
  "Pay voiceover artists",
];

const WITH = [
  "Ready in under 2 minutes",
  "Zero editing skills needed",
  "Just a phone or laptop",
  "AI writes viral scripts",
  "Publish consistently, daily",
  "AI voiceover included free",
];

/** Before vs After comparison. */
export function BeforeAfter() {
  return (
    <MarketingSection width="narrow">
      <SectionTitle
        eyebrow="The difference"
        title="Stop spending hours on content"
        subtitle="See what changes the moment ReelForge joins your workflow."
      />
      <div className="mt-14 grid grid-cols-1 gap-6 md:grid-cols-2">
        <GlassCard hover={false} className="border-red-500/20">
          <h3 className="flex items-center gap-2 text-lg font-bold text-red-300">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-red-500/15 ring-1 ring-red-500/40">
              <X className="h-4 w-4" />
            </span>
            Without ReelForge
          </h3>
          <ul className="mt-6 space-y-3">
            {WITHOUT.map((item) => (
              <li key={item} className="flex items-center gap-3 text-sm text-zinc-400">
                <X className="h-4 w-4 shrink-0 text-red-500/80" />
                {item}
              </li>
            ))}
          </ul>
        </GlassCard>

        <GlassCard
          className={cn("border-orange-500/30 ring-1 ring-orange-500/20")}
        >
          <h3 className="flex items-center gap-2 text-lg font-bold text-orange-300">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-orange-500/15 ring-1 ring-orange-500/40">
              <Check className="h-4 w-4" />
            </span>
            With ReelForge
          </h3>
          <ul className="mt-6 space-y-3">
            {WITH.map((item) => (
              <li key={item} className="flex items-center gap-3 text-sm text-zinc-200">
                <Check className="h-4 w-4 shrink-0 text-orange-400" />
                {item}
              </li>
            ))}
          </ul>
        </GlassCard>
      </div>
    </MarketingSection>
  );
}

export default BeforeAfter;
