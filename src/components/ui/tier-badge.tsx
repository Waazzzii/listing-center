import * as React from 'react';
import { cn } from '@/lib/utils';
import type { QualityTier } from '@/lib/types';

/**
 * Distinct visual treatment per quality tier.
 * Higher tiers get richer treatment; standard is neutral.
 */
const TIER_STYLES: Record<string, { className: string; label: string }> = {
  standard: {
    label: 'Standard',
    className: 'bg-muted text-muted-foreground',
  },
  silver: {
    label: 'Silver',
    className: 'bg-secondary text-secondary-foreground border border-border',
  },
  gold: {
    label: 'Gold',
    className: 'bg-chart-4/15 text-chart-4 border border-chart-4/30',
  },
  platinum: {
    label: 'Platinum',
    className: 'bg-chart-3/15 text-chart-3 border border-chart-3/30',
  },
  diamond: {
    label: 'Diamond',
    className: 'bg-chart-2/15 text-chart-2 border border-chart-2/40',
  },
};

interface TierBadgeProps {
  tier: QualityTier | string;
  className?: string;
}

export function TierBadge({ tier, className }: TierBadgeProps) {
  const style = TIER_STYLES[tier] ?? TIER_STYLES.standard;
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium capitalize',
        style.className,
        className,
      )}
    >
      {style.label}
    </span>
  );
}
