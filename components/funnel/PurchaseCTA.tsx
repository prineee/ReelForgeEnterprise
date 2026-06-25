import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { GradientButton, PrimaryButton } from "@/components/ui";

export interface PurchaseCTAProps {
  label: string;
  href?: string;
  /** Presentational only — no payment logic is implemented here. */
  onClick?: () => void;
  subText?: ReactNode;
  size?: "sm" | "md" | "lg";
  full?: boolean;
  variant?: "gradient" | "solid";
  className?: string;
}

/**
 * Canonical funnel call-to-action. Every funnel component reuses this so CTA
 * markup/behaviour is never duplicated. It only navigates (no checkout logic).
 */
export function PurchaseCTA({
  label,
  href,
  onClick,
  subText,
  size = "lg",
  full = true,
  variant = "gradient",
  className,
}: PurchaseCTAProps) {
  const Btn = variant === "gradient" ? GradientButton : PrimaryButton;

  return (
    <div className={cn("flex flex-col items-center gap-2", className)}>
      <Btn href={href} onClick={onClick} size={size} full={full}>
        <span className="inline-flex items-center justify-center gap-2">{label}</span>
      </Btn>
      {subText && <p className="text-xs text-zinc-500">{subText}</p>}
    </div>
  );
}

export default PurchaseCTA;
