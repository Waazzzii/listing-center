'use client';

import Link from 'next/link';
import StatusBadge from '@/components/shared/StatusBadge';
import { MARKET_LABELS, QUALITY_TIER_CONFIG } from '@/lib/constants';
import type { LcProperty, HealthStatus } from '@/lib/types';

interface PropertyHeaderProps {
  property: LcProperty;
  healthStatus: HealthStatus;
}

export default function PropertyHeader({ property, healthStatus }: PropertyHeaderProps) {
  const tierConfig = QUALITY_TIER_CONFIG[property.quality_tier];

  return (
    <div className="bg-[var(--card-bg)] border-b border-lc-border px-6 py-4">
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-4">
          {/* Placeholder for hero photo thumbnail */}
          <div className="w-20 h-14 rounded-lg bg-[var(--surface)] flex items-center justify-center text-[var(--text-muted)] text-xs flex-shrink-0">
            Photo
          </div>

          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-bold text-[var(--text-primary)]">{property.property_name}</h1>
              <StatusBadge status={healthStatus} size="md" />
            </div>

            <div className="flex items-center gap-4 mt-1 text-sm text-[var(--text-muted)]">
              <span>{MARKET_LABELS[property.market] || property.market}</span>
              <span className="text-[var(--text-muted)]">|</span>
              <span className="bg-[var(--surface)] px-2 py-0.5 rounded text-xs font-medium">
                {tierConfig?.label || property.quality_tier}
              </span>
              {property.bedrooms && (
                <>
                  <span className="text-[var(--text-muted)]">|</span>
                  <span>{property.bedrooms} BR</span>
                </>
              )}
              {property.property_type && (
                <>
                  <span className="text-[var(--text-muted)]">|</span>
                  <span className="capitalize">{property.property_type}</span>
                </>
              )}
            </div>

            {/* External links */}
            <div className="flex items-center gap-3 mt-2">
              <span className="text-xs text-[var(--text-muted)]">
                Streamline: {property.streamline_unit_id}
              </span>
              {property.airbnb_listing_id && (
                <a
                  href={`https://www.airbnb.com/rooms/${property.airbnb_listing_id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-lc-primary hover:underline"
                >
                  Airbnb
                </a>
              )}
              {property.vrbo_listing_id && (
                <a
                  href={`https://www.vrbo.com/${property.vrbo_listing_id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-lc-primary hover:underline"
                >
                  VRBO
                </a>
              )}
            </div>
          </div>
        </div>

        {/* Back link */}
        <Link
          href="/dashboard"
          className="text-sm text-[var(--text-muted)] hover:text-[var(--text-secondary)] flex items-center gap-1"
        >
          <span>{'\u2190'}</span> Dashboard
        </Link>
      </div>
    </div>
  );
}
