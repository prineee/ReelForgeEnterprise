import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";
import { MaxWidthContainer } from "./MaxWidthContainer";

export interface HeroContainerProps extends HTMLAttributes<HTMLElement> {
  align?: "center" | "left";
}

/** Hero section wrapper with the signature orange + purple ambient glows. */
export function HeroContainer({ align = "center", className, children, ...props }: HeroContainerProps) {
  return (
    <section
      className={cn("relative overflow-hidden pb-20 pt-24 sm:pb-28 sm:pt-32", className)}
      {...props}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -top-32 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-orange-500/20 blur-[120px]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute right-10 top-20 h-72 w-72 rounded-full bg-purple-600/20 blur-[120px]"
      />
      <MaxWidthContainer className={cn("relative z-10", align === "center" && "text-center")}>
        {children}
      </MaxWidthContainer>
    </section>
  );
}

export default HeroContainer;
