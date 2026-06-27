"use client";

import { StickyPurchaseBar } from "@/components/funnel";
import { RECOMMENDED_PLAN } from "@/config/pricing";

export function StickyUpgradeBar() {
  return (
    <StickyPurchaseBar
      title={RECOMMENDED_PLAN.name}
      price={String(RECOMMENDED_PLAN.price)}
      originalPrice={
        RECOMMENDED_PLAN.originalPrice
          ? String(RECOMMENDED_PLAN.originalPrice)
          : undefined
      }
      ctaText={`Upgrade to ${RECOMMENDED_PLAN.name}`}
      ctaHref={RECOMMENDED_PLAN.purchaseUrl}
    />
  );
}