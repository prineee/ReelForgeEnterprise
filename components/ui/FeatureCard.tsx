import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { GlassCard } from "./GlassCard";

export interface FeatureCardProps {
  icon?: ReactNode;
  title: string;
  description: ReactNode;
  className?: string;
}

/** Marketing feature tile — icon, title, supporting copy. */
export function FeatureCard({ icon, title, description, className }: FeatureCardProps) {
  return (
    <GlassCard className={cn("h-full", className)}>
      {icon && (
        <div className="mb-5 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-500/20 to-purple-600/20 text-orange-400 ring-1 ring-white/10">
          {icon}
        </div>
      )}
      <h3 className="text-xl font-bold text-white">{title}</h3>
      <p className="mt-2 leading-relaxed text-zinc-400">{description}</p>
    </GlassCard>
  );
}

export default FeatureCard;
