import { describe, it, expect } from 'vitest';
import {
  captureBeforeSnapshot,
  captureAfterSnapshot,
  calculateResult,
  getSoakPeriodDays,
  getAfterSnapshotDueDate,
  type TestMetrics,
} from '../../../agents/ab-test-tracker/snapshot-manager';

describe('getSoakPeriodDays', () => {
  it('returns 14 for hero_photo tests', () => {
    expect(getSoakPeriodDays('hero_photo')).toBe(14);
  });

  it('returns 14 for title tests', () => {
    expect(getSoakPeriodDays('title')).toBe(14);
  });

  it('returns 28 for description tests (conversion-based)', () => {
    expect(getSoakPeriodDays('description')).toBe(28);
  });

  it('returns 28 for cancellation_policy tests (impression rate)', () => {
    expect(getSoakPeriodDays('cancellation_policy')).toBe(28);
  });

  it('returns 28 for pricing tests', () => {
    expect(getSoakPeriodDays('pricing')).toBe(28);
  });

  it('returns 14 for amenities tests', () => {
    expect(getSoakPeriodDays('amenities')).toBe(14);
  });

  it('returns 21 for unknown test types (safe default)', () => {
    expect(getSoakPeriodDays('unknown_type')).toBe(21);
  });
});

describe('getAfterSnapshotDueDate', () => {
  it('adds soak period days to change executed date', () => {
    const changeDate = new Date('2026-04-01');
    const dueDate = getAfterSnapshotDueDate(changeDate, 14);
    expect(dueDate.toISOString().split('T')[0]).toBe('2026-04-15');
  });
});

describe('captureBeforeSnapshot', () => {
  it('extracts relevant metrics from a full snapshot row', () => {
    const snapshotRow = {
      airbnb_search_to_listing_ctr: 7.2,
      airbnb_first_page_impression_rate: 54.0,
      airbnb_listing_to_booking_conversion: 2.8,
      airbnb_wishlist_additions: 12,
      airbnb_page_views: 200,
      airbnb_overall_rating: 4.85,
      airbnb_avg_nightly_rate: 350,
      airbnb_occupancy_rate: 65.0,
      snapshot_date: '2026-04-01',
    };

    const result = captureBeforeSnapshot(snapshotRow);
    expect(result.ctr).toBe(7.2);
    expect(result.impression_rate).toBe(54.0);
    expect(result.conversion).toBe(2.8);
    expect(result.wishlist_additions).toBe(12);
    expect(result.page_views).toBe(200);
    expect(result.snapshot_date).toBe('2026-04-01');
  });

  it('handles null metric values', () => {
    const snapshotRow = {
      airbnb_search_to_listing_ctr: null,
      airbnb_first_page_impression_rate: 50.0,
      airbnb_listing_to_booking_conversion: null,
      airbnb_wishlist_additions: null,
      airbnb_page_views: null,
      airbnb_overall_rating: null,
      airbnb_avg_nightly_rate: null,
      airbnb_occupancy_rate: null,
      snapshot_date: '2026-04-01',
    };

    const result = captureBeforeSnapshot(snapshotRow);
    expect(result.ctr).toBeNull();
    expect(result.impression_rate).toBe(50.0);
    expect(result.conversion).toBeNull();
  });
});

describe('captureAfterSnapshot', () => {
  it('returns the same structure as captureBeforeSnapshot', () => {
    const snapshotRow = {
      airbnb_search_to_listing_ctr: 18.0,
      airbnb_first_page_impression_rate: 55.0,
      airbnb_listing_to_booking_conversion: 3.0,
      airbnb_wishlist_additions: 15,
      airbnb_page_views: 250,
      snapshot_date: '2026-04-15',
    };

    const result = captureAfterSnapshot(snapshotRow);
    expect(result.ctr).toBe(18.0);
    expect(result.snapshot_date).toBe('2026-04-15');
  });
});

describe('calculateResult', () => {
  it('calculates positive result when target metric improved', () => {
    const before: TestMetrics = {
      ctr: 7.2, impression_rate: 54.0, conversion: 2.8,
      wishlist_additions: 12, page_views: 200, snapshot_date: '2026-04-01',
    };
    const after: TestMetrics = {
      ctr: 18.0, impression_rate: 55.0, conversion: 3.0,
      wishlist_additions: 15, page_views: 250, snapshot_date: '2026-04-15',
    };

    const result = calculateResult(before, after, 'ctr');
    expect(result.result).toBe('positive');
    expect(result.metric_lift).toBeCloseTo(150.0, 0);
    expect(result.result_summary).toContain('7.2');
    expect(result.result_summary).toContain('18');
  });

  it('calculates negative result when target metric declined', () => {
    const before: TestMetrics = {
      ctr: 18.0, impression_rate: 54.0, conversion: 2.8,
      wishlist_additions: 12, page_views: 200, snapshot_date: '2026-04-01',
    };
    const after: TestMetrics = {
      ctr: 12.0, impression_rate: 50.0, conversion: 2.5,
      wishlist_additions: 10, page_views: 180, snapshot_date: '2026-04-15',
    };

    const result = calculateResult(before, after, 'ctr');
    expect(result.result).toBe('negative');
    expect(result.metric_lift).toBeLessThan(0);
  });

  it('calculates no_change when lift is within noise threshold (< 5%)', () => {
    const before: TestMetrics = {
      ctr: 15.0, impression_rate: 54.0, conversion: 2.8,
      wishlist_additions: 12, page_views: 200, snapshot_date: '2026-04-01',
    };
    const after: TestMetrics = {
      ctr: 15.5, impression_rate: 54.0, conversion: 2.8,
      wishlist_additions: 12, page_views: 200, snapshot_date: '2026-04-15',
    };

    const result = calculateResult(before, after, 'ctr');
    expect(result.result).toBe('no_change');
  });

  it('handles zero before value without dividing by zero', () => {
    const before: TestMetrics = {
      ctr: 0, impression_rate: 54.0, conversion: 2.8,
      wishlist_additions: 12, page_views: 200, snapshot_date: '2026-04-01',
    };
    const after: TestMetrics = {
      ctr: 5.0, impression_rate: 54.0, conversion: 2.8,
      wishlist_additions: 12, page_views: 200, snapshot_date: '2026-04-15',
    };

    const result = calculateResult(before, after, 'ctr');
    expect(result.result).toBe('positive');
  });

  it('handles null target metric in after snapshot gracefully', () => {
    const before: TestMetrics = {
      ctr: 15.0, impression_rate: 54.0, conversion: 2.8,
      wishlist_additions: 12, page_views: 200, snapshot_date: '2026-04-01',
    };
    const after: TestMetrics = {
      ctr: null as unknown as number, impression_rate: 54.0, conversion: 2.8,
      wishlist_additions: 12, page_views: 200, snapshot_date: '2026-04-15',
    };

    const result = calculateResult(before, after, 'ctr');
    expect(result.result).toBe('no_change');
    expect(result.result_summary).toContain('insufficient data');
  });

  it('works for impression_rate as target metric', () => {
    const before: TestMetrics = {
      ctr: 15.0, impression_rate: 45.0, conversion: 2.8,
      wishlist_additions: 12, page_views: 200, snapshot_date: '2026-04-01',
    };
    const after: TestMetrics = {
      ctr: 15.0, impression_rate: 58.0, conversion: 3.0,
      wishlist_additions: 14, page_views: 220, snapshot_date: '2026-04-29',
    };

    const result = calculateResult(before, after, 'impression_rate');
    expect(result.result).toBe('positive');
    expect(result.metric_lift).toBeCloseTo(28.9, 0);
  });
});
