/**
 * Premium Sales Funnel Framework.
 *
 * Reusable, configuration-driven funnel components built on the Enterprise
 * Design System. Funnel pages compose these and feed them a `FunnelConfig`.
 * No payment logic lives here.
 *
 *   import { OfferHero, BonusStack, type FunnelConfig } from "@/components/funnel";
 */

// Shared configuration model + helpers
export * from "./types";

// Shared primitives (reused to avoid duplicated markup)
export { PriceTag } from "./PriceTag";
export { PurchaseCTA } from "./PurchaseCTA";

// Required funnel components
export { OfferHero } from "./OfferHero";
export { OfferCard } from "./OfferCard";
export { PricingComparisonTable, type ComparisonPlan } from "./PricingComparisonTable";
export { BonusStack } from "./BonusStack";
export { GuaranteeBox } from "./GuaranteeBox";
export { CountdownBanner } from "./CountdownBanner";
export { StickyPurchaseBar } from "./StickyPurchaseBar";
export { FeatureChecklist } from "./FeatureChecklist";
export { BeforeAfterComparison } from "./BeforeAfterComparison";
export { TestimonialWall } from "./TestimonialWall";
export { FAQAccordion, type FAQAccordionItem } from "./FAQAccordion";
export { ScarcityBanner } from "./ScarcityBanner";
export { ValueStack, type ValueStackItem } from "./ValueStack";
export { OfferProgress } from "./OfferProgress";
export { CheckoutSummary, type CheckoutSummaryLine } from "./CheckoutSummary";
export { FloatingCTA } from "./FloatingCTA";
export { OfferSection } from "./OfferSection";
export { VideoSalesSection } from "./VideoSalesSection";
export { MoneyBackGuarantee } from "./MoneyBackGuarantee";
export { TrustBadges, type TrustBadgeItem } from "./TrustBadges";
