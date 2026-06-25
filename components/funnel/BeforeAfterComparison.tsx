import { Check, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { GlassCard } from "@/components/ui";

export interface BeforeAfterComparisonProps {
  before: string[];
  after: string[];
  beforeTitle?: string;
  afterTitle?: string;
  className?: string;
}

/** Two-column "before vs after" contrast, rendered from config arrays. */
export function BeforeAfterComparison({
  before,
  after,
  beforeTitle = "Before",
  afterTitle = "After",
  className,
}: BeforeAfterComparisonProps) {
  return (
    <div className={cn("grid grid-cols-1 gap-6 md:grid-cols-2", className)}>
      <GlassCard hover={false} className="border-red-500/20">
        <h3 className="flex items-center gap-2 text-lg font-bold text-red-300">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-red-500/15 ring-1 ring-red-500/40">
            <X className="h-4 w-4" />
          </span>
          {beforeTitle}
        </h3>
        <ul className="mt-6 space-y-3">
          {before.map((item) => (
            <li key={item} className="flex items-center gap-3 text-sm text-zinc-400">
              <X className="h-4 w-4 shrink-0 text-red-500/80" aria-hidden />
              {item}
            </li>
          ))}
        </ul>
      </GlassCard>

      <GlassCard className="border-orange-500/30 ring-1 ring-orange-500/20">
        <h3 className="flex items-center gap-2 text-lg font-bold text-orange-300">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-orange-500/15 ring-1 ring-orange-500/40">
            <Check className="h-4 w-4" />
          </span>
          {afterTitle}
        </h3>
        <ul className="mt-6 space-y-3">
          {after.map((item) => (
            <li key={item} className="flex items-center gap-3 text-sm text-zinc-200">
              <Check className="h-4 w-4 shrink-0 text-orange-400" aria-hidden />
              {item}
            </li>
          ))}
        </ul>
      </GlassCard>
    </div>
  );
}

export default BeforeAfterComparison;
