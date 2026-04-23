import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { parseAirbnbPublicHtml } from '../../../agents/listing-scraper/airbnb-public';

const FIXTURE = readFileSync(
  join(__dirname, '..', '..', 'fixtures', 'listing-scraper', 'airbnb-listing-sample.html'),
  'utf-8'
);

describe('parseAirbnbPublicHtml', () => {
  it('extracts title from og:title meta', () => {
    const parsed = parseAirbnbPublicHtml(FIXTURE);
    expect(parsed.title).toBe('Sunny Desert Retreat with Pool');
  });

  it('extracts description from og:description meta', () => {
    const parsed = parseAirbnbPublicHtml(FIXTURE);
    expect(parsed.description).toMatch(/Sonoran Desert/);
    expect(parsed.description!.length).toBeGreaterThan(50);
  });

  it('extracts primary photo URL from og:image meta', () => {
    const parsed = parseAirbnbPublicHtml(FIXTURE);
    expect(parsed.primaryPhotoUrl).toMatch(/^https:\/\//);
    expect(parsed.primaryPhotoUrl).toContain('muscache.com');
  });

  it('extracts rating from deferred state (starRating)', () => {
    const parsed = parseAirbnbPublicHtml(FIXTURE);
    expect(parsed.rating).toBe(4.92);
  });

  it('extracts review count from deferred state', () => {
    const parsed = parseAirbnbPublicHtml(FIXTURE);
    expect(parsed.reviewCount).toBe(118);
  });

  it('extracts photo count from deferred state', () => {
    const parsed = parseAirbnbPublicHtml(FIXTURE);
    expect(parsed.photoCount).toBe(26);
  });

  it('extracts price shown from structured display price', () => {
    const parsed = parseAirbnbPublicHtml(FIXTURE);
    expect(parsed.priceShown).toBe(289);
  });

  it('extracts instant book enabled flag', () => {
    const parsed = parseAirbnbPublicHtml(FIXTURE);
    expect(parsed.instantBookEnabled).toBe(true);
  });

  it('extracts badges, coercing object-form entries to their label', () => {
    const parsed = parseAirbnbPublicHtml(FIXTURE);
    expect(parsed.badges).toEqual(
      expect.arrayContaining(['Superhost', 'Guest favorite', 'Rare find'])
    );
  });

  it('extracts cancellation policy display string', () => {
    const parsed = parseAirbnbPublicHtml(FIXTURE);
    expect(parsed.cancellationPolicyDisplay).toBe('Moderate cancellation');
  });

  it('extracts amenity count from amenities array', () => {
    const parsed = parseAirbnbPublicHtml(FIXTURE);
    // deepFindKey finds the first `amenities` array — one of the preview/see-all groups.
    // We only assert it's populated; exact count depends on which group is found first.
    expect(parsed.amenityCount).not.toBeNull();
    expect(parsed.amenityCount!).toBeGreaterThan(0);
  });

  it('returns null fields (not undefined) when data is missing', () => {
    const parsed = parseAirbnbPublicHtml('<html><head></head><body></body></html>');
    expect(parsed.title).toBeNull();
    expect(parsed.description).toBeNull();
    expect(parsed.rating).toBeNull();
    expect(parsed.reviewCount).toBeNull();
    expect(parsed.photoCount).toBeNull();
    expect(parsed.priceShown).toBeNull();
    expect(parsed.instantBookEnabled).toBeNull();
    expect(parsed.cancellationPolicyDisplay).toBeNull();
    expect(parsed.amenityCount).toBeNull();
    expect(parsed.badges).toEqual([]);
  });

  it('never throws on malformed HTML', () => {
    expect(() => parseAirbnbPublicHtml('<<<not html>>>')).not.toThrow();
    expect(() => parseAirbnbPublicHtml('')).not.toThrow();
    expect(() =>
      parseAirbnbPublicHtml(
        '<html><script id="data-deferred-state">{not-valid-json</script></html>'
      )
    ).not.toThrow();
  });
});
