import { Check, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { toFeature, type FunnelFeature } from "./types";

export interface FeatureChecklistProps {
  features: (string | FunnelFeature)[];
  columns?: 1 | 2;
  className?: string;
}

/** Reusable list of features with included/excluded markers. */
export function FeatureChecklist({ features, columns = 1, className }: FeatureChecklistProps) {
  return (
    <ul
      className={cn(
        "gap-3",
        columns === 2 ? "grid grid-cols-1 sm:grid-cols-2" : "flex flex-col",
        className,
      )}
    >
      {features.map((raw, i) => {
        const f = toFeature(raw);
        return (
          <li
            key={i}
            className={cn(
              "flex items-start gap-3 text-sm",
              f.included ? "text-zinc-200" : "text-zinc-500",
            )}
          >
            <span
              className={cn(
                "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full",
                f.included
                  ? "bg-orange-500/20 text-orange-400"
                  : "bg-white/5 text-zinc-500",
              )}
              aria-hidden
            >
              {f.included ? <Check className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />}
            </span>
            <span className={cn(!f.included && "line-through")}>{f.label}</span>
          </li>
        );
      })}
    </ul>
  );
}

export default FeatureChecklist;
