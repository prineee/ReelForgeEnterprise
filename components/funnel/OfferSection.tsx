import type { ReactNode } from "react";
import { SectionWrapper } from "@/components/shared";
import { SectionTitle } from "@/components/ui";

export interface OfferSectionProps {
  id?: string;
  eyebrow?: string;
  title?: string;
  subtitle?: string;
  align?: "center" | "left";
  width?: "narrow" | "default" | "wide";
  tight?: boolean;
  children: ReactNode;
  className?: string;
}

/** Generic funnel section wrapper: spacing + max-width + optional heading. */
export function OfferSection({
  id,
  eyebrow,
  title,
  subtitle,
  align = "center",
  width,
  tight,
  children,
  className,
}: OfferSectionProps) {
  return (
    <SectionWrapper id={id} width={width} tight={tight} className={className}>
      {title && (
        <SectionTitle eyebrow={eyebrow} title={title} subtitle={subtitle} align={align} />
      )}
      <div className={title ? "mt-12" : undefined}>{children}</div>
    </SectionWrapper>
  );
}

export default OfferSection;
