import type { ReactNode } from "react";
import { gradients } from "@/components/ui/tokens";

/**
 * Shared funnel configuration model.
 *
 * Every funnel page defines a single `FunnelConfig`; all funnel components
 * render dynamically from this config (or a slice of it) rather than from
 * hard-coded content.
 */

export interface FunnelBonus {
  title: string;
  description?: string;
  /** Display value, e.g. "$97". */
  value?: string;
  icon?: ReactNode;
}

export interface FunnelFeature {
  label: string;
  /** Used by checklists / comparison tables. Defaults to true. */
  included?: boolean;
}

export interface FunnelTestimonial {
  quote: string;
  author: string;
  role?: string;
  company?: string;
  avatarUrl?: string;
  /** 0–5 stars. */
  rating?: number;
}

export interface FunnelGuarantee {
  title: string;
  description: string;
  /** Number of days, e.g. 30. */
  days?: number;
}

/** Tailwind utility-class accents so funnels can re-theme without new code. */
export interface FunnelThemeAccents {
  /** Gradient utility, e.g. "bg-gradient-to-r from-orange-500 to-purple-600". */
  gradient?: string;
  /** Accent text color utility, e.g. "text-orange-400". */
  text?: string;
  /** Accent ring/border utility, e.g. "ring-orange-500/30". */
  ring?: string;
}

export interface FunnelConfig {
  // Headline
  title: string;
  subtitle?: string;

  // Pricing
  price: string;
  originalPrice?: string;
  savings?: string;

  // Collections
  bonuses?: FunnelBonus[];
  features?: FunnelFeature[];
  testimonials?: FunnelTestimonial[];
  guarantee?: FunnelGuarantee;

  // Call to action
  ctaText?: string;
  ctaHref?: string;

  // Funnel progress
  progressStep?: number;
  progressSteps?: string[];

  // Theming
  themeAccents?: FunnelThemeAccents;
}

/** Brand-default accents, derived from the shared design tokens. */
export const defaultAccents: Required<FunnelThemeAccents> = {
  gradient: gradients.primary,
  text: "text-orange-400",
  ring: "ring-orange-500/30",
};

/** Merge caller accents over the brand defaults. */
export function resolveAccents(accents?: FunnelThemeAccents): Required<FunnelThemeAccents> {
  return { ...defaultAccents, ...accents };
}

/** Normalize a string | FunnelFeature into a FunnelFeature. */
export function toFeature(feature: string | FunnelFeature): Required<Pick<FunnelFeature, "label" | "included">> {
  return typeof feature === "string"
    ? { label: feature, included: true }
    : { label: feature.label, included: feature.included ?? true };
}
