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
    <div className="bg-card border-b border-border px-6 py-4">
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-4">
          {/* Placeholder for hero photo thumbnail */}
          <div className="w-20 h-14 rounded-lg bg-muted flex items-center justify-center text-muted-foreground text-xs flex-shrink-0">
            Photo
          </div>

          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-bold text-foreground">{property.property_name}</h1>
              <StatusBadge status={healthStatus} size="md" />
            </div>

            <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
              <span>{MARKET_LABELS[property.market] || property.market}</span>
              <span className="text-muted-foreground">|</span>
              <span className="bg-muted px-2 py-0.5 rounded text-xs font-medium">
                {tierConfig?.label || property.quality_tier}
              </span>
              {property.bedrooms && (
                <>
                  <span className="text-muted-foreground">|</span>
                  <span>{property.bedrooms} BR</span>
                </>
              )}
              {property.property_type && (
                <>
                  <span className="text-muted-foreground">|</span>
                  <span className="capitalize">{property.property_type}</span>
                </>
              )}
            </div>

            {/* External links */}
            <div className="flex items-center gap-3 mt-2">
              <span className="text-xs text-muted-foreground">
                Streamline: {property.streamline_unit_id}
              </span>
              {property.airbnb_listing_id && (
                <a
                  href={`https://www.airbnb.com/rooms/${property.airbnb_listing_id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-primary hover:underline"
                >
                  Airbnb
                </a>
              )}
              {property.vrbo_listing_id && (
                <a
                  href={`https://www.vrbo.com/${property.vrbo_listing_id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-primary hover:underline"
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
          className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
        >
          <span>{'\u2190'}</span> Dashboard
        </Link>
      </div>
    </div>
  );
}
