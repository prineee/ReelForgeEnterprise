import { CheckIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { GlassCard } from "@/components/ui/glass-card";
import { PRICING_PLANS, getPlanHighlights } from "@/config/pricing";
import Link from "next/link";

export function PricingCardGrid() {
  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-4">
      {PRICING_PLANS.map((plan) => (
        <GlassCard
          key={plan.id}
          className={cn(
            "flex flex-col",
            plan.recommended
              ? "border-orange-500/50 ring-2 ring-orange-500/80"
              : "border-slate-800"
          )}
          glow={plan.recommended}
        >
          <div className="flex-1 p-6">
            {plan.badge && (
              <p className="mb-4 text-sm font-semibold text-orange-400">
                {plan.badge}
              </p>
            )}
            <h3 className="text-2xl font-bold text-white">{plan.name}</h3>
            <p className="mt-2 text-slate-400">{plan.tagline}</p>
            <div className="mt-6 flex items-baseline gap-2">
              <span className="text-4xl font-bold tracking-tight text-white">
                {plan.price}
              </span>
              {plan.originalPrice && (
                <span className="text-xl text-slate-500 line-through">
                  {plan.originalPrice}
                </span>
              )}
            </div>
            <p className="mt-1 text-sm text-slate-500">{plan.billingNote}</p>

            <ul role="list" className="mt-8 space-y-3 text-sm text-slate-300">
              {getPlanHighlights(plan).map((feature) => (
                <li key={feature} className="flex items-start gap-3">
                  <CheckIcon
                    className="h-5 w-5 flex-shrink-0 text-blue-500"
                    aria-hidden="true"
                  />
                  <span>{feature}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="p-6 pt-0">
            <Button asChild className="w-full" size="lg">
              <Link href={plan.purchaseUrl}>{plan.ctaText ?? "Get Started"}</Link>
            </Button>
          </div>
        </GlassCard>
      ))}
    </div>
  );
}