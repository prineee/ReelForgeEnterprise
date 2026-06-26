"use client";

import { FunnelStickyBar } from "@/components/funnel";
import { RECOMMENDED_PLAN } from "@/config/pricing";

/**
 * Renders a sticky upgrade bar that appears as the user scrolls.
 * This is a client component because it uses hooks to track scroll position.
 * It fetches its data directly from the centralized pricing configuration.
 */
export function StickyUpgradeBar() {
  return (
    <FunnelStickyBar
      ctaText={`Upgrade to ${RECOMMENDED_PLAN.name}`}
      ctaHref={RECOMMENDED_PLAN.purchaseUrl}
    />
  );
}