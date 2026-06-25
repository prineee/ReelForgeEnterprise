import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { GlassCard } from "./GlassCard";

export interface StatsCardProps {
  label: string;
  value: ReactNode;
  icon?: ReactNode;
  hint?: string;
  trend?: { value: string; direction: "up" | "down" };
  className?: string;
}

/** Dashboard metric tile. */
export function StatsCard({ label, value, icon, hint, trend, className }: StatsCardProps) {
  return (
    <GlassCard className={cn("p-6 sm:p-6", className)}>
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <p className="text-sm font-medium text-zinc-400">{label}</p>
          <p className="text-3xl font-black tracking-tight text-white">{value}</p>
          {hint && <p className="text-xs text-zinc-500">{hint}</p>}
        </div>
        {icon && (
          <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-orange-400">
            {icon}
          </div>
        )}
      </div>
      {trend && (
        <p
          className={cn(
            "mt-4 inline-flex items-center gap-1 text-sm font-semibold",
            trend.direction === "up" ? "text-emerald-400" : "text-red-400",
          )}
        >
          <span aria-hidden>{trend.direction === "up" ? "▲" : "▼"}</span>
          {trend.value}
        </p>
      )}
    </GlassCard>
  );
}

export default StatsCard;
