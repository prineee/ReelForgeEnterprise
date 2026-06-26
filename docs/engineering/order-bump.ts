/**
 * @file config/order-bump.ts
 * @description All marketing and UI content for the Order Bump page.
 * This keeps the page component clean and data-driven.
 */

import { FAQAccordionItem, FunnelTestimonial } from "@/components/funnel";

export const ORDER_BUMP_HERO = {
  pillText: "One-Time Offer - 91% Off",
  title: "Don't Close This Page!",
  subtitle:
    "Add The AI Prompt Vault to Your Order for Just $17 (Usually $197)",
};

export const ORDER_BUMP_VALUE_STACK = {
  title: "Here's Everything You Get:",
  items: [
    "500+ Battle-Tested AI Prompts",
    "12+ Prompt Categories (Reels, Ads, etc.)",
    "Full Commercial License",
    "Free Lifetime Updates",
    "Bonus: Prompt Engineering Guide",
    "Bonus: Viral Video Checklist",
  ],
};

export const ORDER_BUMP_TESTIMONIALS: FunnelTestimonial[] = [
  {
    quote:
      "The Prompt Vault is my secret weapon. I can generate a week's worth of high-quality video ideas in under 10 minutes. It's a no-brainer at this price.",
    author: "Alex Hormozi",
    role: "CEO, Author",
    company: "Acquisition.com",
    rating: 5,
  },
];

export const ORDER_BUMP_FAQ: FAQAccordionItem[] = [
  {
    q: "Is this a one-time payment?",
    a: "Yes! This is a one-time payment for lifetime access to the AI Prompt Vault, including all future updates.",
  },
  {
    q: "What if I don't like it?",
    a: "Just like your main purchase, this offer is covered by our 30-day money-back guarantee. If you don't find it valuable, just email us for a full refund.",
  },
  {
    q: "How do I access the prompts?",
    a: "The Prompt Vault will be automatically added to your ReelForge dashboard. You can access it anytime from the main navigation.",
  },
];