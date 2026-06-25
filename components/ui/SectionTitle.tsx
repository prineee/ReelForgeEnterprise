import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { gradients, typography } from "./tokens";

export interface SectionTitleProps {
  eyebrow?: string;
  title: ReactNode;
  subtitle?: ReactNode;
  align?: "center" | "left";
  /** Apply the brand gradient to the heading text. Default: true. */
  gradient?: boolean;
  className?: string;
}

/** Standard section heading block (eyebrow + title + subtitle). */
export function SectionTitle({
  eyebrow,
  title,
  subtitle,
  align = "center",
  gradient = true,
  className,
}: SectionTitleProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3",
        align === "center" ? "items-center text-center" : "items-start text-left",
        className,
      )}
    >
      {eyebrow && <span className={typography.eyebrow}>{eyebrow}</span>}
      <h2 className={cn(typography.h2, gradient && gradients.text)}>{title}</h2>
      {subtitle && <p className={cn("max-w-2xl", typography.body)}>{subtitle}</p>}
    </div>
  );
}

export default SectionTitle;
