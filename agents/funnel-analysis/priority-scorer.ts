export type EffortLevel = 'low' | 'medium' | 'high';
export type SeverityLevel = 'critical' | 'high' | 'medium' | 'low' | null;

export interface PriorityInput {
  adr: number | null;                    // Average daily rate ($)
  projected_occupancy_lift_pct: number;  // Estimated % occupancy improvement from fixing issues
  remaining_season_days: number;         // Days left in current season
  max_severity: SeverityLevel;           // Worst severity among all issues
  effort: EffortLevel;                   // Estimated effort to implement fix
  issue_count: number;                   // Number of diagnosed issues
  opportunity_count: number;             // Number of value capture opportunities
}

// Severity multipliers — how urgently this needs attention
const SEVERITY_MULTIPLIERS: Record<string, number> = {
  critical: 4.0,
  high: 2.5,
  medium: 1.5,
  low: 1.0,
};

// Effort divisors — harder changes get deprioritized vs quick wins
const EFFORT_DIVISORS: Record<EffortLevel, number> = {
  low: 1.0,    // Quick win — full priority
  medium: 1.5, // Moderate work — slightly lower
  high: 3.0,   // Major effort — significantly lower
};

// Default ADR when null (conservative estimate)
const DEFAULT_ADR = 250;

// Projected occupancy lift by severity (rough heuristic when no model exists yet)
const SEVERITY_TO_OCCUPANCY_LIFT: Record<string, number> = {
  critical: 15, // Fixing a critical issue could lift occupancy ~15%
  high: 10,
  medium: 5,
  low: 2,
};

// Base score for value capture opportunities (no issues, just upside)
const OPPORTUNITY_BASE_SCORE = 50;

/**
 * Calculate priority score for a property.
 *
 * Formula: (ADR x projected_occupancy_lift x remaining_season_days) x severity / effort
 *
 * The score represents approximate revenue impact: "How much additional revenue
 * could we capture by fixing this property, given how much season is left?"
 *
 * Higher score = fix this first.
 */
export function calculatePriority(input: PriorityInput): number {
  const adr = input.adr != null && input.adr > 0 ? input.adr : DEFAULT_ADR;

  // No issues and no opportunities = no priority
  if (input.issue_count === 0 && input.opportunity_count === 0) {
    return 0;
  }

  // If there are issues, calculate based on severity and revenue impact
  if (input.issue_count > 0 && input.max_severity != null) {
    const severityMultiplier = SEVERITY_MULTIPLIERS[input.max_severity] ?? 1.0;
    const effortDivisor = EFFORT_DIVISORS[input.effort] ?? 1.5;

    // Use provided occupancy lift or estimate from severity
    const occupancyLift = input.projected_occupancy_lift_pct > 0
      ? input.projected_occupancy_lift_pct
      : (SEVERITY_TO_OCCUPANCY_LIFT[input.max_severity] ?? 5);

    // Revenue impact = ADR x (occupancy_lift/100) x remaining_days
    const revenueImpact = adr * (occupancyLift / 100) * input.remaining_season_days;

    // Final score = revenue_impact x severity / effort
    const score = (revenueImpact * severityMultiplier) / effortDivisor;

    return Math.round(score * 100) / 100;
  }

  // Pure opportunity (value capture, no issues)
  if (input.opportunity_count > 0) {
    const effortDivisor = EFFORT_DIVISORS[input.effort] ?? 1.5;
    // Opportunity score: ADR-weighted base score x opportunity count
    const score = (OPPORTUNITY_BASE_SCORE * (adr / DEFAULT_ADR) * input.opportunity_count * input.remaining_season_days) / effortDivisor;
    return Math.round(score * 100) / 100;
  }

  return 0;
}

/**
 * Estimate effort level based on the type of recommendation.
 * Used when effort isn't explicitly set.
 */
export function estimateEffort(recommendationType: string): EffortLevel {
  const effortMap: Record<string, EffortLevel> = {
    hero_photo_swap: 'low',
    title_rewrite: 'low',
    description_update: 'medium',
    amenity_add: 'medium',
    price_increase: 'low',
    price_decrease: 'low',
    cancellation_change: 'medium',
    checkout_time_change: 'high',
  };
  return effortMap[recommendationType] ?? 'medium';
}

/**
 * Calculate remaining season days for a given market.
 * Uses rough seasonal calendars for Southwest VRM markets.
 */
export function getRemainingSeasonDays(market: string, currentDate: Date): number {
  // Season end dates by market (approximate)
  const seasonEndDates: Record<string, { peak_end_month: number; peak_end_day: number }> = {
    scottsdale:    { peak_end_month: 4, peak_end_day: 30 },  // Peak ends end of April
    tucson:        { peak_end_month: 4, peak_end_day: 30 },
    sedona:        { peak_end_month: 10, peak_end_day: 31 }, // Year-round with fall peak
    coachella:     { peak_end_month: 4, peak_end_day: 30 },  // Desert season ends April
    central_coast: { peak_end_month: 9, peak_end_day: 30 },  // Summer peak
    orange_county: { peak_end_month: 9, peak_end_day: 30 },
    lake_arrowhead:{ peak_end_month: 9, peak_end_day: 30 },  // Summer peak in mountains
  };

  const seasonEnd = seasonEndDates[market];
  if (!seasonEnd) {
    // Default: 90 days remaining
    return 90;
  }

  const endDate = new Date(currentDate.getFullYear(), seasonEnd.peak_end_month, seasonEnd.peak_end_day);

  // If we're past the peak end, calculate days until next peak (shoulder/low season work)
  if (currentDate > endDate) {
    // In off-season, still worth optimizing — use 60 days as floor
    return 60;
  }

  const diffMs = endDate.getTime() - currentDate.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  return Math.max(diffDays, 1);
}
