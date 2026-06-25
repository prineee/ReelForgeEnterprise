import { BadgeCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { resolveAccents, type FunnelThemeAccents } from "./types";

export interface MoneyBackGuaranteeProps {
  days?: number;
  title?: string;
  description?: string;
  accents?: FunnelThemeAccents;
  className?: string;
}

/** Compact money-back "seal" — a focused complement to the full GuaranteeBox. */
export function MoneyBackGuarantee({
  days = 30,
  title,
  description = "If you're not thrilled, email us for a full refund — no questions asked.",
  accents,
  className,
}: MoneyBackGuaranteeProps) {
  const a = resolveAccents(accents);
  const heading = title ?? `${days}-Day Money-Back Guarantee`;

  return (
    <div className={cn("flex flex-col items-center gap-4 text-center sm:flex-row sm:text-left", className)}>
      <span
        className={cn(
          "relative flex h-24 w-24 shrink-0 items-center justify-center rounded-full text-white ring-4 ring-white/10",
          a.gradient,
        )}
        aria-hidden
      >
        <span className="absolute inset-1.5 rounded-full border-2 border-dashed border-white/40" />
        <BadgeCheck className="h-9 w-9" />
      </span>
      <div>
        <h3 className="text-lg font-black uppercase tracking-wide text-white">{heading}</h3>
        <p className="mt-1.5 max-w-md text-sm leading-relaxed text-zinc-400">{description}</p>
      </div>
    </div>
  );
}

export default MoneyBackGuarantee;
