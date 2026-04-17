import { z } from 'zod';

const MARKETS = ['scottsdale', 'tucson', 'sedona', 'coachella', 'central_coast', 'orange_county', 'lake_arrowhead'] as const;
const QUALITY_TIERS = ['standard', 'silver', 'gold', 'platinum', 'diamond'] as const;

const pctOrNull = z.number().min(0).max(100).nullable().optional();
const positiveIntOrNull = z.number().int().min(0).nullable().optional();
const ratingOrNull = z.number().min(0).max(5).nullable().optional();

const metricSnapshotSchema = z.object({
  airbnb_first_page_impression_rate: pctOrNull,
  airbnb_search_to_listing_ctr: pctOrNull,
  airbnb_listing_to_booking_conversion: pctOrNull,
  airbnb_overall_conversion_rate: pctOrNull,
  airbnb_page_views: positiveIntOrNull,
  airbnb_first_page_impressions: positiveIntOrNull,
  airbnb_wishlist_additions: positiveIntOrNull,
  airbnb_overall_rating: ratingOrNull,
  airbnb_occupancy_rate: pctOrNull,
  airbnb_cancellation_rate: pctOrNull,
  airbnb_avg_nightly_rate: z.number().min(0).nullable().optional(),
  airbnb_review_count: positiveIntOrNull,
}).passthrough();

const propertyInputSchema = z.object({
  streamline_unit_id: z.string().min(1),
  property_name: z.string().min(1),
  market: z.enum(MARKETS),
  quality_tier: z.enum(QUALITY_TIERS),
  airbnb_listing_id: z.string().nullable().optional(),
  airbnb_account_id: z.number().int().nullable().optional(),
  bedrooms: z.number().int().min(0).nullable().optional(),
  bathrooms: z.number().min(0).nullable().optional(),
  max_occupancy: z.number().int().min(0).nullable().optional(),
  property_type: z.string().nullable().optional(),
});

export function validateMetricSnapshot(data: unknown) {
  return metricSnapshotSchema.safeParse(data);
}

export function validatePropertyInput(data: unknown) {
  return propertyInputSchema.safeParse(data);
}

export { MARKETS, QUALITY_TIERS };
