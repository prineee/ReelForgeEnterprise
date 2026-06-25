import { Gift } from "lucide-react";
import { cn } from "@/lib/utils";
import { GlassCard } from "@/components/ui";
import { resolveAccents, type FunnelBonus, type FunnelThemeAccents } from "./types";

export interface BonusStackProps {
  bonuses: FunnelBonus[];
  heading?: string;
  totalValue?: string;
  accents?: FunnelThemeAccents;
  className?: string;
}

/** Stacked list of bonuses with individual values and an optional total. */
export function BonusStack({
  bonuses,
  heading = "Included free bonuses",
  totalValue,
  accents,
  className,
}: BonusStackProps) {
  const a = resolveAccents(accents);

  return (
    <GlassCard hover={false} className={cn("p-0", className)}>
      <div className="border-b border-white/10 px-6 py-4">
        <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-zinc-400">
          {heading}
        </h3>
      </div>

      <ul className="divide-y divide-white/5">
        {bonuses.map((bonus, i) => (
          <li key={i} className="flex items-start gap-4 px-6 py-4">
            <span
              className={cn(
                "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white",
                a.gradient,
              )}
              aria-hidden
            >
              {bonus.icon ?? <Gift className="h-5 w-5" />}
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-white">{bonus.title}</p>
              {bonus.description && (
                <p className="mt-0.5 text-sm text-zinc-400">{bonus.description}</p>
              )}
            </div>
            {bonus.value && (
              <span className="shrink-0 text-sm font-bold text-emerald-300">
                {bonus.value}
              </span>
            )}
          </li>
        ))}
      </ul>

      {totalValue && (
        <div className="flex items-center justify-between border-t border-white/10 px-6 py-4">
          <span className="text-sm font-semibold text-zinc-300">Total bonus value</span>
          <span className="text-lg font-black text-white">{totalValue}</span>
        </div>
      )}
    </GlassCard>
  );
}

export default BonusStack;
