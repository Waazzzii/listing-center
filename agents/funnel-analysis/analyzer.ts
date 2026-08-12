import type { ResolvedBenchmark } from './benchmark-lookup';

// ---- Types ----

export type FunnelStage = 'top' | 'mid' | 'bottom';
export type IssueSeverity = 'critical' | 'high' | 'medium' | 'low';
export type OpportunityType = 'value_capture';
export type RouteTarget = 'pricing_policy' | 'content_optimizer';

export interface FunnelIssue {
  stage: FunnelStage;
  severity: IssueSeverity;
  diagnosis: string;
  likely_causes: string[];
  route_to: RouteTarget;
}

export interface FunnelOpportunity {
  stage: FunnelStage;
  type: OpportunityType;
  diagnosis: string;
  route_to: RouteTarget;
}

export interface FunnelDiagnosis {
  skipped: boolean;
  skipped_reason?: string;
  health_status: string;
  issues: FunnelIssue[];
  opportunities: FunnelOpportunity[];
  funnel_bottleneck: FunnelStage | 'none';
  priority_score?: number;
}

export interface SnapshotForAnalysis {
  id: string;
  property_id: string;
  snapshot_date: string;
  snapshot_source: string;
  scrape_completeness: 'complete' | 'partial' | 'failed';
  pages_scraped: number;
  airbnb_first_page_impression_rate: number | null;
  airbnb_search_to_listing_ctr: number | null;
  airbnb_listing_to_booking_conversion: number | null;
  airbnb_page_views: number | null;
  airbnb_wishlist_additions: number | null;
  airbnb_overall_rating: number | null;
  airbnb_avg_nightly_rate: number | null;
  airbnb_occupancy_rate: number | null;
  airbnb_nights_booked: number | null;
  health_status: string;
  previous_health_status: string | null;
  [key: string]: any;
}

// ---- Core Analysis Function ----

export function analyzeProperty(
  snapshot: SnapshotForAnalysis,
  benchmark: ResolvedBenchmark
): FunnelDiagnosis {
  // Gate: skip anything that isn't a complete scrape
  if (snapshot.scrape_completeness !== 'complete') {
    return {
      skipped: true,
      skipped_reason: 'partial_data',
      health_status: 'unknown',
      issues: [],
      opportunities: [],
      funnel_bottleneck: 'none',
    };
  }

  const issues: FunnelIssue[] = [];
  const opportunities: FunnelOpportunity[] = [];

  // ===== TOP OF FUNNEL — Algorithm Health (Impression Rate) =====
  const impressionRate = snapshot.airbnb_first_page_impression_rate;
  if (impressionRate != null) {
    if (impressionRate < benchmark.impression_rate_low) {
      issues.push({
        stage: 'top',
        severity: impressionRate < benchmark.impression_rate_critical ? 'critical' : 'high',
        diagnosis: 'Under-represented in Airbnb search — algorithm is suppressing this listing',
        likely_causes: [
          'Price too high vs value index',
          'Strict cancellation policy multiplier',
          'Low trust score (reviews, response rate)',
          'Missing Guest Favorites badge',
        ],
        route_to: 'pricing_policy',
      });
    } else if (impressionRate > benchmark.impression_rate_high) {
      opportunities.push({
        stage: 'top',
        type: 'value_capture',
        diagnosis: 'Over-represented in search — algorithm loves this listing, leaving money on the table',
        route_to: 'pricing_policy',
      });
    }
  }

  // ===== MID FUNNEL — Hero Photo & Title (CTR) =====
  const ctr = snapshot.airbnb_search_to_listing_ctr;
  if (ctr != null) {
    if (ctr < benchmark.ctr_low) {
      issues.push({
        stage: 'mid',
        severity: ctr < benchmark.ctr_critical ? 'critical' : 'high',
        diagnosis: 'Hero photo or title not converting impressions to clicks',
        likely_causes: [
          'Hero photo crops poorly to thumbnail',
          'Photo doesn\'t establish the space (too zoomed in, dark, unclear)',
          'Title not compelling or differentiated',
          'Price shown in search results looks too high for the photo quality',
        ],
        route_to: 'content_optimizer',
      });
    }
    // No explicit high-CTR opportunity — high CTR with low conversion is a different issue
  }

  // ===== BOTTOM OF FUNNEL — Listing Page Quality (Conversion) =====
  const conversion = snapshot.airbnb_listing_to_booking_conversion;
  if (conversion != null) {
    if (conversion < benchmark.conversion_low) {
      issues.push({
        stage: 'bottom',
        severity: conversion < benchmark.conversion_critical ? 'critical' : 'high',
        diagnosis: 'Visitors are clicking in but not booking — listing page is losing them',
        likely_causes: [
          'Missing amenity photos (coffee station, blackout curtains, workspace)',
          'Description gaps — "1 out of 100" rule failures',
          'Early checkout time costing bookings',
          'Strict cancellation policy at bottom of funnel',
          'Price vs perceived value mismatch once they see the full listing',
        ],
        route_to: 'content_optimizer',
      });
    } else if (conversion > benchmark.conversion_high) {
      opportunities.push({
        stage: 'bottom',
        type: 'value_capture',
        diagnosis: 'Converting at premium rate — this listing is under-priced for its demand',
        route_to: 'pricing_policy',
      });
    }
  }

  // ===== Determine Funnel Bottleneck =====
  // Priority: top > mid > bottom (fix visibility before fixing content)
  let funnel_bottleneck: FunnelStage | 'none' = 'none';
  if (issues.some(i => i.stage === 'top')) {
    funnel_bottleneck = 'top';
  } else if (issues.some(i => i.stage === 'mid')) {
    funnel_bottleneck = 'mid';
  } else if (issues.some(i => i.stage === 'bottom')) {
    funnel_bottleneck = 'bottom';
  }

  // Health status is determined by the health-classifier (Task 2),
  // but we compute a preliminary one here for the diagnosis return
  let health_status = 'green';
  if (issues.some(i => i.severity === 'critical')) {
    health_status = 'red';
  } else if (issues.some(i => i.severity === 'high')) {
    health_status = 'orange';
  } else if (opportunities.some(o => o.type === 'value_capture')) {
    health_status = 'yellow';
  }

  return {
    skipped: false,
    health_status,
    issues,
    opportunities,
    funnel_bottleneck,
  };
}
