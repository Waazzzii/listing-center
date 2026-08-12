'use client';

import MetricCard from '@/components/shared/MetricCard';
import { MetricCardSkeleton } from '@/components/shared/LoadingStates';
import { computeTrend } from '@/lib/utils';
import type { LcMetricSnapshot, LcBenchmark, HealthStatus } from '@/lib/types';

interface SixNumberCardsProps {
  snapshot: LcMetricSnapshot | null;
  previousSnapshot?: LcMetricSnapshot | null;
  benchmark?: LcBenchmark | null;
  isLoading: boolean;
}

export default function SixNumberCards({
  snapshot,
  previousSnapshot,
  benchmark,
  isLoading,
}: SixNumberCardsProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-6 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <MetricCardSkeleton key={i} />
        ))}
      </div>
    );
  }

  if (!snapshot) {
    return (
      <div className="grid grid-cols-6 gap-4">
        {['Impression Rate', 'CTR', 'Conversion', 'Wishlists', 'Page Views', 'Rating'].map((label) => (
          <MetricCard key={label} label={label} value={null} format="pct" />
        ))}
      </div>
    );
  }

  const cards = [
    {
      label: 'Impression Rate',
      value: snapshot.airbnb_first_page_impression_rate,
      format: 'pct' as const,
      benchmark: benchmark?.impression_rate_high ?? null,
      benchmarkLabel: 'Tier High',
      trend: computeTrend(
        snapshot.airbnb_first_page_impression_rate,
        previousSnapshot?.airbnb_first_page_impression_rate
      ),
      status: getMetricStatus(
        snapshot.airbnb_first_page_impression_rate,
        benchmark?.impression_rate_low ?? null,
        benchmark?.impression_rate_critical ?? null
      ),
    },
    {
      label: 'CTR',
      value: snapshot.airbnb_search_to_listing_ctr,
      format: 'pct' as const,
      benchmark: benchmark?.ctr_high ?? null,
      benchmarkLabel: 'Tier High',
      trend: computeTrend(
        snapshot.airbnb_search_to_listing_ctr,
        previousSnapshot?.airbnb_search_to_listing_ctr
      ),
      status: getMetricStatus(
        snapshot.airbnb_search_to_listing_ctr,
        benchmark?.ctr_low ?? null,
        benchmark?.ctr_critical ?? null
      ),
    },
    {
      label: 'Conversion',
      value: snapshot.airbnb_listing_to_booking_conversion,
      format: 'pct' as const,
      benchmark: benchmark?.conversion_high ?? null,
      benchmarkLabel: 'Tier High',
      trend: computeTrend(
        snapshot.airbnb_listing_to_booking_conversion,
        previousSnapshot?.airbnb_listing_to_booking_conversion
      ),
      status: getMetricStatus(
        snapshot.airbnb_listing_to_booking_conversion,
        benchmark?.conversion_low ?? null,
        benchmark?.conversion_critical ?? null
      ),
    },
    {
      label: 'Wishlists',
      value: snapshot.airbnb_wishlist_additions,
      format: 'number' as const,
      benchmark: null,
      benchmarkLabel: undefined,
      trend: computeTrend(
        snapshot.airbnb_wishlist_additions,
        previousSnapshot?.airbnb_wishlist_additions,
        1
      ),
      status: undefined,
    },
    {
      label: 'Page Views',
      value: snapshot.airbnb_page_views,
      format: 'number' as const,
      benchmark: null,
      benchmarkLabel: undefined,
      trend: computeTrend(
        snapshot.airbnb_page_views,
        previousSnapshot?.airbnb_page_views,
        5
      ),
      status: undefined,
    },
    {
      label: 'Overall Rating',
      value: snapshot.airbnb_overall_rating,
      format: 'rating' as const,
      benchmark: null,
      benchmarkLabel: undefined,
      trend: computeTrend(
        snapshot.airbnb_overall_rating,
        previousSnapshot?.airbnb_overall_rating,
        0.05
      ),
      status: undefined,
    },
  ];

  return (
    <div className="grid grid-cols-6 gap-4">
      {cards.map((card) => (
        <MetricCard
          key={card.label}
          label={card.label}
          value={card.value}
          format={card.format}
          benchmark={card.benchmark}
          benchmarkLabel={card.benchmarkLabel}
          trend={card.trend}
          status={card.status}
        />
      ))}
    </div>
  );
}

/**
 * Determine a simple health color for an individual metric based on benchmark thresholds.
 */
function getMetricStatus(
  value: number | null | undefined,
  low: number | null,
  critical: number | null
): HealthStatus | undefined {
  if (value === null || value === undefined) return undefined;
  if (critical !== null && value < critical) return 'red';
  if (low !== null && value < low) return 'orange';
  return 'green';
}
