import { Metadata } from "next";
import {
  FunnelComparisonTable,
  FunnelCta,
  FunnelFAQ,
  FunnelFeatureGrid,
  FunnelGuarantee,
  FunnelHero,
  FunnelStickyBar,
  FunnelTestimonials,
} from "@/components/funnel";
import {
  OTO1_FAQ,
  OTO1_FEATURES,
  OTO1_HERO,
  OTO1_TESTIMONIALS,
} from "@/config/oto-1";
import { getOfferById } from "@/lib/offer-engine";
import { Section } from "@/components/ui/section";
import { CheckIcon, XIcon } from "lucide-react";

export async function generateMetadata(): Promise<Metadata> {
  const offer = getOfferById("oto-1");
  if (!offer) return {};

  return {
    title: `OTO1 - ${offer.name}`,
    description: offer.headline,
  };
}

export default function Oto1Page() {
  const proOffer = getOfferById("oto-1");
  const starterOffer = getOfferById("starter");

  if (!proOffer || !starterOffer) {
    return <p>Offer not found.</p>;
  }

  const comparisonPlans = [
    {
      name: starterOffer.name,
      features: [
        { label: "1080p HD Exports", included: true, icon: <CheckIcon className="h-5 w-5 text-green-500" /> },
        { label: "Standard AI Models", included: true, icon: <CheckIcon className="h-5 w-5 text-green-500" /> },
        { label: "Personal Use License", included: true, icon: <CheckIcon className="h-5 w-5 text-green-500" /> },
        { label: "4K Ultra HD Exports", included: false, icon: <XIcon className="h-5 w-5 text-red-500" /> },
        { label: "Full Commercial License", included: false, icon: <XIcon className="h-5 w-5 text-red-500" /> },
        { label: "Priority Rendering Queue", included: false, icon: <XIcon className="h-5 w-5 text-red-500" /> },
      ],
    },
    {
      name: "ReelForge PRO",
      highlighted: true,
      features: [
        { label: "1080p HD Exports", included: true, icon: <CheckIcon className="h-5 w-5 text-green-500" /> },
        { label: "Standard AI Models", included: true, icon: <CheckIcon className="h-5 w-5 text-green-500" /> },
        { label: "Personal Use License", included: true, icon: <CheckIcon className="h-5 w-5 text-green-500" /> },
        { label: "4K Ultra HD Exports", included: true, icon: <CheckIcon className="h-5 w-5 text-green-500" /> },
        { label: "Full Commercial License", included: true, icon: <CheckIcon className="h-5 w-5 text-green-500" /> },
        { label: "Priority Rendering Queue", included: true, icon: <CheckIcon className="h-5 w-5 text-green-500" /> },
      ],
    },
  ];

  return (
    <>
      <FunnelHero
        pillText={OTO1_HERO.pillText}
        title={OTO1_HERO.title}
        description={OTO1_HERO.subtitle}
      />

      <Section className="max-w-5xl">
        <h2 className="text-center text-3xl font-bold md:text-4xl">
          From Creator to Professional
        </h2>
        <p className="mx-auto mt-4 max-w-3xl text-center text-lg text-slate-400">
          ReelForge PRO is the essential toolkit for anyone serious about using
          AI video for business. Stop limiting your potential and unlock the
          features used by top-performing agencies and content professionals.
        </p>
      </Section>

      <Section>
        <FunnelFeatureGrid features={OTO1_FEATURES} />
      </Section>

      <Section>
        <FunnelComparisonTable plans={comparisonPlans} />
      </Section>

      <FunnelTestimonials
        title="The Professional's Choice"
        testimonials={OTO1_TESTIMONIALS}
      />
      <FunnelGuarantee />
      <FunnelFAQ title="PRO Upgrade FAQ" items={OTO1_FAQ} />

      <FunnelCta
        title={proOffer.headline}
        ctaText={proOffer.ctaText}
        ctaHref={proOffer.purchaseUrl}
        declineText="No thanks, I don't need the PRO features right now."
        declineHref={proOffer.nextOffer ? `/oto-2` : "/thank-you"}
      />

      <FunnelStickyBar ctaText={proOffer.ctaText} ctaHref={proOffer.purchaseUrl} />
    </>
  );
}