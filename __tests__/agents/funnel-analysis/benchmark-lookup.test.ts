import { describe, it, expect } from 'vitest';
import { resolveBenchmark, type ResolvedBenchmark, type BenchmarkRow } from '../../../agents/funnel-analysis/benchmark-lookup';

// Mock benchmark rows that would come from Supabase
const mockBenchmarkRows: BenchmarkRow[] = [
  // Global gold tier default (no market, no season)
  {
    id: 'b1',
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
    is_active: true,
  },
  // Scottsdale gold tier override (market-specific)
  {
    id: 'b2',
    quality_tier: 'gold',
    market: 'scottsdale',
    season: null,
    impression_rate_low: 48.0,
    impression_rate_high: 62.0,
    ctr_low: 12.0,
    ctr_high: 28.0,
    conversion_low: 2.5,
    conversion_high: 5.5,
    impression_rate_critical: 48.0,
    ctr_critical: 12.0,
    conversion_critical: 2.5,
    is_active: true,
  },
  // Scottsdale gold peak season override (most specific)
  {
    id: 'b3',
    quality_tier: 'gold',
    market: 'scottsdale',
    season: 'peak',
    impression_rate_low: 45.0,
    impression_rate_high: 60.0,
    ctr_low: 14.0,
    ctr_high: 30.0,
    conversion_low: 3.0,
    conversion_high: 6.0,
    impression_rate_critical: 45.0,
    ctr_critical: 14.0,
    conversion_critical: 3.0,
    is_active: true,
  },
  // Global standard tier default
  {
    id: 'b4',
    quality_tier: 'standard',
    market: null,
    season: null,
    impression_rate_low: 55.0,
    impression_rate_high: 70.0,
    ctr_low: 12.0,
    ctr_high: 30.0,
    conversion_low: 2.5,
    conversion_high: 6.0,
    impression_rate_critical: 55.0,
    ctr_critical: 12.0,
    conversion_critical: 2.5,
    is_active: true,
  },
];

describe('resolveBenchmark', () => {
  it('returns most specific match: market + season override', () => {
    const result = resolveBenchmark(mockBenchmarkRows, 'gold', 'scottsdale', 'peak');
    expect(result.impression_rate_low).toBe(45.0);
    expect(result.ctr_low).toBe(14.0);
    expect(result.conversion_low).toBe(3.0);
  });

  it('falls back to market override when no season match', () => {
    const result = resolveBenchmark(mockBenchmarkRows, 'gold', 'scottsdale', 'low');
    expect(result.impression_rate_low).toBe(48.0);
    expect(result.ctr_low).toBe(12.0);
  });

  it('falls back to global tier default when no market match', () => {
    const result = resolveBenchmark(mockBenchmarkRows, 'gold', 'tucson', 'peak');
    expect(result.impression_rate_low).toBe(50.0);
    expect(result.ctr_low).toBe(10.0);
  });

  it('returns correct benchmark for different quality tier', () => {
    const result = resolveBenchmark(mockBenchmarkRows, 'standard', 'tucson', 'peak');
    expect(result.impression_rate_low).toBe(55.0);
    expect(result.quality_tier).toBe('standard');
  });

  it('throws when no benchmark found for tier', () => {
    expect(() =>
      resolveBenchmark(mockBenchmarkRows, 'diamond', 'scottsdale', 'peak')
    ).toThrow('No benchmark found for tier: diamond');
  });

  it('ignores inactive benchmarks', () => {
    const rows = [
      ...mockBenchmarkRows,
      {
        id: 'b5',
        quality_tier: 'gold',
        market: 'scottsdale',
        season: 'low',
        impression_rate_low: 99.0,
        impression_rate_high: 99.0,
        ctr_low: 99.0,
        ctr_high: 99.0,
        conversion_low: 99.0,
        conversion_high: 99.0,
        impression_rate_critical: 99.0,
        ctr_critical: 99.0,
        conversion_critical: 99.0,
        is_active: false, // inactive
      },
    ];
    const result = resolveBenchmark(rows, 'gold', 'scottsdale', 'low');
    // Should fall back to market override, not use the inactive season-specific row
    expect(result.impression_rate_low).toBe(48.0);
  });
});
