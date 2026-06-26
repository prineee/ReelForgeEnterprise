/**
 * @file lib/offer-engine.ts
 * @description Provides helper functions to access and manage commercial offers.
 * This is the sole entry point for retrieving offer data throughout the application.
 */

import { OFFERS } from "@/config/offers";
import type { Offer, OfferId } from "@/types/offer";

/**
 * Retrieves a single offer by its unique ID.
 * @param id The ID of the offer to retrieve.
 * @returns The offer object or undefined if not found.
 */
export function getOfferById(id: OfferId): Offer | undefined {
  return OFFERS.find((offer) => offer.id === id);
}

/**
 * Retrieves a single offer by its URL slug.
 * @param slug The slug of the offer to retrieve.
 * @returns The offer object or undefined if not found.
 */
export function getOfferBySlug(slug: string): Offer | undefined {
  return OFFERS.find((offer) => offer.slug === slug);
}

/**
 * Gets the next offer in the sales funnel sequence.
 * @param currentOffer The current offer object.
 * @returns The next offer object or undefined if it's the last in the funnel.
 */
export function getNextOffer(currentOffer: Offer): Offer | undefined {
  if (!currentOffer.nextOffer) {
    return undefined;
  }
  return getOfferById(currentOffer.nextOffer);
}

/**
 * Gets all offers intended to be displayed on the main pricing page.
 * @returns An array of visible offer objects, sorted by priority.
 */
export function getVisibleOffers(): Offer[] {
  return OFFERS.filter((offer) => offer.visible && offer.active).sort(
    (a, b) => a.priority - b.priority
  );
}

/**
 * Gets the single recommended offer, typically for primary CTAs.
 * @returns The recommended offer object or undefined if none is set.
 */
export function getRecommendedOffer(): Offer | undefined {
  return OFFERS.find((offer) => offer.recommended && offer.active);
}