import { ArrowRight, Play, Sparkles, Star, Wand2, Mic, Clapperboard } from "lucide-react";
import { cn } from "@/lib/utils";
import { HeroContainer } from "@/components/shared";
import {
  Badge,
  GlassCard,
  GradientButton,
  SecondaryButton,
  gradients,
  typography,
} from "@/components/ui";

const HERO_STATS = [
  { value: "10,000+", label: "Creators" },
  { value: "500,000+", label: "Videos Created" },
  { value: "50+", label: "Languages" },
  { value: "99.9%", label: "Uptime" },
];

const TRUST_BADGES = ["No credit card required", "10 free credits", "Cancel anytime"];

/** Premium hero — animated gradient headline, dual CTA, floating UI cards, live stats. */
export function PremiumHero() {
  return (
    <HeroContainer>
      <div className="relative">
        {/* Floating UI cards (decorative, large screens only) */}
        <GlassCard
          hover={false}
          aria-hidden
          className="absolute -left-4 top-10 hidden w-56 -rotate-6 p-4 shadow-2xl xl:block"
        >
          <div className="flex items-center gap-2 text-sm font-semibold text-white">
            <Clapperboard className="h-4 w-4 text-orange-400" /> Rendering 4K
          </div>
          <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-white/10">
            <div className="h-full w-[92%] animate-pulse bg-gradient-to-r from-orange-500 to-purple-600" />
          </div>
          <p className="mt-2 text-xs text-zinc-400">Scene 3 of 4 · 92%</p>
        </GlassCard>

        <GlassCard
          hover={false}
          aria-hidden
          className="absolute -right-4 bottom-8 hidden w-56 rotate-6 p-4 shadow-2xl xl:block"
        >
          <div className="flex items-center gap-2 text-sm font-semibold text-white">
            <Mic className="h-4 w-4 text-purple-400" /> AI Voiceover
          </div>
          <div className="mt-3 flex items-end gap-1">
            {[6, 12, 8, 16, 10, 20, 9, 14, 7].map((h, i) => (
              <span
                key={i}
                className="w-1.5 animate-pulse rounded-full bg-gradient-to-t from-orange-500 to-purple-500"
                style={{ height: `${h * 1.5}px` }}
              />
            ))}
          </div>
          <p className="mt-2 text-xs text-zinc-400">Natural · 6 voices</p>
        </GlassCard>

        {/* Core hero content */}
        <div className="mx-auto flex max-w-4xl flex-col items-center">
          <Badge variant="default" className="mb-6 gap-2">
            <Sparkles className="h-3.5 w-3.5" />
            AI Movie Studio — Now Live
          </Badge>

          <h1 className={cn(typography.hero, "text-balance text-white")}>
            Create Viral AI Reels{" "}
            <span className={cn(gradients.text, "bg-[length:200%_auto]")}>
              in 60 Seconds
            </span>
          </h1>

          <p className="mt-6 max-w-2xl text-lg text-zinc-400 sm:text-xl">
            Turn any idea into a scroll-stopping Instagram Reel, TikTok, or YouTube Short
            with AI. Script → Voiceover → Video — no editing skills needed.
          </p>

          <div className="mt-9 flex w-full flex-col items-center justify-center gap-4 sm:w-auto sm:flex-row">
            <GradientButton href="/register" size="lg" full className="sm:w-auto">
              <span className="inline-flex items-center gap-2">
                Start Creating Free <ArrowRight className="h-5 w-5" />
              </span>
            </GradientButton>
            <SecondaryButton href="#how-it-works" size="lg" full className="sm:w-auto">
              <span className="inline-flex items-center gap-2">
                <Play className="h-5 w-5" /> Watch Demo
              </span>
            </SecondaryButton>
          </div>

          {/* Trust badges */}
          <div className="mt-6 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-sm text-zinc-500">
            <span className="inline-flex items-center gap-1.5 text-orange-300">
              <span className="flex">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} className="h-3.5 w-3.5 fill-orange-400 text-orange-400" />
                ))}
              </span>
              4.8/5
            </span>
            {TRUST_BADGES.map((t) => (
              <span key={t} className="inline-flex items-center gap-1.5">
                <Wand2 className="h-3.5 w-3.5 text-purple-400" />
                {t}
              </span>
            ))}
          </div>

          {/* Animated statistics */}
          <dl className="mt-14 grid w-full max-w-3xl grid-cols-2 gap-4 sm:grid-cols-4">
            {HERO_STATS.map((s) => (
              <div
                key={s.label}
                className="rounded-2xl border border-white/10 bg-white/5 px-4 py-5 text-center backdrop-blur-xl transition-all duration-300 hover:-translate-y-1 hover:border-purple-500/40"
              >
                <dt className="sr-only">{s.label}</dt>
                <dd>
                  <span className="block bg-gradient-to-r from-orange-300 to-purple-300 bg-clip-text text-2xl font-black tabular-nums text-transparent sm:text-3xl">
                    {s.value}
                  </span>
                  <span className="mt-1 block text-xs uppercase tracking-wide text-zinc-500">
                    {s.label}
                  </span>
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </HeroContainer>
  );
}

export default PremiumHero;
