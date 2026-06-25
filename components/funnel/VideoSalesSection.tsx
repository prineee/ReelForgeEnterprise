import { Play } from "lucide-react";
import { cn } from "@/lib/utils";
import { MaxWidthContainer } from "@/components/shared";
import { SectionTitle, radius } from "@/components/ui";
import { PurchaseCTA } from "./PurchaseCTA";

export interface VideoSalesSectionProps {
  eyebrow?: string;
  title?: string;
  subtitle?: string;
  /** Optional self-hosted/MP4 source. When omitted a play placeholder shows. */
  videoUrl?: string;
  posterUrl?: string;
  ctaText?: string;
  ctaHref?: string;
  className?: string;
}

/** Video sales letter (VSL) section with a 16:9 player and CTA. */
export function VideoSalesSection({
  eyebrow,
  title,
  subtitle,
  videoUrl,
  posterUrl,
  ctaText,
  ctaHref,
  className,
}: VideoSalesSectionProps) {
  return (
    <section className={cn("py-16 sm:py-20", className)}>
      <MaxWidthContainer width="narrow" className="text-center">
        {(title || eyebrow) && (
          <SectionTitle eyebrow={eyebrow} title={title ?? ""} subtitle={subtitle} />
        )}

        <div
          className={cn(
            "relative mt-10 aspect-video w-full overflow-hidden border border-white/10 bg-white/5 backdrop-blur-xl",
            radius.xl,
          )}
        >
          {videoUrl ? (
            <video
              controls
              preload="none"
              poster={posterUrl}
              className="h-full w-full object-cover"
            >
              <source src={videoUrl} />
              Your browser does not support the video tag.
            </video>
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-orange-500/15 to-purple-600/15">
              <span
                className="flex h-20 w-20 items-center justify-center rounded-full bg-black/50 text-white ring-1 ring-white/20 backdrop-blur-md"
                aria-label="Video preview"
              >
                <Play className="h-9 w-9 translate-x-0.5 fill-white" />
              </span>
            </div>
          )}
        </div>

        {ctaText && (
          <div className="mt-10">
            <PurchaseCTA label={ctaText} href={ctaHref} full={false} />
          </div>
        )}
      </MaxWidthContainer>
    </section>
  );
}

export default VideoSalesSection;
