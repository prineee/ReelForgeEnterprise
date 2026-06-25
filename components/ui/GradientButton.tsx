import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";
import { Button } from "./button";
import { focusRing, shadows } from "./tokens";

export type GradientButtonProps = Omit<ComponentProps<typeof Button>, "variant">;

/**
 * Hero gradient CTA — animated orange→purple sweep with premium glow.
 * Wraps the shared Button so styling logic is never duplicated.
 */
export function GradientButton({ className, ...props }: GradientButtonProps) {
  return (
    <Button
      variant="primary"
      className={cn(
        focusRing,
        shadows.glowOrange,
        "bg-[length:200%_auto] bg-left transition-[background-position,transform] hover:bg-right hover:scale-[1.03]",
        className,
      )}
      {...props}
    />
  );
}

export default GradientButton;
