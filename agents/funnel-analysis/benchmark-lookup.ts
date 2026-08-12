import type { Season } from '../../src/lib/season';

export interface BenchmarkRow {
  id: string;
  quality_tier: string;
  market: string | null;
  season: string | null;
  impression_rate_low: number;
  impression_rate_high: number;
  ctr_low: number;
  ctr_high: number;
  conversion_low: number;
  conversion_high: number;
  impression_rate_critical: number;
  ctr_critical: number;
  conversion_critical: number;
  is_active: boolean;
}

export interface ResolvedBenchmark {
  quality_tier: string;
  market: string | null;
  season: string | null;
  impression_rate_low: number;
  impression_rate_high: number;
  ctr_low: number;
  ctr_high: number;
  conversion_low: number;
  conversion_high: number;
  impression_rate_critical: number;
  ctr_critical: number;
  conversion_critical: number;
}

/**
 * Resolve the correct benchmark for a property using cascading specificity:
 *
 * 1. market + season + tier  (most specific)
 * 2. market + tier           (market override)
 * 3. season + tier           (season override)
 * 4. tier only               (global default)
 *
 * Only active benchmarks are considered.
 */
export function resolveBenchmark(
  allBenchmarks: BenchmarkRow[],
  qualityTier: string,
  market: string,
  season: Season
): ResolvedBenchmark {
  // Filter to active benchmarks for this tier
  const tierBenchmarks = allBenchmarks.filter(
    b => b.is_active && b.quality_tier === qualityTier
  );

  if (tierBenchmarks.length === 0) {
    throw new Error(`No benchmark found for tier: ${qualityTier}`);
  }

  // Try most specific first: market + season
  const marketSeasonMatch = tierBenchmarks.find(
    b => b.market === market && b.season === season
  );
  if (marketSeasonMatch) return toBenchmark(marketSeasonMatch);

  // Try market only
  const marketMatch = tierBenchmarks.find(
    b => b.market === market && b.season == null
  );
  if (marketMatch) return toBenchmark(marketMatch);

  // Try season only (global season override)
  const seasonMatch = tierBenchmarks.find(
    b => b.market == null && b.season === season
  );
  if (seasonMatch) return toBenchmark(seasonMatch);

  // Fall back to global tier default
  const globalMatch = tierBenchmarks.find(
    b => b.market == null && b.season == null
  );
  if (globalMatch) return toBenchmark(globalMatch);

  throw new Error(`No benchmark found for tier: ${qualityTier}`);
}

function toBenchmark(row: BenchmarkRow): ResolvedBenchmark {
  return {
    quality_tier: row.quality_tier,
    market: row.market,
    season: row.season,
    impression_rate_low: row.impression_rate_low,
    impression_rate_high: row.impression_rate_high,
    ctr_low: row.ctr_low,
    ctr_high: row.ctr_high,
    conversion_low: row.conversion_low,
    conversion_high: row.conversion_high,
    impression_rate_critical: row.impression_rate_critical,
    ctr_critical: row.ctr_critical,
    conversion_critical: row.conversion_critical,
  };
}
