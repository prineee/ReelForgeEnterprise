import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: ReactNode;
  /** Typically a button (e.g. PrimaryButton) to recover from the empty state. */
  action?: ReactNode;
  className?: string;
}

/** Friendly placeholder for empty lists / no-data views. */
export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-3xl border border-dashed border-white/15 bg-white/[0.02] px-6 py-16 text-center",
        className,
      )}
    >
      {icon && (
        <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-500/15 to-purple-600/15 text-orange-400 ring-1 ring-white/10">
          {icon}
        </div>
      )}
      <h3 className="text-xl font-bold text-white">{title}</h3>
      {description && <p className="mt-2 max-w-md text-sm text-zinc-400">{description}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

export default EmptyState;
