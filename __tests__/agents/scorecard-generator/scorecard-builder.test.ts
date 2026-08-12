import { describe, it, expect } from 'vitest';
import {
  buildScorecardData,
  type ScorecardData,
  type ScorecardInput,
} from '../../../agents/scorecard-generator/scorecard-builder';

function makeInput(overrides: Partial<ScorecardInput> = {}): ScorecardInput {
  return {
    property_id: 'prop-1',
    property_name: 'Desert Oasis Villa',
    market: 'scottsdale',
    quality_tier: 'gold',
    report_month: '2026-03-01',
    latest_snapshot: {
      health_status: 'green',
      airbnb_first_page_impression_rate: 58.0,
      airbnb_search_to_listing_ctr: 18.5,
      airbnb_listing_to_booking_conversion: 3.2,
      airbnb_page_views: 450,
      airbnb_wishlist_additions: 22,
      airbnb_overall_rating: 4.89,
      airbnb_occupancy_rate: 72.0,
      airbnb_avg_nightly_rate: 385.0,
      airbnb_nights_booked: 22,
    },
    prior_month_snapshot: {
      health_status: 'yellow',
      airbnb_first_page_impression_rate: 62.0,
      airbnb_search_to_listing_ctr: 15.0,
      airbnb_listing_to_booking_conversion: 2.8,
      airbnb_page_views: 380,
      airbnb_wishlist_additions: 18,
      airbnb_overall_rating: 4.85,
      airbnb_occupancy_rate: 65.0,
      airbnb_avg_nightly_rate: 370.0,
      airbnb_nights_booked: 18,
    },
    reviews: [
      {
        guest_name: 'John D.',
        rating: 5,
        review_date: '2026-03-10',
        sentiment: 'positive',
      },
      {
        guest_name: 'Sarah M.',
        rating: 4,
        review_date: '2026-03-18',
        sentiment: 'positive',
      },
    ],
    changes_made: [
      {
        change_type: 'hero_photo',
        change_date: '2026-03-05',
        thesis: 'Aerial pool shot for CTR',
        execution_status: 'completed',
      },
    ],
    active_recommendations: [
      {
        title: 'Update description — amenity gaps',
        severity: 'medium',
        funnel_stage: 'bottom',
      },
    ],
    benchmark: {
      impression_rate_low: 50.0,
      impression_rate_high: 65.0,
      ctr_low: 10.0,
      ctr_high: 25.0,
      conversion_low: 2.0,
      conversion_high: 5.0,
    },
    ...overrides,
  };
}

describe('buildScorecardData', () => {
  it('returns a ScorecardData object with all five sections', () => {
    const result = buildScorecardData(makeInput());
    expect(result.listing_health).toBeDefined();
    expect(result.reviews).toBeDefined();
    expect(result.optimizations).toBeDefined();
    expect(result.competitive_context).toBeDefined();
    expect(result.upcoming_actions).toBeDefined();
  });

  it('populates listing_health with current metrics and MoM changes', () => {
    const result = buildScorecardData(makeInput());
    const lh = result.listing_health;
    expect(lh.health_status).toBe('green');
    expect(lh.impression_rate.current).toBe(58.0);
    expect(lh.impression_rate.prior_month).toBe(62.0);
    expect(lh.impression_rate.change).toBeCloseTo(-4.0, 1);
    expect(lh.ctr.current).toBe(18.5);
    expect(lh.ctr.change).toBeCloseTo(3.5, 1);
  });

  it('calculates occupancy and revenue metrics', () => {
    const result = buildScorecardData(makeInput());
    const lh = result.listing_health;
    expect(lh.occupancy.current).toBe(72.0);
    expect(lh.adr.current).toBe(385.0);
    expect(lh.nights_booked.current).toBe(22);
  });

  it('populates review section with count, average, and sentiment', () => {
    const result = buildScorecardData(makeInput());
    expect(result.reviews.total_this_month).toBe(2);
    expect(result.reviews.avg_rating_this_month).toBeCloseTo(4.5, 1);
    expect(result.reviews.positive_count).toBe(2);
    expect(result.reviews.negative_count).toBe(0);
  });

  it('populates optimizations section with changes made', () => {
    const result = buildScorecardData(makeInput());
    expect(result.optimizations.changes_made).toHaveLength(1);
    expect(result.optimizations.changes_made[0].change_type).toBe(
      'hero_photo'
    );
  });

  it('populates upcoming_actions from active recommendations', () => {
    const result = buildScorecardData(makeInput());
    expect(result.upcoming_actions).toHaveLength(1);
    expect(result.upcoming_actions[0].title).toContain('description');
  });

  it('includes benchmark comparison in competitive_context', () => {
    const result = buildScorecardData(makeInput());
    expect(result.competitive_context.vs_benchmark).toBeDefined();
    expect(result.competitive_context.vs_benchmark.impression_rate).toBe(
      'in_range'
    );
    expect(result.competitive_context.vs_benchmark.ctr).toBe('in_range');
    expect(result.competitive_context.vs_benchmark.conversion).toBe(
      'in_range'
    );
  });

  it('marks metric as below_benchmark when under low threshold', () => {
    const input = makeInput({
      latest_snapshot: {
        ...makeInput().latest_snapshot,
        airbnb_search_to_listing_ctr: 7.0, // Below 10.0 low threshold
      },
    });
    const result = buildScorecardData(input);
    expect(result.competitive_context.vs_benchmark.ctr).toBe('below');
  });

  it('marks metric as above_benchmark when over high threshold', () => {
    const input = makeInput({
      latest_snapshot: {
        ...makeInput().latest_snapshot,
        airbnb_first_page_impression_rate: 70.0, // Above 65.0 high threshold
      },
    });
    const result = buildScorecardData(input);
    expect(result.competitive_context.vs_benchmark.impression_rate).toBe(
      'above'
    );
  });

  it('handles zero reviews gracefully', () => {
    const input = makeInput({ reviews: [] });
    const result = buildScorecardData(input);
    expect(result.reviews.total_this_month).toBe(0);
    expect(result.reviews.avg_rating_this_month).toBe(0);
  });

  it('handles missing prior month snapshot', () => {
    const input = makeInput({
      prior_month_snapshot: null as any,
    });
    const result = buildScorecardData(input);
    expect(result.listing_health.impression_rate.change).toBeNull();
    expect(result.listing_health.ctr.change).toBeNull();
  });

  it('includes metadata (property name, month, generated date)', () => {
    const result = buildScorecardData(makeInput());
    expect(result.metadata.property_name).toBe('Desert Oasis Villa');
    expect(result.metadata.report_month).toBe('2026-03-01');
    expect(result.metadata.market).toBe('scottsdale');
    expect(result.metadata.quality_tier).toBe('gold');
    expect(result.metadata.generated_at).toBeTruthy();
  });
});
