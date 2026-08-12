import { describe, it, expect } from 'vitest';
import {
  extractListingIdFromHref,
  parseConversionRow,
  parseViewsRow,
  parseWishlistRow,
  parseQualityRow,
  parseOccupancyRow,
  parseCancellationRow,
  parseOpportunityCard,
  parseIssueItem,
} from '../../../agents/data-collection/page-scrapers';

describe('extractListingIdFromHref', () => {
  it('extracts ID from /rooms/12345 link', () => {
    expect(extractListingIdFromHref('/rooms/12345')).toBe('12345');
  });

  it('extracts ID from full URL', () => {
    expect(extractListingIdFromHref('https://www.airbnb.com/rooms/67890?check_in=2026-01-01')).toBe('67890');
  });

  it('extracts ID from /performance path with lid param', () => {
    expect(extractListingIdFromHref('/performance/conversion?lid%5B%5D=99999')).toBe('99999');
  });

  it('returns null for unrecognized format', () => {
    expect(extractListingIdFromHref('/some/other/path')).toBeNull();
  });
});

describe('parseConversionRow', () => {
  it('parses a typical conversion table row', () => {
    const row = {
      listing_name: 'Desert Oasis Retreat',
      listing_id: '12345',
      cells: ['0.91%', '50.9%', '18.21%', '5.01%', '1,234', '12'],
    };
    const result = parseConversionRow(row);

    expect(result.metrics.airbnb_overall_conversion_rate).toBe(0.91);
    expect(result.metrics.airbnb_first_page_impression_rate).toBe(50.9);
    expect(result.metrics.airbnb_search_to_listing_ctr).toBe(18.21);
    expect(result.metrics.airbnb_listing_to_booking_conversion).toBe(5.01);
  });

  it('handles N/A values as null', () => {
    const row = {
      listing_name: 'Test Property',
      listing_id: '12345',
      cells: ['N/A', 'N/A', '18.21%', 'N/A', '--', '0'],
    };
    const result = parseConversionRow(row);

    expect(result.metrics.airbnb_overall_conversion_rate).toBeNull();
    expect(result.metrics.airbnb_first_page_impression_rate).toBeNull();
    expect(result.metrics.airbnb_search_to_listing_ctr).toBe(18.21);
  });
});

describe('parseViewsRow', () => {
  it('parses views data', () => {
    const row = {
      listing_name: 'Beach House',
      listing_id: '67890',
      cells: ['2,345', '-12.3%'],
    };
    const result = parseViewsRow(row);

    expect(result.metrics.airbnb_page_views).toBe(2345);
  });

  it('handles zero views', () => {
    const row = {
      listing_name: 'New Listing',
      listing_id: '11111',
      cells: ['0', 'N/A'],
    };
    const result = parseViewsRow(row);

    expect(result.metrics.airbnb_page_views).toBe(0);
  });
});

describe('parseWishlistRow', () => {
  it('parses wishlist additions', () => {
    const row = {
      listing_name: 'Mountain Cabin',
      listing_id: '22222',
      cells: ['45', '+15.0%'],
    };
    const result = parseWishlistRow(row);

    expect(result.metrics.airbnb_wishlist_additions).toBe(45);
  });
});

describe('parseQualityRow', () => {
  it('parses quality overall data', () => {
    const row = {
      listing_name: 'Luxury Villa',
      listing_id: '33333',
      cells: ['4.85', '92.0%', '127'],
    };
    const result = parseQualityRow(row);

    expect(result.metrics.airbnb_overall_rating).toBe(4.85);
    expect(result.metrics.airbnb_5star_overall_pct).toBe(92.0);
    expect(result.metrics.airbnb_review_count).toBe(127);
  });
});

describe('parseOccupancyRow', () => {
  it('parses occupancy data', () => {
    const row = {
      listing_name: 'Downtown Condo',
      listing_id: '44444',
      cells: ['75.2%', '90', '10', '20', '15'],
    };
    const result = parseOccupancyRow(row);

    expect(result.metrics.airbnb_occupancy_rate).toBe(75.2);
    expect(result.metrics.airbnb_nights_booked).toBe(90);
    expect(result.metrics.airbnb_nights_blocked).toBe(10);
    expect(result.metrics.airbnb_unbooked_nights).toBe(20);
    expect(result.metrics.airbnb_check_ins).toBe(15);
  });
});

describe('parseCancellationRow', () => {
  it('parses cancellation data', () => {
    const row = {
      listing_name: 'Poolside Retreat',
      listing_id: '55555',
      cells: ['2.5%', '3.2', '$285.00'],
    };
    const result = parseCancellationRow(row);

    expect(result.metrics.airbnb_cancellation_rate).toBe(2.5);
    expect(result.metrics.airbnb_avg_length_of_stay_days).toBe(3.2);
    expect(result.metrics.airbnb_avg_nightly_rate).toBe(285.00);
  });
});

describe('parseOpportunityCard', () => {
  it('parses a standard opportunity', () => {
    const result = parseOpportunityCard({
      name: 'Allow pets at your place',
      category: 'appealing',
      completion_text: '24% of your listings',
    });

    expect(result.name).toBe('Allow pets at your place');
    expect(result.category).toBe('appealing');
    expect(result.completion_pct).toBe(24.0);
  });

  it('handles 100% completion', () => {
    const result = parseOpportunityCard({
      name: 'Add wifi details',
      category: 'appealing',
      completion_text: '100% of your listings',
    });

    expect(result.completion_pct).toBe(100.0);
  });
});

describe('parseIssueItem', () => {
  it('parses an issue with needs_attention status', () => {
    const result = parseIssueItem({
      listing_name: 'Desert Home',
      listing_href: '/rooms/12345',
      description: 'Missing checkout instructions',
      status_text: 'Needs attention',
    });

    expect(result.listing_id).toBe('12345');
    expect(result.description).toBe('Missing checkout instructions');
    expect(result.status).toBe('needs_attention');
  });

  it('maps "Deleted" status correctly', () => {
    const result = parseIssueItem({
      listing_name: 'Old Listing',
      listing_href: '/rooms/99999',
      description: 'Listing deactivated',
      status_text: 'Deleted',
    });

    expect(result.status).toBe('deleted');
  });
});
