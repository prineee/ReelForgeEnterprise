import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";
import { spacing } from "../ui/tokens";
import { MaxWidthContainer, type MaxWidthContainerProps } from "./MaxWidthContainer";

export interface SectionWrapperProps extends HTMLAttributes<HTMLElement> {
  width?: MaxWidthContainerProps["width"];
  /** Use the tighter vertical rhythm. */
  tight?: boolean;
  /** Wrap children in a MaxWidthContainer. Default: true. */
  contained?: boolean;
}

/** Generic vertical section with optional centered max-width content. */
export function SectionWrapper({
  width,
  tight = false,
  contained = true,
  className,
  children,
  ...props
}: SectionWrapperProps) {
  return (
    <section className={cn(tight ? spacing.sectionTight : spacing.section, className)} {...props}>
      {contained ? <MaxWidthContainer width={width}>{children}</MaxWidthContainer> : children}
    </section>
  );
}

export default SectionWrapper;
