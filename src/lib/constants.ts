import type { HealthStatus, QualityTier } from './types';

export const HEALTH_STATUS_CONFIG: Record<HealthStatus, { label: string; color: string; bgColor: string; sortOrder: number }> = {
  red:        { label: 'Fix Now',       color: 'text-health-red',    bgColor: 'bg-health-red',    sortOrder: 1 },
  orange:     { label: 'This Week',     color: 'text-health-orange', bgColor: 'bg-health-orange', sortOrder: 2 },
  yellow:     { label: 'Value Capture', color: 'text-health-yellow', bgColor: 'bg-health-yellow', sortOrder: 3 },
  green:      { label: 'Healthy',       color: 'text-health-green',  bgColor: 'bg-health-green',  sortOrder: 4 },
  blue_spell: { label: 'Blue Spell',    color: 'text-health-blue',   bgColor: 'bg-health-blue',   sortOrder: 5 },
  unknown:    { label: 'No Data',       color: 'text-muted-foreground',      bgColor: 'bg-muted',      sortOrder: 6 },
};

export const QUALITY_TIER_CONFIG: Record<QualityTier, { label: string; numeric: number; adrRange: string }> = {
  standard: { label: 'Standard', numeric: 1, adrRange: '$50-150/night' },
  silver:   { label: 'Silver',   numeric: 2, adrRange: '$100-200/night' },
  gold:     { label: 'Gold',     numeric: 3, adrRange: '$200-350/night' },
  platinum: { label: 'Platinum', numeric: 4, adrRange: '$300-500/night' },
  diamond:  { label: 'Diamond',  numeric: 5, adrRange: '$500+/night' },
};

export const MARKET_LABELS: Record<string, string> = {
  scottsdale: 'Phoenix / Scottsdale',
  tucson: 'Tucson',
  sedona: 'Sedona / Flagstaff',
  coachella: 'Coachella Valley',
  central_coast: 'Central Coast',
  orange_county: 'Orange County',
  lake_arrowhead: 'Lake Arrowhead',
};

export const STALE_DATA_THRESHOLD_DAYS = 8;
export const MIN_WEEKS_FOR_TRENDS = 4;
