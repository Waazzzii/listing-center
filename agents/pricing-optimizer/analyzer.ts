// agents/pricing-optimizer/analyzer.ts
// Analyzes Wheelhouse data to identify pricing optimization opportunities.
// Uses base price alignment, occupancy trends, and revenue pace to determine
// when to raise, lower, or adjust pricing strategy.

import type { CommandGridRow } from '../../src/lib/types';

export interface PricingOpportunity {
  property_id: string;
  property_name: string;
  market: string;
  quality_tier: string;
  recommendation: PricingRecommendation;
  actions: PricingAction[];
  rationale: string;
  confidence: number;
}

export type PricingRecType =
  | 'raise_base'          // Occupancy high, room to raise
  | 'lower_base'          // Occupancy critically low, need bookings
  | 'align_to_wheelhouse' // Base price is significantly off from Wheelhouse recommended
  | 'event_premium'       // Upcoming events warrant premium pricing
  | 'gap_fill'            // Short gaps between bookings, lower min to fill
  | 'no_action';

export interface PricingRecommendation {
  type: PricingRecType;
  current_base: number;
  recommended_base: number;
  change_pct: number;
  expected_revpar_impact: string;
}

export interface PricingAction {
  action_type: string;
  execution_channel: 'wheelhouse_api';
  payload: Record<string, unknown>;
  priority: 'critical' | 'high' | 'normal' | 'low';
  description: string;
}

// ─── Thresholds ─────────────────────────────────────────────────────────────

const ALIGNMENT_THRESHOLD = 15;   // % off Wheelhouse recommended = misaligned
const HIGH_OCC_THRESHOLD = 0.80;
const LOW_OCC_THRESHOLD = 0.35;
const MODERATE_OCC_THRESHOLD = 0.55;

/**
 * Analyze a property's pricing position and generate recommendations.
 */
export function analyzePricing(row: CommandGridRow): PricingOpportunity | null {
  const base = row.wh_base_price;
  const recommended = row.wh_recommended_price;
  if (!base || base <= 0) return null;

  const occ30d = row.wh_occupancy_30d;
  const occ120d = row.wh_occupancy_120d;
  const alignment = row.wh_price_alignment;
  const paceStatus = row.rev_pace_status;
  const autoRates = row.wh_auto_rates;

  // Skip if auto-rates is on and price is well-aligned — Wheelhouse is handling it
  if (autoRates && alignment !== null && Math.abs(alignment) <= 5) {
    return null;
  }

  let rec: PricingRecommendation | null = null;
  let rationale = '';
  let confidence = 60;

  // ─── CASE 1: High occupancy → raise base price ────────────────────
  if (occ30d !== null && occ30d > HIGH_OCC_THRESHOLD && occ120d !== null && occ120d > 0.65) {
    const raisePct = occ30d > 0.90 ? 0.15 : 0.10;
    const newBase = Math.round(base * (1 + raisePct));

    rec = {
      type: 'raise_base',
      current_base: base,
      recommended_base: newBase,
      change_pct: raisePct,
      expected_revpar_impact: `+${(raisePct * 100 * 0.7).toFixed(0)}-${(raisePct * 100).toFixed(0)}% RevPAR`,
    };
    rationale = `30d occupancy at ${(occ30d * 100).toFixed(0)}% and 120d at ${(occ120d * 100).toFixed(0)}%. Demand exceeds current pricing. Raising base ${(raisePct * 100).toFixed(0)}% from $${base} to $${newBase}. Expect minimal occupancy impact at this demand level.`;
    confidence = 75;
  }

  // ─── CASE 2: Critically low occupancy → lower base price ──────────
  else if (occ30d !== null && occ30d < LOW_OCC_THRESHOLD && paceStatus === 'at_risk') {
    const lowerPct = 0.10;
    const newBase = Math.round(base * (1 - lowerPct));

    rec = {
      type: 'lower_base',
      current_base: base,
      recommended_base: newBase,
      change_pct: -lowerPct,
      expected_revpar_impact: 'Occupancy recovery expected to offset rate decrease',
    };
    rationale = `30d occupancy at ${(occ30d * 100).toFixed(0)}% and revenue pacing at risk. Lowering base 10% from $${base} to $${newBase} to stimulate demand. Combined with discount strategy for maximum visibility.`;
    confidence = 65;
  }

  // ─── CASE 3: Significant misalignment with Wheelhouse recommended ─
  else if (recommended && alignment !== null && Math.abs(alignment) > ALIGNMENT_THRESHOLD) {
    const direction = alignment > 0 ? 'above' : 'below';
    // Move partway toward recommended (don't jump all the way)
    const moveRatio = 0.6;
    const newBase = Math.round(base + (recommended - base) * moveRatio);

    rec = {
      type: 'align_to_wheelhouse',
      current_base: base,
      recommended_base: newBase,
      change_pct: (newBase - base) / base,
      expected_revpar_impact: direction === 'above' ? 'Better occupancy at aligned rate' : 'Capture margin at higher rate',
    };
    rationale = `Base price is ${Math.abs(alignment).toFixed(0)}% ${direction} Wheelhouse recommended ($${recommended}). Adjusting 60% toward recommendation: $${base} → $${newBase}. ${direction === 'above' ? 'Current pricing may be suppressing demand.' : 'Current pricing is leaving revenue on the table.'}`;
    confidence = 70;
  }

  // ─── CASE 4: Moderate underperformance ────────────────────────────
  else if (occ30d !== null && occ30d < MODERATE_OCC_THRESHOLD && paceStatus === 'behind') {
    const lowerPct = 0.05;
    const newBase = Math.round(base * (1 - lowerPct));

    rec = {
      type: 'lower_base',
      current_base: base,
      recommended_base: newBase,
      change_pct: -lowerPct,
      expected_revpar_impact: 'Moderate occupancy improvement expected',
    };
    rationale = `30d occupancy at ${(occ30d * 100).toFixed(0)}%, pacing behind projection. Modest 5% base price reduction from $${base} to $${newBase}.`;
    confidence = 55;
  }

  if (!rec) return null;

  const actions: PricingAction[] = [{
    action_type: 'rate_change',
    execution_channel: 'wheelhouse_api',
    payload: {
      listing_id: row.airbnb_listing_id,
      base_price: rec.recommended_base,
      channel: 'airbnb',
    },
    priority: rec.type === 'raise_base' ? 'normal' : rec.type === 'lower_base' && paceStatus === 'at_risk' ? 'high' : 'normal',
    description: `Change base price from $${rec.current_base} to $${rec.recommended_base} (${rec.change_pct > 0 ? '+' : ''}${(rec.change_pct * 100).toFixed(0)}%)`,
  }];

  return {
    property_id: row.property_id,
    property_name: row.property_name,
    market: row.market,
    quality_tier: row.quality_tier,
    recommendation: rec,
    actions,
    rationale,
    confidence,
  };
}

/**
 * Analyze entire portfolio for pricing opportunities.
 */
export function analyzePortfolioPricing(rows: CommandGridRow[]): PricingOpportunity[] {
  const opportunities: PricingOpportunity[] = [];

  for (const row of rows) {
    if (!row.is_active) continue;
    const opp = analyzePricing(row);
    if (opp) opportunities.push(opp);
  }

  // Sort: raise_base first (revenue capture), then lower_base (urgent), then alignment
  const typeOrder: Record<string, number> = { raise_base: 1, lower_base: 2, align_to_wheelhouse: 3, gap_fill: 4 };
  opportunities.sort((a, b) => (typeOrder[a.recommendation.type] || 50) - (typeOrder[b.recommendation.type] || 50));

  return opportunities;
}
