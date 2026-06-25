import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { gradients } from "@/components/ui";

export interface AnnouncementBarProps {
  message?: string;
  ctaLabel?: string;
  ctaHref?: string;
  className?: string;
}

/** Thin promotional bar with an inline CTA, shown above the marketing nav. */
export function AnnouncementBar({
  message = "New: AI Movie Studio is live",
  ctaLabel = "Start free",
  ctaHref = "/register",
  className,
}: AnnouncementBarProps) {
  return (
    <div className={cn("relative z-40 text-white", gradients.primary, className)}>
      <div className="mx-auto flex max-w-7xl items-center justify-center gap-2 px-4 py-2 text-center text-sm">
        <Sparkles className="hidden h-4 w-4 sm:inline" aria-hidden />
        <span className="font-medium">{message} —</span>
        <Link
          href={ctaHref}
          className="inline-flex items-center gap-1 font-semibold underline-offset-2 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-white/70"
        >
          {ctaLabel}
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </div>
  );
}

export default AnnouncementBar;
