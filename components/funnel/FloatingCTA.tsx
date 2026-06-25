import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { gradients, shadows } from "@/components/ui";

export interface FloatingCTAProps {
  ctaText?: string;
  ctaHref?: string;
  className?: string;
}

/** Floating corner CTA pill for persistent conversion. */
export function FloatingCTA({
  ctaText = "Get Instant Access",
  ctaHref = "#",
  className,
}: FloatingCTAProps) {
  return (
    <div className={cn("fixed bottom-6 right-6 z-40", className)}>
      <Link
        href={ctaHref}
        className={cn(
          "inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-semibold text-white outline-none transition-transform duration-300 hover:scale-105 focus-visible:ring-2 focus-visible:ring-orange-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-black",
          gradients.primary,
          shadows.glowOrange,
        )}
      >
        {ctaText}
        <ArrowRight className="h-4 w-4" />
      </Link>
    </div>
  );
}

export default FloatingCTA;
