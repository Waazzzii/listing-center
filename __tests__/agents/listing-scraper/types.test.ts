import { describe, it, expect } from 'vitest';
import { isOTA, isScrapeSource, RATE_LIMITS } from '../../../agents/listing-scraper/_types';

describe('isOTA', () => {
  it('accepts known OTAs', () => {
    expect(isOTA('airbnb')).toBe(true);
    expect(isOTA('vrbo')).toBe(true);
    expect(isOTA('booking')).toBe(true);
  });

  it('rejects unknown OTAs', () => {
    expect(isOTA('expedia')).toBe(false);
    expect(isOTA('')).toBe(false);
    expect(isOTA(null)).toBe(false);
    expect(isOTA(undefined)).toBe(false);
  });
});

describe('isScrapeSource', () => {
  it('accepts public and extranet', () => {
    expect(isScrapeSource('public')).toBe(true);
    expect(isScrapeSource('extranet')).toBe(true);
  });

  it('rejects other values', () => {
    expect(isScrapeSource('api')).toBe(false);
    expect(isScrapeSource(null)).toBe(false);
  });
});

describe('RATE_LIMITS', () => {
  it('has per-OTA concurrency + delay caps', () => {
    expect(RATE_LIMITS.airbnb.maxConcurrent).toBe(2);
    expect(RATE_LIMITS.airbnb.minDelayMs).toBeGreaterThanOrEqual(1500);
    expect(RATE_LIMITS.vrbo.maxConcurrent).toBe(2);
    expect(RATE_LIMITS.booking.maxConcurrent).toBe(2);
  });
});
