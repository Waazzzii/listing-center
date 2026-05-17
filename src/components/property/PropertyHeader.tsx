'use client';

import Link from 'next/link';
import { ArrowLeft, ExternalLink, Building2 } from 'lucide-react';
import StatusBadge from '@/components/shared/StatusBadge';
import { TierBadge } from '@/components/ui/tier-badge';
import { MARKET_LABELS } from '@/lib/constants';
import type { LcProperty, HealthStatus } from '@/lib/types';

interface PropertyHeaderProps {
  property: LcProperty;
  healthStatus: HealthStatus;
}

export default function PropertyHeader({ property, healthStatus }: PropertyHeaderProps) {
  return (
    <div className="bg-card border-b border-border px-6 py-5">
      <Link
        href="/property"
        className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mb-3"
      >
        <ArrowLeft className="h-3 w-3" />
        All properties
      </Link>

      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-4 min-w-0">
          {/* Property image placeholder */}
          <div className="flex h-16 w-24 items-center justify-center rounded-md bg-muted text-muted-foreground shrink-0 ring-1 ring-border">
            <Building2 className="h-6 w-6 opacity-60" />
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-xl font-semibold tracking-tight text-foreground">
                {property.property_name}
              </h1>
              <StatusBadge status={healthStatus} size="md" />
            </div>

            <div className="flex items-center gap-2 mt-1.5 text-sm text-muted-foreground flex-wrap">
              <span>{MARKET_LABELS[property.market] || property.market}</span>
              <span className="text-border">•</span>
              <TierBadge tier={property.quality_tier} />
              {property.bedrooms && (
                <>
                  <span className="text-border">•</span>
                  <span>{property.bedrooms} BR</span>
                </>
              )}
              {property.property_type && (
                <>
                  <span className="text-border">•</span>
                  <span className="capitalize">{property.property_type}</span>
                </>
              )}
            </div>

            <div className="flex items-center gap-4 mt-3 text-xs">
              <span className="text-muted-foreground">
                Streamline <span className="font-mono text-foreground">{property.streamline_unit_id}</span>
              </span>
              {property.airbnb_listing_id && (
                <a
                  href={`https://www.airbnb.com/rooms/${property.airbnb_listing_id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-primary hover:underline"
                >
                  Airbnb
                  <ExternalLink className="h-3 w-3" />
                </a>
              )}
              {property.vrbo_listing_id && (
                <a
                  href={`https://www.vrbo.com/${property.vrbo_listing_id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-primary hover:underline"
                >
                  VRBO
                  <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
