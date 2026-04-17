'use client';

import { formatNumber, formatPct } from '@/lib/utils';
import type { LcMetricSnapshot } from '@/lib/types';

interface FunnelVisualizationProps {
  snapshot: LcMetricSnapshot | null;
}

interface FunnelStage {
  label: string;
  value: number | null;
  color: string;
  dropoffPct: number | null;
}

export default function FunnelVisualization({ snapshot }: FunnelVisualizationProps) {
  if (!snapshot) {
    return (
      <div className="bg-[var(--card-bg)] rounded-lg border border-lc-border p-6 text-center text-[var(--text-muted)]">
        No funnel data available
      </div>
    );
  }

  // Calculate funnel stages using available data
  const impressions = snapshot.airbnb_first_page_impressions;
  const pageViews = snapshot.airbnb_page_views;
  const wishlists = snapshot.airbnb_wishlist_additions;

  // Estimate clicks from CTR: clicks = impressions * CTR / 100
  const clicks = impressions !== null && snapshot.airbnb_search_to_listing_ctr !== null
    ? Math.round(impressions * snapshot.airbnb_search_to_listing_ctr / 100)
    : null;

  // Estimate bookings from conversion: bookings = page_views * conversion / 100
  const bookings = pageViews !== null && snapshot.airbnb_listing_to_booking_conversion !== null
    ? Math.round(pageViews * snapshot.airbnb_listing_to_booking_conversion / 100)
    : null;

  const stages: FunnelStage[] = [
    { label: 'Impressions', value: impressions, color: 'bg-blue-400', dropoffPct: null },
    { label: 'Clicks', value: clicks, color: 'bg-blue-500', dropoffPct: calcDropoff(impressions, clicks) },
    { label: 'Page Views', value: pageViews, color: 'bg-indigo-500', dropoffPct: calcDropoff(clicks, pageViews) },
    { label: 'Wishlists', value: wishlists, color: 'bg-purple-500', dropoffPct: calcDropoff(pageViews, wishlists) },
    { label: 'Bookings', value: bookings, color: 'bg-green-500', dropoffPct: calcDropoff(wishlists, bookings) },
  ];

  // Find max value for width scaling
  const maxVal = Math.max(...stages.map((s) => s.value ?? 0), 1);

  return (
    <div className="bg-[var(--card-bg)] rounded-lg border border-lc-border p-6">
      <h3 className="text-sm font-semibold text-[var(--text-secondary)] mb-4">Conversion Funnel</h3>

      <div className="space-y-3">
        {stages.map((stage, index) => {
          const widthPct = stage.value !== null ? Math.max((stage.value / maxVal) * 100, 8) : 8;

          return (
            <div key={stage.label}>
              {/* Drop-off indicator between stages */}
              {index > 0 && stage.dropoffPct !== null && (
                <div className="flex items-center gap-2 pl-4 -mt-1 mb-1">
                  <svg className="w-3 h-3 text-[var(--text-muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                  </svg>
                  <span className={`text-xs font-medium ${
                    stage.dropoffPct > 90 ? 'text-red-500' : stage.dropoffPct > 70 ? 'text-amber-500' : 'text-[var(--text-muted)]'
                  }`}>
                    {stage.dropoffPct.toFixed(0)}% drop-off
                  </span>
                </div>
              )}

              {/* Bar */}
              <div className="flex items-center gap-3">
                <span className="text-xs font-medium text-[var(--text-muted)] w-20 text-right flex-shrink-0">
                  {stage.label}
                </span>
                <div className="flex-1 h-8 bg-[var(--surface)] rounded-lg overflow-hidden relative">
                  <div
                    className={`h-full ${stage.color} rounded-lg transition-all duration-500 flex items-center px-3`}
                    style={{ width: `${widthPct}%` }}
                  >
                    <span className="text-xs font-bold text-white whitespace-nowrap">
                      {stage.value !== null ? formatNumber(stage.value) : '\u2014'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Summary rates */}
      <div className="mt-4 pt-4 border-t border-[var(--border)] grid grid-cols-3 gap-4">
        <div className="text-center">
          <p className="text-xs text-[var(--text-muted)]">Impression Rate</p>
          <p className="text-sm font-semibold">{formatPct(snapshot.airbnb_first_page_impression_rate)}</p>
        </div>
        <div className="text-center">
          <p className="text-xs text-[var(--text-muted)]">CTR</p>
          <p className="text-sm font-semibold">{formatPct(snapshot.airbnb_search_to_listing_ctr)}</p>
        </div>
        <div className="text-center">
          <p className="text-xs text-[var(--text-muted)]">Conversion</p>
          <p className="text-sm font-semibold">{formatPct(snapshot.airbnb_listing_to_booking_conversion)}</p>
        </div>
      </div>
    </div>
  );
}

function calcDropoff(from: number | null, to: number | null): number | null {
  if (from === null || to === null || from === 0) return null;
  return ((from - to) / from) * 100;
}
