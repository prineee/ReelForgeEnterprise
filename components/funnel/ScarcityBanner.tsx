import type { ReactNode } from "react";
import { Flame } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ScarcityBannerProps {
  message: string;
  icon?: ReactNode;
  className?: string;
}

/** Static urgency/scarcity banner (e.g. "Only 12 spots left at this price"). */
export function ScarcityBanner({ message, icon, className }: ScarcityBannerProps) {
  return (
    <div
      role="status"
      className={cn(
        "flex items-center justify-center gap-2 rounded-2xl border border-orange-500/30 bg-orange-500/10 px-5 py-3 text-center text-sm font-semibold text-orange-200",
        className,
      )}
    >
      <span className="text-orange-400" aria-hidden>
        {icon ?? <Flame className="h-4 w-4" />}
      </span>
      {message}
    </div>
  );
}

export default ScarcityBanner;
