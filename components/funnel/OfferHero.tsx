import { ShieldCheck, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { MaxWidthContainer } from "@/components/shared";
import { Badge } from "@/components/ui";
import { PriceTag } from "./PriceTag";
import { PurchaseCTA } from "./PurchaseCTA";
import { resolveAccents, type FunnelThemeAccents } from "./types";

export interface OfferHeroProps {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  price: string;
  originalPrice?: string;
  savings?: string;
  ctaText?: string;
  ctaHref?: string;
  guaranteeNote?: string;
  accents?: FunnelThemeAccents;
}

/** Funnel hero: offer headline, price block and primary CTA with ambient glow. */
export function OfferHero({
  eyebrow,
  title,
  subtitle,
  price,
  originalPrice,
  savings,
  ctaText = "Get Instant Access",
  ctaHref,
  guaranteeNote = "Secure checkout · Instant access",
  accents,
}: OfferHeroProps) {
  const a = resolveAccents(accents);

  return (
    <section className="relative overflow-hidden pb-16 pt-20 sm:pb-20 sm:pt-28">
      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute -top-24 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full opacity-30 blur-[120px]",
          a.gradient,
        )}
      />
      <MaxWidthContainer width="narrow" className="relative z-10 text-center">
        {eyebrow && (
          <Badge variant="default" className="mb-6 gap-2">
            <Star className="h-3.5 w-3.5" />
            {eyebrow}
          </Badge>
        )}

        <h1 className="text-balance text-4xl font-black tracking-tight text-white sm:text-5xl lg:text-6xl">
          {title}
        </h1>

        {subtitle && (
          <p className="mx-auto mt-5 max-w-2xl text-lg text-zinc-400">{subtitle}</p>
        )}

        <div className="mt-10 flex flex-col items-center gap-7">
          <PriceTag price={price} originalPrice={originalPrice} savings={savings} size="lg" />
          <PurchaseCTA
            label={ctaText}
            href={ctaHref}
            full={false}
            subText={
              <span className="inline-flex items-center gap-1.5">
                <ShieldCheck className="h-3.5 w-3.5 text-orange-400" />
                {guaranteeNote}
              </span>
            }
          />
        </div>
      </MaxWidthContainer>
    </section>
  );
}

export default OfferHero;
