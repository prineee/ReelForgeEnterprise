import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { resolveAccents, type FunnelThemeAccents } from "./types";

export interface OfferProgressProps {
  steps: string[];
  /** Zero-based index of the active step. */
  current: number;
  accents?: FunnelThemeAccents;
  className?: string;
}

/** Funnel progress indicator (e.g. Offer → Bonus → Checkout). */
export function OfferProgress({ steps, current, accents, className }: OfferProgressProps) {
  const a = resolveAccents(accents);

  return (
    <nav
      aria-label="Funnel progress"
      className={cn("mx-auto flex max-w-2xl items-center justify-center", className)}
    >
      <ol className="flex w-full items-center">
        {steps.map((step, i) => {
          const isComplete = i < current;
          const isActive = i === current;
          return (
            <li key={step} className={cn("flex items-center", i < steps.length - 1 && "flex-1")}>
              <div className="flex flex-col items-center gap-1.5">
                <span
                  aria-current={isActive ? "step" : undefined}
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition-colors",
                    isComplete && cn("text-white", a.gradient),
                    isActive && "bg-white text-black",
                    !isComplete && !isActive && "border border-white/15 bg-white/5 text-zinc-500",
                  )}
                >
                  {isComplete ? <Check className="h-4 w-4" /> : i + 1}
                </span>
                <span
                  className={cn(
                    "whitespace-nowrap text-xs",
                    isActive ? "font-semibold text-white" : "text-zinc-500",
                  )}
                >
                  {step}
                </span>
              </div>
              {i < steps.length - 1 && (
                <span
                  className={cn(
                    "mx-2 h-px flex-1 sm:mx-3",
                    i < current ? "bg-orange-500/60" : "bg-white/10",
                  )}
                  aria-hidden
                />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export default OfferProgress;
