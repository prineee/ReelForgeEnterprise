import type { HTMLAttributes, KeyboardEvent } from "react";
import { cn } from "@/lib/utils";
import { durations, focusRing, glass, radius } from "./tokens";

export interface GlassCardProps extends HTMLAttributes<HTMLDivElement> {
  /** Light lift + glow on hover. Enabled by default. */
  hover?: boolean;
}

/**
 * Canonical glass-morphism surface for the design system.
 * Becomes keyboard-accessible automatically when an `onClick` handler is given.
 */
export function GlassCard({
  className,
  hover = true,
  children,
  onClick,
  onKeyDown,
  ...props
}: GlassCardProps) {
  const clickable = typeof onClick === "function";

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (clickable && (e.key === "Enter" || e.key === " ")) {
      e.preventDefault();
      e.currentTarget.click();
    }
    onKeyDown?.(e);
  };

  return (
    <div
      className={cn(
        glass,
        radius.xl,
        "p-6 transition-all sm:p-8",
        durations.base,
        hover &&
          "hover:-translate-y-1 hover:border-purple-500/40 hover:shadow-[0_0_60px_rgba(124,58,237,0.20)]",
        clickable && cn("cursor-pointer", focusRing),
        className,
      )}
      {...(clickable
        ? { onClick, onKeyDown: handleKeyDown, tabIndex: 0, role: "button" }
        : {})}
      {...props}
    >
      {children}
    </div>
  );
}

export default GlassCard;
