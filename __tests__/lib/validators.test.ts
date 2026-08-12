import { describe, it, expect } from 'vitest';
import { validateMetricSnapshot, validatePropertyInput } from '@/lib/validators';

describe('validateMetricSnapshot', () => {
  it('accepts valid snapshot data', () => {
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

  it('rejects negative page views', () => {
    const result = validateMetricSnapshot({
      airbnb_page_views: -5,
    });
    expect(result.success).toBe(false);
  });

  it('rejects rating > 5', () => {
    const result = validateMetricSnapshot({
      airbnb_overall_rating: 6.0,
    });
    expect(result.success).toBe(false);
  });

  it('rejects negative CTR', () => {
    const result = validateMetricSnapshot({
      airbnb_search_to_listing_ctr: -2.0,
    });
    expect(result.success).toBe(false);
  });

  it('allows null values for optional metrics', () => {
    const result = validateMetricSnapshot({
      airbnb_first_page_impression_rate: null,
      airbnb_search_to_listing_ctr: null,
    });
    expect(result.success).toBe(true);
  });
});

describe('validatePropertyInput', () => {
  it('accepts valid property data', () => {
    const result = validatePropertyInput({
      streamline_unit_id: '12345',
      property_name: 'Desert Oasis',
      market: 'scottsdale',
      quality_tier: 'gold',
    });
    expect(result.success).toBe(true);
  });

  it('rejects invalid market', () => {
    const result = validatePropertyInput({
      streamline_unit_id: '12345',
      property_name: 'Test',
      market: 'mars',
      quality_tier: 'gold',
    });
    expect(result.success).toBe(false);
  });

  it('rejects invalid quality tier', () => {
    const result = validatePropertyInput({
      streamline_unit_id: '12345',
      property_name: 'Test',
      market: 'scottsdale',
      quality_tier: 'legendary',
    });
    expect(result.success).toBe(false);
  });
});
