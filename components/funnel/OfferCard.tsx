import { cn } from "@/lib/utils";
import { GlassCard } from "@/components/ui";
import { PriceTag } from "./PriceTag";
import { PurchaseCTA } from "./PurchaseCTA";
import { FeatureChecklist } from "./FeatureChecklist";
import { resolveAccents, type FunnelFeature, type FunnelThemeAccents } from "./types";

export interface OfferCardProps {
  title: string;
  description?: string;
  price: string;
  originalPrice?: string;
  savings?: string;
  features?: (string | FunnelFeature)[];
  ctaText?: string;
  ctaHref?: string;
  badge?: string;
  highlighted?: boolean;
  accents?: FunnelThemeAccents;
  className?: string;
}

/** Self-contained offer card: price, included features and a purchase CTA. */
export function OfferCard({
  title,
  description,
  price,
  originalPrice,
  savings,
  features,
  ctaText = "Get Instant Access",
  ctaHref,
  badge,
  highlighted = false,
  accents,
  className,
}: OfferCardProps) {
  const a = resolveAccents(accents);

  return (
    <GlassCard
      className={cn(
        "relative flex h-full flex-col",
        highlighted && cn("ring-1", a.ring, "border-orange-500/40"),
        className,
      )}
    >
      {badge && (
        <span
          className={cn(
            "absolute -top-3 right-6 rounded-full px-3 py-1 text-xs font-bold text-white",
            a.gradient,
          )}
        >
          {badge}
        </span>
      )}

      <h3 className="text-xl font-bold text-white">{title}</h3>
      {description && <p className="mt-1.5 text-sm text-zinc-400">{description}</p>}

      <div className="mt-5">
        <PriceTag price={price} originalPrice={originalPrice} savings={savings} align="left" />
      </div>

      {features && features.length > 0 && (
        <FeatureChecklist features={features} className="mt-6 flex-1" />
      )}

      <div className="mt-8 pt-2">
        <PurchaseCTA label={ctaText} href={ctaHref} />
      </div>
    </GlassCard>
  );
}

export default OfferCard;
