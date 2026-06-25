import type { ReactNode } from "react";
import Header from "@/components/layout/Header";
import { PremiumFooter } from "@/components/marketing/landing";
import { AnnouncementBar } from "@/components/marketing/AnnouncementBar";

export interface MarketingLayoutProps {
  children: ReactNode;
  /** Show the promotional announcement bar above the nav. Default: true. */
  announcement?: boolean;
}

/**
 * Marketing experience shell: announcement bar + premium navigation + premium footer.
 * Pages control their own width (the design-system MaxWidthContainer is available),
 * so full-bleed landing sections render edge-to-edge.
 */
export function MarketingLayout({ children, announcement = true }: MarketingLayoutProps) {
  return (
    <>
      {announcement && <AnnouncementBar />}
      <Header />
      {children}
      <PremiumFooter />
    </>
  );
}

export default MarketingLayout;
