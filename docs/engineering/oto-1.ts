/**
 * @file config/oto-1.ts
 * @description All marketing and UI content for the OTO1 (ReelForge PRO) page.
 */

import { CheckIcon } from "lucide-react";
import { FAQAccordionItem, FunnelTestimonial } from "@/components/funnel";

export const OTO1_HERO = {
  pillText: "Exclusive Upgrade Offer",
  title: "You've Unlocked The Next Level: ReelForge PRO",
  subtitle:
    "For just $67 more, unlock unlimited rendering, premium AI, 4K exports, and the full commercial license to scale your video business.",
};

export const OTO1_FEATURES = [
  {
    icon: CheckIcon,
    title: "Unlimited Rendering",
    description: "Create as many videos as you want. No daily or monthly limits.",
  },
  {
    icon: CheckIcon,
    title: "Premium AI Models",
    description: "Access our most advanced AI for superior scriptwriting and voice generation.",
  },
  {
    icon: CheckIcon,
    title: "HD & 4K Exports",
    description: "Deliver stunning, crystal-clear videos to your clients and audience.",
  },
  {
    icon: CheckIcon,
    title: "Full Commercial License",
    description: "Sell your creations to clients and build your video agency with confidence.",
  },
  {
    icon: CheckIcon,
    title: "Priority Rendering Queue",
    description: "Your jobs get processed first, ensuring the fastest possible turnaround times.",
  },
  {
    icon: CheckIcon,
    title: "Future PRO Updates",
    description: "Receive all future PRO-level features and updates at no extra cost.",
  },
];

export const OTO1_TESTIMONIALS: FunnelTestimonial[] = [
  {
    quote:
      "Upgrading to PRO was the single best decision for my agency. The 4K exports and commercial license alone paid for the upgrade in a single client project.",
    author: "Sarah Johnson",
    role: "Founder",
    company: "Vireo Media",
    rating: 5,
  },
];

export const OTO1_FAQ: FAQAccordionItem[] = [
  {
    q: "Is this a one-time payment?",
    a: "Yes! This is a one-time payment to upgrade your account to ReelForge PRO for life. You will never be charged again for these features.",
  },
  {
    q: "What if I already bought a plan on the previous page?",
    a: "This is a special upgrade offer. Your previous purchase will be upgraded to the PRO license, and you will receive all associated features and credits.",
  },
  {
    q: "Is this covered by the money-back guarantee?",
    a: "Absolutely. Your entire purchase, including this upgrade, is covered by our 30-day money-back guarantee. If you're not satisfied, you get a full refund.",
  },
];