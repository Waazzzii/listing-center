// agents/scorecard-generator/scorecard-builder.ts
// Assembles monthly scorecard data from multiple sources into a structured JSON payload.

// ---- Input Types ----

export interface ScorecardInput {
  property_id: string;
  property_name: string;
  market: string;
  quality_tier: string;
  report_month: string; // YYYY-MM-DD (first of month)
  latest_snapshot: Record<string, any>;
  prior_month_snapshot: Record<string, any> | null;
  reviews: Array<{
    guest_name: string;
    rating: number;
    review_date: string;
    sentiment: string;
  }>;
  changes_made: Array<{
    change_type: string;
    change_date: string;
    thesis: string;
    execution_status: string;
  }>;
  active_recommendations: Array<{
    title: string;
    severity: string;
    funnel_stage: string;
  }>;
  benchmark: {
    impression_rate_low: number;
    impression_rate_high: number;
    ctr_low: number;
    ctr_high: number;
    conversion_low: number;
    conversion_high: number;
  };
}

// ---- Output Types ----

export interface MetricWithChange {
  current: number;
  prior_month: number | null;
  change: number | null; // Absolute change (current - prior)
}

export interface ListingHealth {
  health_status: string;
  impression_rate: MetricWithChange;
  ctr: MetricWithChange;
  conversion: MetricWithChange;
  occupancy: MetricWithChange;
  adr: MetricWithChange;
  nights_booked: MetricWithChange;
  overall_rating: number;
  page_views: MetricWithChange;
  wishlist_additions: MetricWithChange;
}

export interface ReviewSection {
  total_this_month: number;
  avg_rating_this_month: number;
  positive_count: number;
  neutral_count: number;
  negative_count: number;
  highlights: Array<{
    guest_name: string;
    rating: number;
    sentiment: string;
  }>;
}

export interface OptimizationSection {
  changes_made: Array<{
    change_type: string;
    change_date: string;
    thesis: string;
    status: string;
  }>;
  total_changes: number;
}

export type BenchmarkPosition = 'below' | 'in_range' | 'above';

export interface CompetitiveContext {
  vs_benchmark: {
    impression_rate: BenchmarkPosition;
    ctr: BenchmarkPosition;
    conversion: BenchmarkPosition;
  };
  tier_label: string;
  market_label: string;
}

export interface UpcomingAction {
  title: string;
  severity: string;
  funnel_stage: string;
}

export interface ScorecardMetadata {
  property_name: string;
  report_month: string;
  market: string;
  quality_tier: string;
  generated_at: string;
}

export interface ScorecardData {
  metadata: ScorecardMetadata;
  listing_health: ListingHealth;
  reviews: ReviewSection;
  optimizations: OptimizationSection;
  competitive_context: CompetitiveContext;
  upcoming_actions: UpcomingAction[];
}

// ---- Helpers ----

function metricChange(
  current: number | null,
  prior: number | null
): MetricWithChange {
  return {
    current: current ?? 0,
    prior_month: prior ?? null,
    change:
      current != null && prior != null
        ? Math.round((current - prior) * 100) / 100
        : null,
  };
}

function classifyVsBenchmark(
  value: number | null,
  low: number,
  high: number
): BenchmarkPosition {
  if (value == null) return 'in_range';
  if (value < low) return 'below';
  if (value > high) return 'above';
  return 'in_range';
}

// ---- Builder ----

/**
 * Build the complete scorecard JSON for a single property and month.
 *
 * Assembles data from:
 *  - lc_metric_snapshots (latest + prior month)
 *  - lc_reviews (monthly summary)
 *  - lc_change_log (optimizations made)
 *  - lc_recommendations (pending actions)
 *  - lc_benchmarks (tier positioning)
 */
export function buildScorecardData(input: ScorecardInput): ScorecardData {
  const snap = input.latest_snapshot;
  const prior = input.prior_month_snapshot;

  // ===== Listing Health =====
  const listing_health: ListingHealth = {
    health_status: snap.health_status || 'unknown',
    impression_rate: metricChange(
      snap.airbnb_first_page_impression_rate,
      prior?.airbnb_first_page_impression_rate ?? null
    ),
    ctr: metricChange(
      snap.airbnb_search_to_listing_ctr,
      prior?.airbnb_search_to_listing_ctr ?? null
    ),
    conversion: metricChange(
      snap.airbnb_listing_to_booking_conversion,
      prior?.airbnb_listing_to_booking_conversion ?? null
    ),
    occupancy: metricChange(
      snap.airbnb_occupancy_rate,
      prior?.airbnb_occupancy_rate ?? null
    ),
    adr: metricChange(
      snap.airbnb_avg_nightly_rate,
      prior?.airbnb_avg_nightly_rate ?? null
    ),
    nights_booked: metricChange(
      snap.airbnb_nights_booked,
      prior?.airbnb_nights_booked ?? null
    ),
    overall_rating: snap.airbnb_overall_rating ?? 0,
    page_views: metricChange(
      snap.airbnb_page_views,
      prior?.airbnb_page_views ?? null
    ),
    wishlist_additions: metricChange(
      snap.airbnb_wishlist_additions,
      prior?.airbnb_wishlist_additions ?? null
    ),
  };

  // ===== Reviews =====
  const positiveReviews = input.reviews.filter(
    (r) => r.sentiment === 'positive'
  );
  const negativeReviews = input.reviews.filter(
    (r) => r.sentiment === 'negative'
  );
  const neutralReviews = input.reviews.filter(
    (r) => r.sentiment === 'neutral'
  );
  const avgRating =
    input.reviews.length > 0
      ? input.reviews.reduce((sum, r) => sum + r.rating, 0) /
        input.reviews.length
      : 0;

  const reviews: ReviewSection = {
    total_this_month: input.reviews.length,
    avg_rating_this_month: Math.round(avgRating * 100) / 100,
    positive_count: positiveReviews.length,
    neutral_count: neutralReviews.length,
    negative_count: negativeReviews.length,
    highlights: input.reviews.slice(0, 5).map((r) => ({
      guest_name: r.guest_name,
      rating: r.rating,
      sentiment: r.sentiment,
    })),
  };

  // ===== Optimizations =====
  const optimizations: OptimizationSection = {
    changes_made: input.changes_made.map((c) => ({
      change_type: c.change_type,
      change_date: c.change_date,
      thesis: c.thesis,
      status: c.execution_status,
    })),
    total_changes: input.changes_made.length,
  };

  // ===== Competitive Context =====
  const bm = input.benchmark;
  const competitive_context: CompetitiveContext = {
    vs_benchmark: {
      impression_rate: classifyVsBenchmark(
        snap.airbnb_first_page_impression_rate,
        bm.impression_rate_low,
        bm.impression_rate_high
      ),
      ctr: classifyVsBenchmark(
        snap.airbnb_search_to_listing_ctr,
        bm.ctr_low,
        bm.ctr_high
      ),
      conversion: classifyVsBenchmark(
        snap.airbnb_listing_to_booking_conversion,
        bm.conversion_low,
        bm.conversion_high
      ),
    },
    tier_label: `${input.quality_tier.charAt(0).toUpperCase() + input.quality_tier.slice(1)} Tier`,
    market_label: input.market
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase()),
  };

  // ===== Upcoming Actions =====
  const upcoming_actions: UpcomingAction[] = input.active_recommendations.map(
    (r) => ({
      title: r.title,
      severity: r.severity,
      funnel_stage: r.funnel_stage,
    })
  );

  // ===== Metadata =====
  const metadata: ScorecardMetadata = {
    property_name: input.property_name,
    report_month: input.report_month,
    market: input.market,
    quality_tier: input.quality_tier,
    generated_at: new Date().toISOString(),
  };

  return {
    metadata,
    listing_health,
    reviews,
    optimizations,
    competitive_context,
    upcoming_actions,
  };
}
