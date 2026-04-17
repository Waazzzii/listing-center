import { describe, it, expect } from 'vitest';
import {
  validateMetricSnapshot,
  validateParsedMetric,
  validateOpportunity,
  validateIssue,
  parseNumericValue,
  parsePercentValue,
} from '../../../agents/data-collection/validation';

describe('parseNumericValue', () => {
  it('parses integer with commas', () => {
    expect(parseNumericValue('1,234')).toBe(1234);
  });

  it('parses plain integer', () => {
    expect(parseNumericValue('567')).toBe(567);
  });

  it('parses decimal', () => {
    expect(parseNumericValue('4.85')).toBe(4.85);
  });

  it('returns null for N/A', () => {
    expect(parseNumericValue('N/A')).toBeNull();
  });

  it('returns null for --', () => {
    expect(parseNumericValue('--')).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(parseNumericValue('')).toBeNull();
  });

  it('returns null for undefined', () => {
    expect(parseNumericValue(undefined as unknown as string)).toBeNull();
  });

  it('strips dollar sign', () => {
    expect(parseNumericValue('$250.00')).toBe(250.00);
  });

  it('handles negative numbers', () => {
    expect(parseNumericValue('-5.2')).toBe(-5.2);
  });
});

describe('parsePercentValue', () => {
  it('strips percent sign and parses', () => {
    expect(parsePercentValue('55.2%')).toBe(55.2);
  });

  it('handles value without percent sign', () => {
    expect(parsePercentValue('55.2')).toBe(55.2);
  });

  it('returns null for N/A', () => {
    expect(parsePercentValue('N/A')).toBeNull();
  });

  it('returns null for --', () => {
    expect(parsePercentValue('--')).toBeNull();
  });
});

describe('validateParsedMetric', () => {
  it('accepts valid percentage in range', () => {
    expect(validateParsedMetric(55.2, 'percent')).toBe(true);
  });

  it('rejects percentage > 100', () => {
    expect(validateParsedMetric(150.0, 'percent')).toBe(false);
  });

  it('rejects negative percentage', () => {
    expect(validateParsedMetric(-5.0, 'percent')).toBe(false);
  });

  it('accepts valid count', () => {
    expect(validateParsedMetric(1234, 'count')).toBe(true);
  });

  it('rejects negative count', () => {
    expect(validateParsedMetric(-1, 'count')).toBe(false);
  });

  it('accepts valid rating 0-5', () => {
    expect(validateParsedMetric(4.85, 'rating')).toBe(true);
  });

  it('rejects rating > 5', () => {
    expect(validateParsedMetric(6.0, 'rating')).toBe(false);
  });

  it('accepts null for any type', () => {
    expect(validateParsedMetric(null, 'percent')).toBe(true);
    expect(validateParsedMetric(null, 'count')).toBe(true);
    expect(validateParsedMetric(null, 'rating')).toBe(true);
  });
});

describe('validateOpportunity', () => {
  it('accepts valid opportunity', () => {
    const result = validateOpportunity({
      airbnb_account_id: 1,
      snapshot_date: '2026-04-06',
      opportunity_name: 'Allow pets at your place',
      category: 'appealing',
      completion_pct: 24.0,
      is_completed: false,
    });
    expect(result.success).toBe(true);
  });

  it('rejects opportunity without name', () => {
    const result = validateOpportunity({
      airbnb_account_id: 1,
      snapshot_date: '2026-04-06',
      opportunity_name: '',
      category: 'appealing',
      completion_pct: 24.0,
      is_completed: false,
    });
    expect(result.success).toBe(false);
  });

  it('rejects invalid category', () => {
    const result = validateOpportunity({
      airbnb_account_id: 1,
      snapshot_date: '2026-04-06',
      opportunity_name: 'Allow pets',
      category: 'invalid_category',
      completion_pct: 24.0,
      is_completed: false,
    });
    expect(result.success).toBe(false);
  });
});

describe('validateIssue', () => {
  it('accepts valid issue', () => {
    const result = validateIssue({
      airbnb_listing_id: '12345',
      issue_description: 'Missing checkout instructions',
      issue_status: 'needs_attention',
    });
    expect(result.success).toBe(true);
  });

  it('rejects invalid status', () => {
    const result = validateIssue({
      airbnb_listing_id: '12345',
      issue_description: 'Missing checkout instructions',
      issue_status: 'unknown_status',
    });
    expect(result.success).toBe(false);
  });
});

describe('validateMetricSnapshot (re-exported)', () => {
  it('accepts valid snapshot', () => {
    const result = validateMetricSnapshot({
      airbnb_first_page_impression_rate: 55.2,
      airbnb_search_to_listing_ctr: 18.5,
      airbnb_listing_to_booking_conversion: 3.2,
      airbnb_page_views: 120,
      airbnb_overall_rating: 4.85,
    });
    expect(result.success).toBe(true);
  });

  it('rejects impression rate > 100', () => {
    const result = validateMetricSnapshot({
      airbnb_first_page_impression_rate: 150.0,
    });
    expect(result.success).toBe(false);
  });
});
