import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { gradients, radius, shadows } from "./tokens";
import { MaxWidthContainer } from "../shared/MaxWidthContainer";
import { GradientButton } from "./GradientButton";
import { SecondaryButton } from "./SecondaryButton";

export interface CTASectionProps {
  title: ReactNode;
  subtitle?: ReactNode;
  primaryLabel?: string;
  primaryHref?: string;
  secondaryLabel?: string;
  secondaryHref?: string;
  /** Custom actions; overrides the default primary/secondary buttons. */
  children?: ReactNode;
  className?: string;
}

/** Full-width call-to-action band with glass panel + brand glow. */
export function CTASection({
  title,
  subtitle,
  primaryLabel,
  primaryHref,
  secondaryLabel,
  secondaryHref,
  children,
  className,
}: CTASectionProps) {
  return (
    <section className={cn("py-16 sm:py-20", className)}>
      <MaxWidthContainer>
        <div
          className={cn(
            "relative overflow-hidden border border-white/10 bg-white/5 px-6 py-14 text-center backdrop-blur-xl sm:px-12",
            radius.xl,
            shadows.glowPurple,
          )}
        >
          <div
            aria-hidden
            className={cn(
              "pointer-events-none absolute inset-x-0 -top-24 mx-auto h-48 w-2/3 opacity-40 blur-[120px]",
              gradients.primary,
            )}
          />
          <h2 className="relative text-3xl font-black tracking-tight text-white sm:text-4xl lg:text-5xl">
            {title}
          </h2>
          {subtitle && (
            <p className="relative mx-auto mt-4 max-w-2xl text-zinc-300">{subtitle}</p>
          )}
          <div className="relative mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
            {children ?? (
              <>
                {primaryLabel && (
                  <GradientButton href={primaryHref} size="lg">
                    {primaryLabel}
                  </GradientButton>
                )}
                {secondaryLabel && (
                  <SecondaryButton href={secondaryHref} size="lg">
                    {secondaryLabel}
                  </SecondaryButton>
                )}
              </>
            )}
          </div>
        </div>
      </MaxWidthContainer>
    </section>
  );
}

export default CTASection;
