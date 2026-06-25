import { cn } from "@/lib/utils";
import { PriceTag } from "./PriceTag";
import { PurchaseCTA } from "./PurchaseCTA";

export interface StickyPurchaseBarProps {
  title?: string;
  price: string;
  originalPrice?: string;
  ctaText?: string;
  ctaHref?: string;
  className?: string;
}

/** Fixed bottom purchase bar that stays in view on long sales pages. */
export function StickyPurchaseBar({
  title,
  price,
  originalPrice,
  ctaText = "Get Instant Access",
  ctaHref,
  className,
}: StickyPurchaseBarProps) {
  return (
    <div
      className={cn(
        "fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-black/80 backdrop-blur-xl",
        className,
      )}
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <div className="flex items-center gap-3">
          {title && (
            <span className="hidden text-sm font-semibold text-white sm:block">{title}</span>
          )}
          <PriceTag price={price} originalPrice={originalPrice} size="sm" align="left" />
        </div>
        <PurchaseCTA label={ctaText} href={ctaHref} full={false} size="md" className="shrink-0" />
      </div>
    </div>
  );
}

export default StickyPurchaseBar;
