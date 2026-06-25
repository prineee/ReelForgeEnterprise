import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";
import { SectionWrapper } from "./SectionWrapper";
import type { MaxWidthContainerProps } from "./MaxWidthContainer";

export interface MarketingSectionProps extends HTMLAttributes<HTMLElement> {
  width?: MaxWidthContainerProps["width"];
  /** Center-align content (typical for marketing). */
  center?: boolean;
}

/** Marketing-page section — generous spacing, optional centered content. */
export function MarketingSection({
  width = "default",
  center = false,
  className,
  children,
  ...props
}: MarketingSectionProps) {
  return (
    <SectionWrapper
      width={width}
      className={cn("relative", center && "text-center", className)}
      {...props}
    >
      {children}
    </SectionWrapper>
  );
}

export default MarketingSection;
