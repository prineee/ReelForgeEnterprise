import { cn } from "@/lib/utils";
import { GlassCard } from "@/components/ui";
import { PriceTag } from "./PriceTag";
import { PurchaseCTA } from "./PurchaseCTA";
import { FeatureChecklist } from "./FeatureChecklist";
import { resolveAccents, type FunnelFeature, type FunnelThemeAccents } from "./types";

export interface ComparisonPlan {
  name: string;
  price: string;
  originalPrice?: string;
  description?: string;
  features: (string | FunnelFeature)[];
  ctaText?: string;
  ctaHref?: string;
  highlighted?: boolean;
  badge?: string;
}

export interface PricingComparisonTableProps {
  plans: ComparisonPlan[];
  accents?: FunnelThemeAccents;
  className?: string;
}

/** Side-by-side plan comparison — columns on desktop, stacked cards on mobile. */
export function PricingComparisonTable({ plans, accents, className }: PricingComparisonTableProps) {
  const a = resolveAccents(accents);

  return (
    <div
      className={cn(
        "grid grid-cols-1 gap-6",
        plans.length >= 3 ? "lg:grid-cols-3" : "sm:grid-cols-2",
        className,
      )}
    >
      {plans.map((plan, i) => (
        <GlassCard
          key={i}
          className={cn(
            "relative flex flex-col",
            plan.highlighted && cn("ring-1", a.ring, "border-orange-500/40"),
          )}
        >
          {plan.badge && (
            <span
              className={cn(
                "absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full px-3 py-1 text-xs font-bold text-white",
                a.gradient,
              )}
            >
              {plan.badge}
            </span>
          )}

          <h3 className="text-lg font-semibold text-white">{plan.name}</h3>
          {plan.description && <p className="mt-1 text-sm text-zinc-400">{plan.description}</p>}

          <div className="mt-4">
            <PriceTag price={plan.price} originalPrice={plan.originalPrice} align="left" />
          </div>

          <FeatureChecklist features={plan.features} className="mt-6 flex-1" />

          <div className="mt-8">
            <PurchaseCTA
              label={plan.ctaText ?? `Choose ${plan.name}`}
              href={plan.ctaHref}
              variant={plan.highlighted ? "gradient" : "solid"}
            />
          </div>
        </GlassCard>
      ))}
    </div>
  );
}

export default PricingComparisonTable;
