// agents/ab-test-tracker/snapshot-manager.ts
// Before/after metric snapshot capture for A/B tests.
// Implements Sean's future-date snapshot method for CTR tests.

export interface TestMetrics {
  ctr: number | null;
  impression_rate: number | null;
  conversion: number | null;
  wishlist_additions: number | null;
  page_views: number | null;
  snapshot_date: string;
}

export interface TestResult {
  result: 'positive' | 'negative' | 'no_change';
  metric_lift: number;
  result_summary: string;
  decision: 'keep' | 'revert' | 'iterate';
}

// Soak periods by test type (from validated spec)
const SOAK_PERIODS: Record<string, number> = {
  hero_photo: 14,            // CTR test — 14 days
  title: 14,                 // CTR test — 14 days
  description: 28,           // Conversion test — needs longer
  cancellation_policy: 28,   // Impression rate — algorithm needs time
  amenities: 14,             // Conversion — moderate
  pricing: 28,               // Conversion + impression — complex
  checkout_time: 28,         // Conversion — behavioral change
};

const DEFAULT_SOAK_PERIOD = 21;
const NOISE_THRESHOLD_PCT = 5; // Below 5% lift = no meaningful change

/**
 * Get the soak period in days for a given test type.
 */
export function getSoakPeriodDays(testType: string): number {
  return SOAK_PERIODS[testType] ?? DEFAULT_SOAK_PERIOD;
}

/**
 * Calculate the date when the after snapshot should be taken.
 */
export function getAfterSnapshotDueDate(changeExecutedDate: Date, soakDays: number): Date {
  const dueDate = new Date(changeExecutedDate);
  dueDate.setDate(dueDate.getDate() + soakDays);
  return dueDate;
}

/**
 * Capture a "before" snapshot from a lc_metric_snapshots row.
 * Extracts the key metrics used for A/B test comparison.
 */
export function captureBeforeSnapshot(snapshotRow: Record<string, unknown>): TestMetrics {
  return {
    ctr: (snapshotRow.airbnb_search_to_listing_ctr as number) ?? null,
    impression_rate: (snapshotRow.airbnb_first_page_impression_rate as number) ?? null,
    conversion: (snapshotRow.airbnb_listing_to_booking_conversion as number) ?? null,
    wishlist_additions: (snapshotRow.airbnb_wishlist_additions as number) ?? null,
    page_views: (snapshotRow.airbnb_page_views as number) ?? null,
    snapshot_date: snapshotRow.snapshot_date as string,
  };
}

/**
 * Capture an "after" snapshot (same extraction, used after soak period).
 */
export function captureAfterSnapshot(snapshotRow: Record<string, unknown>): TestMetrics {
  return captureBeforeSnapshot(snapshotRow); // Same structure
}

/**
 * Calculate A/B test result by comparing before and after metrics.
 *
 * Formula: metric_lift = ((after - before) / before) * 100
 *
 * Result classification:
 * - positive: target metric improved by > 5% (noise threshold)
 * - negative: target metric declined by > 5%
 * - no_change: target metric within +/- 5% noise band
 */
export function calculateResult(
  before: TestMetrics,
  after: TestMetrics,
  targetMetric: string
): TestResult {
  const beforeValue = (before as unknown as Record<string, unknown>)[targetMetric] as number | null;
  const afterValue = (after as unknown as Record<string, unknown>)[targetMetric] as number | null;

  // Handle missing data
  if (afterValue == null || afterValue === undefined) {
    return {
      result: 'no_change',
      metric_lift: 0,
      result_summary: `${targetMetric}: insufficient data in after snapshot`,
      decision: 'iterate',
    };
  }

  if (beforeValue == null || beforeValue === undefined) {
    return {
      result: afterValue > 0 ? 'positive' : 'no_change',
      metric_lift: afterValue,
      result_summary: `${targetMetric}: no before data, after = ${afterValue}`,
      decision: 'keep',
    };
  }

  // Calculate lift
  let metricLift: number;
  if (beforeValue === 0) {
    // Avoid division by zero; report absolute change
    metricLift = afterValue > 0 ? 100 : 0;
  } else {
    metricLift = ((afterValue - beforeValue) / beforeValue) * 100;
  }

  metricLift = Math.round(metricLift * 1000) / 1000;

  // Classify result
  let result: 'positive' | 'negative' | 'no_change';
  let decision: 'keep' | 'revert' | 'iterate';

  if (metricLift > NOISE_THRESHOLD_PCT) {
    result = 'positive';
    decision = 'keep';
  } else if (metricLift < -NOISE_THRESHOLD_PCT) {
    result = 'negative';
    decision = 'revert';
  } else {
    result = 'no_change';
    decision = 'iterate';
  }

  const metricLabel = targetMetric.replace(/_/g, ' ');
  const liftStr = metricLift > 0 ? `+${metricLift.toFixed(1)}` : metricLift.toFixed(1);
  const resultSummary = `${metricLabel} changed from ${beforeValue} to ${afterValue} (${liftStr}%)`;

  return { result, metric_lift: metricLift, result_summary: resultSummary, decision };
}
