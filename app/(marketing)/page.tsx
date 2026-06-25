import type { FaqItem } from "@/components/marketing/landing";
import {
  PremiumHero,
  TrustedBy,
  AIStudioOverview,
  InteractiveFeatureGrid,
  MovieStudioShowcase,
  CartoonStudioShowcase,
  MarketingStudioShowcase,
  HowItWorks,
  BeforeAfter,
  AICapabilities,
  CustomerTestimonials,
  PricingPreview,
  WhyReelForge,
  FAQ,
  FinalCTA,
} from "@/components/marketing/landing";

// ── SEO content (single source for the rendered FAQ + FAQPage structured data) ──
const FAQS: FaqItem[] = [
  {
    q: "What is ReelForge?",
    a: "ReelForge is an AI-powered video creator that automatically generates scripts, voiceovers, and video reels for Instagram, TikTok, and YouTube Shorts.",
  },
  {
    q: "How do I create an AI reel?",
    a: "Simply enter your topic, choose your niche and platform, and ReelForge AI generates a complete script, professional voiceover, and video with matching stock clips — all in under 2 minutes.",
  },
  {
    q: "Is ReelForge free to use?",
    a: "Yes! ReelForge offers 10 free credits on signup with no credit card required. Each reel costs 5 credits. Upgrade to Pro for 500 credits per month.",
  },
  {
    q: "What platforms does ReelForge support?",
    a: "ReelForge creates vertical 9:16 videos optimized for Instagram Reels, TikTok, and YouTube Shorts. All videos export in 1080×1920 HD resolution.",
  },
  {
    q: "Can I add captions to my reels?",
    a: "Yes! ReelForge includes a free caption burner with 6 styles including TikTok-style, karaoke, bold white, and yellow captions.",
  },
  {
    q: "Does ReelForge support multiple languages?",
    a: "ReelForge generates scripts in English and supports voiceovers in 6 different voice styles. Multi-language support is coming soon.",
  },
  {
    q: "What is the HeyGen avatar feature?",
    a: "The HeyGen integration lets you create talking avatar videos where an AI presenter reads your script with realistic lip-sync — perfect for faceless content creators.",
  },
  {
    q: "How many reels can I create per month?",
    a: "It depends on your plan. Free users get 10 Pro credits. Pro users get 500 credits per month (100 reels). Agency users get 2,000 credits per month.",
  },
];

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "ReelForge",
  applicationCategory: "MultimediaApplication",
  description: "AI-powered video reel creator for Instagram, TikTok and YouTube",
  offers: {
    "@type": "AggregateOffer",
    lowPrice: "0",
    highPrice: "60",
    priceCurrency: "USD",
  },
  aggregateRating: {
    "@type": "AggregateRating",
    ratingValue: "4.8",
    reviewCount: "1247",
  },
};

const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: FAQS.map((f) => ({
    "@type": "Question",
    name: f.q,
    acceptedAnswer: { "@type": "Answer", text: f.a },
  })),
};

export default function HomePage() {
  return (
    <main className="min-h-screen text-white">
      {/* Structured data (SEO) */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />

      <PremiumHero />
      <TrustedBy />
      <AIStudioOverview />
      <InteractiveFeatureGrid />
      <MovieStudioShowcase />
      <CartoonStudioShowcase />
      <MarketingStudioShowcase />
      <HowItWorks />
      <BeforeAfter />
      <AICapabilities />
      <CustomerTestimonials />
      <PricingPreview />
      <WhyReelForge />
      <FAQ items={FAQS} />
      <FinalCTA />
    </main>
  );
}
