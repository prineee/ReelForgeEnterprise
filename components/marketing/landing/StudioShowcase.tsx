import type { ReactNode } from "react";
import { ArrowRight, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { MarketingSection } from "@/components/shared";
import { Badge, PrimaryButton, GlassCard, gradients } from "@/components/ui";

export interface StudioShowcaseProps {
  id?: string;
  eyebrow: string;
  title: string;
  description: string;
  bullets: string[];
  icon: ReactNode;
  ctaLabel: string;
  ctaHref: string;
  /** Side the visual sits on (lg+). Alternate between sections. */
  mediaSide?: "left" | "right";
  /** Gradient used for the visual panel. Defaults to the brand gradient. */
  accent?: string;
}

/**
 * Reusable alternating media/copy showcase block.
 * Powers Movie / Cartoon / Marketing studio sections without duplicated markup.
 */
export function StudioShowcase({
  id,
  eyebrow,
  title,
  description,
  bullets,
  icon,
  ctaLabel,
  ctaHref,
  mediaSide = "right",
  accent,
}: StudioShowcaseProps) {
  return (
    <MarketingSection id={id}>
      <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-2 lg:gap-16">
        {/* Copy */}
        <div className={cn(mediaSide === "left" && "lg:order-2")}>
          <Badge variant="default" className="gap-2">
            <span className="text-orange-400">{icon}</span>
            {eyebrow}
          </Badge>
          <h2 className="mt-5 text-3xl font-black tracking-tight text-white sm:text-4xl">
            {title}
          </h2>
          <p className="mt-4 max-w-xl text-lg leading-relaxed text-zinc-400">{description}</p>
          <ul className="mt-7 space-y-3">
            {bullets.map((b) => (
              <li key={b} className="flex items-start gap-3 text-zinc-300">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-orange-500/20 text-orange-400">
                  <Check className="h-3.5 w-3.5" />
                </span>
                {b}
              </li>
            ))}
          </ul>
          <div className="mt-9">
            <PrimaryButton href={ctaHref} size="lg">
              <span className="inline-flex items-center gap-2">
                {ctaLabel} <ArrowRight className="h-5 w-5" />
              </span>
            </PrimaryButton>
          </div>
        </div>

        {/* Visual */}
        <div className={cn(mediaSide === "left" && "lg:order-1")}>
          <GlassCard hover={false} className="relative overflow-hidden p-0">
            <div
              className={cn(
                "relative flex aspect-video items-center justify-center",
                accent ?? gradients.primaryDiagonal,
              )}
            >
              <div className="absolute inset-0 bg-black/30" />
              <div className="relative flex h-20 w-20 items-center justify-center rounded-3xl border border-white/20 bg-black/40 text-white backdrop-blur-md">
                <span className="[&>svg]:h-9 [&>svg]:w-9">{icon}</span>
              </div>
              {/* faux UI chrome */}
              <div className="absolute left-4 top-4 flex gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-white/40" />
                <span className="h-2.5 w-2.5 rounded-full bg-white/30" />
                <span className="h-2.5 w-2.5 rounded-full bg-white/20" />
              </div>
            </div>
          </GlassCard>
        </div>
      </div>
    </MarketingSection>
  );
}

export default StudioShowcase;
