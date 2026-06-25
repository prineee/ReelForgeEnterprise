import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";
import { spacing } from "../ui/tokens";
import { MaxWidthContainer, type MaxWidthContainerProps } from "./MaxWidthContainer";

export interface SectionContainerProps extends HTMLAttributes<HTMLElement> {
  width?: MaxWidthContainerProps["width"];
}

/**
 * Relatively-positioned section that clips ambient glows and layers content
 * above them. Use when a section hosts decorative background effects.
 */
export function SectionContainer({
  width,
  className,
  children,
  ...props
}: SectionContainerProps) {
  return (
    <section className={cn("relative overflow-hidden", spacing.section, className)} {...props}>
      <MaxWidthContainer width={width} className="relative z-10">
        {children}
      </MaxWidthContainer>
    </section>
  );
}

export default SectionContainer;
