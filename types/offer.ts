export type OfferId = string;

export interface Offer {
  id: OfferId;
  slug: string;
  name: string;
  title?: string;

  description?: string;
  headline?: string;

  price: number;
  originalPrice?: number;

  currency?: string;
  billingType?: string;

  ctaText?: string;
  ctaHref?: string;
  purchaseUrl?: string;

  badge?: string;
  recommended?: boolean;

  features?: string[];

  nextOffer?: OfferId;
  previousOffer?: OfferId;

  visible: boolean;
  active: boolean;
  priority: number;

  [key: string]: unknown;
}