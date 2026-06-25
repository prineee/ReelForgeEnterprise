import { cn } from "@/lib/utils";
import { GlassCard } from "@/components/ui";
import { PurchaseCTA } from "./PurchaseCTA";
import { TrustBadges } from "./TrustBadges";

export interface CheckoutSummaryLine {
  label: string;
  value?: string;
}

export interface CheckoutSummaryProps {
  heading?: string;
  items: CheckoutSummaryLine[];
  originalPrice?: string;
  savings?: string;
  total: string;
  ctaText?: string;
  ctaHref?: string;
  note?: string;
  className?: string;
}

/** Order summary panel (display only — no payment processing). */
export function CheckoutSummary({
  heading = "Order summary",
  items,
  originalPrice,
  savings,
  total,
  ctaText = "Complete Order",
  ctaHref,
  note = "You will be redirected to a secure checkout.",
  className,
}: CheckoutSummaryProps) {
  return (
    <GlassCard hover={false} className={cn("mx-auto max-w-md", className)}>
      <h3 className="text-lg font-bold text-white">{heading}</h3>

      <ul className="mt-5 space-y-3">
        {items.map((item, i) => (
          <li key={i} className="flex items-center justify-between gap-4 text-sm">
            <span className="text-zinc-300">{item.label}</span>
            {item.value && <span className="font-medium text-zinc-200">{item.value}</span>}
          </li>
        ))}
      </ul>

      <div className="mt-5 space-y-2 border-t border-white/10 pt-4 text-sm">
        {originalPrice && (
          <div className="flex items-center justify-between text-zinc-400">
            <span>Original price</span>
            <span className="line-through">{originalPrice}</span>
          </div>
        )}
        {savings && (
          <div className="flex items-center justify-between text-emerald-300">
            <span>You save</span>
            <span className="font-semibold">{savings}</span>
          </div>
        )}
        <div className="flex items-center justify-between pt-1">
          <span className="text-base font-bold text-white">Total</span>
          <span className="text-2xl font-black text-white">{total}</span>
        </div>
      </div>

      <div className="mt-6">
        <PurchaseCTA label={ctaText} href={ctaHref} subText={note} />
      </div>

      <TrustBadges className="mt-6 gap-x-4 text-xs" />
    </GlassCard>
  );
}

export default CheckoutSummary;
