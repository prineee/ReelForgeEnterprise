import { cn } from "@/lib/utils";
import { GlassCard } from "@/components/ui";
import { PurchaseCTA } from "./PurchaseCTA";

export interface ValueStackItem {
  label: string;
  value: string;
}

export interface ValueStackProps {
  items: ValueStackItem[];
  totalValue?: string;
  price?: string;
  ctaText?: string;
  ctaHref?: string;
  className?: string;
}

/** Itemised value tally contrasting total value against today's price. */
export function ValueStack({
  items,
  totalValue,
  price,
  ctaText,
  ctaHref,
  className,
}: ValueStackProps) {
  return (
    <GlassCard hover={false} className={cn("mx-auto max-w-xl", className)}>
      <ul className="space-y-3">
        {items.map((item, i) => (
          <li
            key={i}
            className="flex items-center justify-between gap-4 border-b border-white/5 pb-3 text-sm last:border-0 last:pb-0"
          >
            <span className="text-zinc-300">{item.label}</span>
            <span className="font-semibold text-zinc-200">{item.value}</span>
          </li>
        ))}
      </ul>

      {(totalValue || price) && (
        <div className="mt-6 space-y-2 rounded-2xl border border-white/10 bg-white/5 p-5">
          {totalValue && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-zinc-400">Total value</span>
              <span className="font-semibold text-zinc-300 line-through">{totalValue}</span>
            </div>
          )}
          {price && (
            <div className="flex items-center justify-between">
              <span className="font-semibold text-white">Today only</span>
              <span className="text-2xl font-black text-white">{price}</span>
            </div>
          )}
        </div>
      )}

      {ctaText && (
        <div className="mt-6">
          <PurchaseCTA label={ctaText} href={ctaHref} />
        </div>
      )}
    </GlassCard>
  );
}

export default ValueStack;
