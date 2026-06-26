import type {
  FAQAccordionItem,
  FunnelGuarantee,
  FunnelTestimonial,
} from "@/components/funnel";

export const PRICING_GUARANTEE: Required<FunnelGuarantee> = {
  days: 30,
  title: "30-Day Money-Back Guarantee",
  description:
    "Try ReelForge risk-free. If it's not the right fit within 30 days, email us for a full refund — no questions asked.",
};

export const PRICING_TESTIMONIALS: FunnelTestimonial[] = [
  {
    quote:
      "Upgrading to Pro paid for itself in a week. The 4K exports and priority rendering are a game changer for client work.",
    author: "Sarah Johnson",
    role: "Fitness Creator",
    company: "420K followers",
    rating: 5,
  },
  {
    quote:
      "We run the Agency plan across our whole team. White-label exports and API access let us scale to 40+ clients.",
    author: "Marcus Chen",
    role: "Founder",
    company: "Chen Media",
    rating: 5,
  },
  {
    quote:
      "VIP is unreal value. 10,000 credits a month plus early access means we're always ahead of competitors.",
    author: "Priya Sharma",
    role: "Head of Content",
    company: "Sharma Studios",
    rating: 5,
  },
];

export const PRICING_FAQ: FAQAccordionItem[] = [
  {
    q: "What's the difference between one-time plans and VIP?",
    a: "Starter, Pro and Agency are one-time payments with lifetime access to that credit tier. VIP is a monthly subscription that refreshes 10,000 credits every month and includes early access to new features.",
  },
  {
    q: "What are AI credits?",
    a: "Credits are spent when you generate videos, scripts, voiceovers and images. Each plan includes a different monthly or lifetime allocation, and you can always top up later.",
  },
  {
    q: "Can I use ReelForge content commercially?",
    a: "Pro, Agency and VIP include a commercial license so you can use generated content for clients and paid work. Starter is intended for personal use.",
  },
  {
    q: "Can I upgrade my plan later?",
    a: "Yes. You can upgrade at any time and only pay the difference — your existing credits carry over.",
  },
];