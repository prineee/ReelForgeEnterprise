import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";
import { containerWidth, spacing } from "../ui/tokens";

type Width = keyof typeof containerWidth;

export interface MaxWidthContainerProps extends HTMLAttributes<HTMLDivElement> {
  width?: Width;
}

/** Centers content with a responsive max width + horizontal gutters. */
export function MaxWidthContainer({
  width = "default",
  className,
  children,
  ...props
}: MaxWidthContainerProps) {
  return (
    <div
      className={cn("mx-auto w-full", containerWidth[width], spacing.gutter, className)}
      {...props}
    >
      {children}
    </div>
  );
}

export default MaxWidthContainer;
