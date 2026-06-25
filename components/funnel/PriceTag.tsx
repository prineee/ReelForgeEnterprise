import { cn } from "@/lib/utils";

export interface PriceTagProps {
  price: string;
  originalPrice?: string;
  savings?: string;
  size?: "sm" | "md" | "lg";
  align?: "center" | "left";
  className?: string;
}

const PRICE_SIZE = {
  sm: "text-2xl",
  md: "text-4xl",
  lg: "text-5xl sm:text-6xl",
} as const;

/** Shared price display: optional struck-through original + price + savings. */
export function PriceTag({
  price,
  originalPrice,
  savings,
  size = "md",
  align = "center",
  className,
}: PriceTagProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-2",
        align === "center" ? "items-center" : "items-start",
        className,
      )}
    >
      <div className="flex items-end gap-2">
        {originalPrice && (
          <span className="text-lg font-medium text-zinc-500 line-through">{originalPrice}</span>
        )}
        <span className={cn("font-black tracking-tight text-white", PRICE_SIZE[size])}>
          {price}
        </span>
      </div>
      {savings && (
        <span className="inline-flex items-center rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-semibold text-emerald-300">
          {savings}
        </span>
      )}
    </div>
  );
}

export default PriceTag;
