import { describe, it, expect } from 'vitest';
import { analyzeProperty, type FunnelDiagnosis, type FunnelIssue, type FunnelOpportunity } from '../../../agents/funnel-analysis/analyzer';
import type { ResolvedBenchmark } from '../../../agents/funnel-analysis/benchmark-lookup';

// Shared benchmark fixture matching gold tier defaults from seed data
const goldBenchmark: ResolvedBenchmark = {
  quality_tier: 'gold',
  market: null,
  season: null,
  impression_rate_low: 50.0,
  impression_rate_high: 65.0,
  ctr_low: 10.0,
  ctr_high: 25.0,
  conversion_low: 2.0,
  conversion_high: 5.0,
  impression_rate_critical: 50.0,
  ctr_critical: 10.0,
  conversion_critical: 2.0,
};

function makeSnapshot(overrides: Record<string, any> = {}) {
  return {
    id: 'snap-1',
    property_id: 'prop-1',
    snapshot_date: '2026-04-06',
    snapshot_source: 'weekly_full_scan',
    scrape_completeness: 'complete' as const,
    pages_scraped: 8,
    airbnb_first_page_impression_rate: 55.0,
    airbnb_search_to_listing_ctr: 18.0,
    airbnb_listing_to_booking_conversion: 3.5,
    airbnb_page_views: 120,
    airbnb_wishlist_additions: 8,
    airbnb_overall_rating: 4.85,
    airbnb_avg_nightly_rate: 350.0,
    airbnb_occupancy_rate: 72.0,
    airbnb_nights_booked: 20,
    health_status: 'unknown',
    previous_health_status: null,
    ...overrides,
  };
}

describe('analyzeProperty', () => {
  it('returns skip result for partial scrape data', () => {
    const snapshot = makeSnapshot({ scrape_completeness: 'partial' });
    const result = analyzeProperty(snapshot, goldBenchmark);
    expect(result.skipped).toBe(true);
    expect(result.skipped_reason).toBe('partial_data');
    expect(result.health_status).toBe('unknown');
  });

  it('returns skip result for failed scrape data', () => {
    const snapshot = makeSnapshot({ scrape_completeness: 'failed' });
    const result = analyzeProperty(snapshot, goldBenchmark);
    expect(result.skipped).toBe(true);
    expect(result.skipped_reason).toBe('partial_data');
  });

  it('diagnoses healthy property with all metrics in range as green', () => {
    const snapshot = makeSnapshot();
    const result = analyzeProperty(snapshot, goldBenchmark);
    expect(result.skipped).toBe(false);
    expect(result.issues).toHaveLength(0);
    expect(result.health_status).toBe('green');
    expect(result.funnel_bottleneck).toBe('none');
  });

  it('diagnoses low impression rate as top-of-funnel issue routed to pricing_policy', () => {
    const snapshot = makeSnapshot({ airbnb_first_page_impression_rate: 38.0 });
    const result = analyzeProperty(snapshot, goldBenchmark);
    expect(result.issues.length).toBeGreaterThanOrEqual(1);
    const topIssue = result.issues.find(i => i.stage === 'top');
    expect(topIssue).toBeDefined();
    expect(topIssue!.severity).toBe('critical');
    expect(topIssue!.route_to).toBe('pricing_policy');
    expect(result.funnel_bottleneck).toBe('top');
  });

  it('diagnoses impression rate below low but above critical as high severity', () => {
    // For gold tier: impression_rate_low = 50, critical = 50 — they're the same in seed data
    // Use a custom benchmark where critical < low to test the distinction
    const customBench: ResolvedBenchmark = {
      ...goldBenchmark,
      impression_rate_low: 50.0,
      impression_rate_critical: 35.0,
    };
    const snapshot = makeSnapshot({ airbnb_first_page_impression_rate: 42.0 });
    const result = analyzeProperty(snapshot, customBench);
    const topIssue = result.issues.find(i => i.stage === 'top');
    expect(topIssue).toBeDefined();
    expect(topIssue!.severity).toBe('high');
  });

  it('diagnoses high impression rate as value capture opportunity', () => {
    const snapshot = makeSnapshot({ airbnb_first_page_impression_rate: 72.0 });
    const result = analyzeProperty(snapshot, goldBenchmark);
    expect(result.opportunities.length).toBeGreaterThanOrEqual(1);
    const topOpp = result.opportunities.find(o => o.stage === 'top');
    expect(topOpp).toBeDefined();
    expect(topOpp!.type).toBe('value_capture');
    expect(topOpp!.route_to).toBe('pricing_policy');
  });

  it('diagnoses low CTR as mid-funnel issue routed to content_optimizer', () => {
    const snapshot = makeSnapshot({ airbnb_search_to_listing_ctr: 5.0 });
    const result = analyzeProperty(snapshot, goldBenchmark);
    const midIssue = result.issues.find(i => i.stage === 'mid');
    expect(midIssue).toBeDefined();
    expect(midIssue!.route_to).toBe('content_optimizer');
    expect(result.funnel_bottleneck).toBe('mid');
  });

  it('diagnoses low conversion as bottom-of-funnel issue routed to content_optimizer', () => {
    const snapshot = makeSnapshot({ airbnb_listing_to_booking_conversion: 0.8 });
    const result = analyzeProperty(snapshot, goldBenchmark);
    const bottomIssue = result.issues.find(i => i.stage === 'bottom');
    expect(bottomIssue).toBeDefined();
    expect(bottomIssue!.route_to).toBe('content_optimizer');
    expect(result.funnel_bottleneck).toBe('bottom');
  });

  it('diagnoses high conversion as bottom-of-funnel value capture opportunity', () => {
    const snapshot = makeSnapshot({ airbnb_listing_to_booking_conversion: 6.5 });
    const result = analyzeProperty(snapshot, goldBenchmark);
    const bottomOpp = result.opportunities.find(o => o.stage === 'bottom');
    expect(bottomOpp).toBeDefined();
    expect(bottomOpp!.type).toBe('value_capture');
    expect(bottomOpp!.route_to).toBe('pricing_policy');
  });

  it('identifies top-of-funnel as bottleneck when both top and mid have issues', () => {
    const snapshot = makeSnapshot({
      airbnb_first_page_impression_rate: 30.0,
      airbnb_search_to_listing_ctr: 5.0,
    });
    const result = analyzeProperty(snapshot, goldBenchmark);
    // Top of funnel is the bottleneck — fix algorithm visibility first
    expect(result.funnel_bottleneck).toBe('top');
  });

  it('handles null metric values gracefully by skipping that funnel stage', () => {
    const snapshot = makeSnapshot({
      airbnb_first_page_impression_rate: null,
      airbnb_search_to_listing_ctr: 18.0,
      airbnb_listing_to_booking_conversion: 3.5,
    });
    const result = analyzeProperty(snapshot, goldBenchmark);
    // Should not crash; just skip the null stage
    expect(result.issues.every(i => i.stage !== 'top')).toBe(true);
  });

  it('returns multiple issues when multiple funnel stages are broken', () => {
    const snapshot = makeSnapshot({
      airbnb_first_page_impression_rate: 30.0,
      airbnb_search_to_listing_ctr: 4.0,
      airbnb_listing_to_booking_conversion: 0.5,
    });
    const result = analyzeProperty(snapshot, goldBenchmark);
    expect(result.issues.length).toBe(3);
    expect(result.issues.map(i => i.stage).sort()).toEqual(['bottom', 'mid', 'top']);
  });
});
