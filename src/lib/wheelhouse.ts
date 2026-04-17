/**
 * Wheelhouse Revenue Management API Client
 * Docs: https://api.usewheelhouse.com/wheelhouse_rm_api
 */

const WH_BASE = process.env.WHEELHOUSE_API_URL || 'https://api.usewheelhouse.com';
const WH_API_PATH = '/ss_api/v1';

function getApiKey(): string {
  const key = process.env.WHEELHOUSE_API_KEY;
  if (!key) throw new Error('Missing WHEELHOUSE_API_KEY environment variable');
  return key;
}

async function whFetch<T>(path: string, params?: Record<string, string>): Promise<T> {
  const url = new URL(`${WH_API_PATH}${path}`, WH_BASE);
  if (params) {
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  }

  const res = await fetch(url.toString(), {
    headers: {
      'X-Integration-Api-Key': getApiKey(),
      'Accept': 'application/json',
    },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Wheelhouse API ${res.status}: ${body}`);
  }

  return res.json();
}

// --- Listings (READ) ---

export interface WhListing {
  id: string;
  channel: string;
  wheelhouse_id: number;
  title: string;
  nickname: string;
  num_bedrooms: number;
  num_bathrooms: number;
  room_type: string;
  property_type: string;
  currency: string;
  star_rating: number;
  num_reviews: number;
  num_photos: number;
  thumb_url: string;
  channel_ids: Record<string, string>;
  in_market: boolean;
  market_id: number;
  is_active: boolean;
  listing_preferences?: Record<string, unknown>;
}

export async function getListings(opts?: { exclude_inactive?: boolean; include_managed?: boolean; page?: number; per_page?: number }): Promise<WhListing[]> {
  const params: Record<string, string> = {};
  if (opts?.exclude_inactive) params.exclude_inactive = 'true';
  if (opts?.include_managed) params.include_managed_listings = 'true';
  if (opts?.page) params.page = String(opts.page);
  if (opts?.per_page) params.per_page = String(opts.per_page);
  return whFetch<WhListing[]>('/listings', params);
}

export async function getListing(listingId: string, channel: string): Promise<WhListing> {
  return whFetch<WhListing>(`/listings/${listingId}`, { channel });
}

// --- KPIs (READ) ---

export interface WhKpis {
  adjusted_occupancy: number;
  occupancy: number;
  available_nights: number;
  average_asking_rate: number;
  average_nightly_rate: number;
  adjusted_nightly_revpar: number;
  nightly_revpar: number;
  last_booked_at: string;
  booked: number;
}

export async function getKpis(listingId: string, channel: string, days: number = 30): Promise<WhKpis> {
  return whFetch<WhKpis>(`/listings/${listingId}/kpis`, { channel, days: String(days) });
}

// --- Price Recommendations (READ) ---

export interface WhPriceRecommendation {
  stay_date: string;
  price: number;
  currency: string;
  min_stay: number;
  custom_type?: string;
  attr_seasonality?: number;
  attr_local_demand?: number;
  attr_availability?: number;
  attr_time?: number;
  attr_scarcity?: number;
  attr_occupancy_pacing?: number;
  attr_historical_anchoring?: number;
  attr_user_adjustment?: number;
}

export interface WhPriceRecommendationsResponse {
  data: WhPriceRecommendation[];
  base_price: number;
  base_price_recommended: number;
  base_price_conservative: number;
  base_price_aggressive: number;
  global_min_stay: number;
  automatic_rate_posting_enabled: boolean;
}

export async function getPriceRecommendations(listingId: string, channel: string, opts?: { attribution?: boolean; currency?: string }): Promise<WhPriceRecommendationsResponse> {
  const params: Record<string, string> = { channel };
  if (opts?.attribution) params.attribution = 'true';
  if (opts?.currency) params.currency = opts.currency;
  return whFetch<WhPriceRecommendationsResponse>(`/listings/${listingId}/price_recommendations`, params);
}

// --- Base Price Recommendation (READ) ---

export interface WhBasePriceRecommendation {
  base_price_recommended: number;
  base_price_conservative: number;
  base_price_aggressive: number;
  base_price_selected: number;
  anchor_credibility: number;
  anchor_price: number;
  base_price_attribution: {
    market_baseline: number;
    bedrooms_bathrooms: number;
    room_type: number;
    guests: number;
    location: number;
    amenities_fees: number;
    occupancy: number;
    observed_bookings: number;
  };
  currency: string;
}

export async function getBasePriceRecommendation(listingId: string, channel: string): Promise<WhBasePriceRecommendation> {
  return whFetch<WhBasePriceRecommendation>(`/listings/${listingId}/base_price_recommendation`, { channel });
}

// --- Flags (READ) ---

export async function getListingFlags(listingId: string, channel: string): Promise<string[]> {
  return whFetch<string[]>(`/listings/${listingId}/flags`, { channel });
}

// --- Reservations (READ) ---

export interface WhReservation {
  start_date: string;
  end_date: string;
  [key: string]: unknown;
}

export async function getReservations(listingId: string, channel: string, opts?: { start_date?: string; end_date?: string }): Promise<WhReservation[]> {
  const params: Record<string, string> = { channel };
  if (opts?.start_date) params.start_date = opts.start_date;
  if (opts?.end_date) params.end_date = opts.end_date;
  return whFetch<WhReservation[]>(`/listings/${listingId}/reservations`, params);
}

// --- Preferences (READ/WRITE) ---

export interface WhPreferences {
  listing_id: number;
  partner_listing_id: string;
  currency: string;
  automatic_rate_posting_enabled: boolean;
  base_price: number;
  base_price_adjustment: number;
  nickname: string;
  last_minute_discount?: Record<string, unknown>;
  far_future_premium?: Record<string, unknown>;
  seasonality_adjustment?: Record<string, unknown>;
  day_of_week?: Record<string, unknown>;
  gap_night?: Record<string, unknown>;
  min_min_price?: number;
  min_min_stay?: number;
  created_at: string;
  updated_at: string;
}

export async function getPreferences(listingId: string, channel: string): Promise<WhPreferences> {
  return whFetch<WhPreferences>(`/preferences/${listingId}`, { channel });
}

export async function updatePreferences(listingId: string, channel: string, updates: Partial<WhPreferences>): Promise<WhPreferences> {
  const url = new URL(`${WH_API_PATH}/preferences/${listingId}`, WH_BASE);
  url.searchParams.set('channel', channel);

  const res = await fetch(url.toString(), {
    method: 'PUT',
    headers: {
      'X-Integration-Api-Key': getApiKey(),
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify(updates),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Wheelhouse API PUT ${res.status}: ${body}`);
  }

  return res.json();
}

// --- Custom Rates (WRITE) ---

export async function setCustomRate(listingId: string, channel: string, date: string, rate: Record<string, unknown>): Promise<void> {
  const url = new URL(`${WH_API_PATH}/listings/${listingId}/custom_rates/${date}`, WH_BASE);
  url.searchParams.set('channel', channel);

  const res = await fetch(url.toString(), {
    method: 'PUT',
    headers: {
      'X-Integration-Api-Key': getApiKey(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(rate),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Wheelhouse API PUT custom_rate ${res.status}: ${body}`);
  }
}

export async function bulkSetCustomRates(listingId: string, channel: string, rates: Record<string, unknown>[]): Promise<void> {
  const url = new URL(`${WH_API_PATH}/listings/${listingId}/custom_rates/bulk`, WH_BASE);
  url.searchParams.set('channel', channel);

  const res = await fetch(url.toString(), {
    method: 'PUT',
    headers: {
      'X-Integration-Api-Key': getApiKey(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(rates),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Wheelhouse API bulk custom_rates ${res.status}: ${body}`);
  }
}

// --- Monthly Seasonality (READ) ---

export interface WhSeasonality {
  CON: Record<string, number>;
  REC: Record<string, number>;
  AGG: Record<string, number>;
}

export async function getMonthlySeasonality(listingId: string, channel: string): Promise<WhSeasonality> {
  return whFetch<WhSeasonality>(`/listings/${listingId}/monthly_seasonality`, { channel });
}

// --- Recent Changes (READ) ---

export interface WhRecentChanges {
  settings: string;
  rates: string;
}

export async function getRecentChanges(listingId: string, channel: string): Promise<WhRecentChanges> {
  return whFetch<WhRecentChanges>(`/listings/${listingId}/recent_changes`, { channel });
}

// --- Preferences Changelog (READ) ---

export async function getPreferencesChangelog(listingId: string, channel: string): Promise<unknown[]> {
  return whFetch<unknown[]>(`/preferences/${listingId}/changelog`, { channel });
}
