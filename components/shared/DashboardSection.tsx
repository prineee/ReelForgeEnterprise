import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { spacing } from "../ui/tokens";

export interface DashboardSectionProps extends HTMLAttributes<HTMLElement> {
  title?: string;
  description?: string;
  actions?: ReactNode;
}

/** Dashboard content block with an optional title row + actions. */
export function DashboardSection({
  title,
  description,
  actions,
  className,
  children,
  ...props
}: DashboardSectionProps) {
  return (
    <section className={cn("space-y-6", spacing.sectionTight, className)} {...props}>
      {(title || actions) && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-1">
            {title && (
              <h2 className="text-2xl font-bold tracking-tight text-white">{title}</h2>
            )}
            {description && <p className="text-sm text-zinc-400">{description}</p>}
          </div>
          {actions && <div className="flex items-center gap-3">{actions}</div>}
        </div>
      )}
      {children}
    </section>
  );
}

export default DashboardSection;
