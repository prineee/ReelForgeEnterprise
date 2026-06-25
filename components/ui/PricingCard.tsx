import { cn } from "@/lib/utils";
import { GlassCard } from "./GlassCard";
import { PrimaryButton } from "./PrimaryButton";
import { GradientButton } from "./GradientButton";

export interface PricingCardProps {
  name: string;
  price: string;
  period?: string;
  description?: string;
  features: string[];
  ctaLabel?: string;
  ctaHref?: string;
  onSelect?: () => void;
  /** Emphasise this plan (gradient CTA + ring). */
  highlighted?: boolean;
  /** Small ribbon label, e.g. "Most popular". */
  badge?: string;
  className?: string;
}

/** Pricing plan card used on marketing + billing surfaces. */
export function PricingCard({
  name,
  price,
  period = "/mo",
  description,
  features,
  ctaLabel = "Get Started",
  ctaHref,
  onSelect,
  highlighted = false,
  badge,
  className,
}: PricingCardProps) {
  const Cta = highlighted ? GradientButton : PrimaryButton;

  return (
    <GlassCard
      className={cn(
        "relative flex h-full flex-col",
        highlighted && "border-orange-500/40 ring-1 ring-orange-500/30",
        className,
      )}
    >
      {badge && (
        <span className="absolute -top-3 right-6 rounded-full bg-gradient-to-r from-orange-500 to-purple-600 px-3 py-1 text-xs font-bold text-white">
          {badge}
        </span>
      )}

      <h3 className="text-lg font-semibold text-white">{name}</h3>
      {description && <p className="mt-1 text-sm text-zinc-400">{description}</p>}

      <div className="mt-4 flex items-end gap-1">
        <span className="text-4xl font-black tracking-tight text-white">{price}</span>
        <span className="mb-1 text-sm text-zinc-400">{period}</span>
      </div>

      <ul className="mt-6 space-y-3 text-sm text-zinc-300">
        {features.map((feature, i) => (
          <li key={i} className="flex items-start gap-2">
            <span className="mt-0.5 text-orange-400" aria-hidden>
              ✓
            </span>
            <span>{feature}</span>
          </li>
        ))}
      </ul>

      <div className="mt-8 pt-2">
        <Cta full href={ctaHref} onClick={onSelect} size="lg">
          {ctaLabel}
        </Cta>
      </div>
    </GlassCard>
  );
}

export default PricingCard;
