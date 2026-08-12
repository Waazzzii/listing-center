// agents/discount-optimizer/strategy.ts
// Core discount strategy engine. Analyzes each property's pricing, occupancy,
// and exposure metrics to determine the optimal discount configuration that
// hits Airbnb merchandising thresholds WITHOUT conceding owner revenue.
//
// THE PLAY:
// Airbnb shows strikethrough pricing at 10% off the 60-day median ADR,
// and features listings in guest emails at 20% off. These visual merchandising
// signals drive outsized impressions and clicks — 15-50% more traffic.
//
// The trick: if we raise the base price strategically, then apply a discount
// that hits the threshold, the guest sees a "deal" (strikethrough styling)
// while the owner nets the same or higher effective rate.
//
// Example:
//   60-day median: $300
//   Current base: $290
//   Strategy: raise base to $340, apply 15% custom promotion
//   Guest sees: $289 (was $340) with strikethrough ← Airbnb shows this prominently
//   Owner nets: $289 vs $290 before = roughly flat, but now with 20-30% more eyeballs

import type { CommandGridRow } from '../../src/lib/types';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface DiscountOpportunity {
  property_id: string;
  property_name: string;
  market: string;
  quality_tier: string;

  // Current state
  current_base_price: number;
  current_revpar: number | null;
  current_occupancy_30d: number | null;
  current_occupancy_120d: number | null;
  current_impression_rate: number | null;
  current_pace_status: string | null;
  estimated_60d_median: number;

  // Strategy recommendation
  strategy: DiscountStrategy;
  actions: DiscountAction[];
  estimated_exposure_lift: string;
  risk_level: 'low' | 'medium' | 'high';
  rationale: string;
}

export type DiscountStrategyType =
  | 'strikethrough_play'       // Raise base + discount to hit 10% threshold
  | 'email_placement_play'     // Raise base + discount to hit 20% threshold
  | 'los_incentive'            // Weekly/monthly discounts for longer stays
  | 'early_bird_lockdown'      // Early bird for high-season revenue lock-in
  | 'last_minute_fill'         // Last-minute for gap filling
  | 'combined_stack'           // Multiple discount types working together
  | 'no_action';               // Property doesn't need discount optimization

export interface DiscountStrategy {
  type: DiscountStrategyType;
  new_base_price: number | null;       // Suggested base price (may be raised)
  base_price_change_pct: number | null; // % change from current
  effective_guest_rate: number;         // What guest actually pays after discount
  effective_rate_change_pct: number;    // % change in what guest pays vs current
  owner_net_impact: string;            // "flat", "slight_increase", "slight_decrease", "increase"
  merchandising_unlocked: string[];    // ["strikethrough", "email_placement", "listing_callout"]
}

export interface DiscountAction {
  action_type: string;           // discount_set, promotion_set, rate_change
  execution_channel: string;     // wheelhouse_api, playwright_airbnb
  discount_type?: string;        // custom_promotion, weekly, monthly, early_bird, last_minute
  percentage?: number;
  new_base_price?: number;
  start_date?: string;
  end_date?: string;
  priority: 'critical' | 'high' | 'normal' | 'low';
  description: string;
}

// ─── Thresholds (from Airbnb documentation) ─────────────────────────────────

const STRIKETHROUGH_THRESHOLD = 0.10;  // 10% off 60-day median
const EMAIL_PLACEMENT_THRESHOLD = 0.20; // 20% off 60-day median
const LISTING_CALLOUT_THRESHOLD = 0.15; // 15% off for callout badge
const CUSTOM_PROMO_MIN = 0.10;          // Minimum custom promotion percentage

// Safety guardrails
const MAX_BASE_PRICE_INCREASE_PCT = 0.25;  // Never raise base more than 25%
const MIN_EFFECTIVE_RATE_FLOOR_PCT = 0.90;  // Effective rate never below 90% of current
const MAX_DISCOUNT_PCT = 0.25;              // Cap discounts at 25%

// ─── Occupancy thresholds for strategy selection ────────────────────────────

const OCCUPANCY_LOW = 0.40;          // Below this = aggressive gap filling needed
const OCCUPANCY_MODERATE = 0.60;     // Below this = proactive discounting
const OCCUPANCY_HEALTHY = 0.75;      // Above this = selective discounting only
const OCCUPANCY_HIGH = 0.85;         // Above this = no discounting, raise rates

// ─── Core Analysis ──────────────────────────────────────────────────────────

/**
 * Analyze a property and generate discount optimization recommendations.
 */
export function analyzeDiscountOpportunity(row: CommandGridRow): DiscountOpportunity | null {
  const basePrice = row.wh_base_price;
  if (!basePrice || basePrice <= 0) return null;
  if (!row.airbnb_listing_id) return null; // Need Airbnb listing

  // Estimate the 60-day median from available data.
  // Best proxy: average of current base price and Airbnb reported nightly rate.
  // In production, this would come from Wheelhouse price history or Airbnb API.
  const airbnbRate = row.airbnb_avg_nightly_rate || basePrice;
  const estimated60dMedian = Math.round((basePrice + airbnbRate) / 2);

  const occ30d = row.wh_occupancy_30d;
  const occ120d = row.wh_occupancy_120d;
  const impressionRate = row.airbnb_first_page_impression_rate;
  const paceStatus = row.rev_pace_status;

  // Determine urgency context
  const isUnderexposed = impressionRate !== null && impressionRate < 0.30;
  const isPacingBehind = paceStatus === 'behind' || paceStatus === 'at_risk';
  const isLowOccupancy = occ30d !== null && occ30d < OCCUPANCY_MODERATE;
  const isHighOccupancy = occ30d !== null && occ30d > OCCUPANCY_HIGH;

  // Skip if property is performing well — don't fix what isn't broken
  if (!isUnderexposed && !isPacingBehind && !isLowOccupancy && occ30d !== null && occ30d > OCCUPANCY_HEALTHY) {
    return null;
  }

  // Skip if occupancy is high — raise rates instead, don't discount
  if (isHighOccupancy && !isUnderexposed) {
    return null;
  }

  // Select strategy based on context
  const strategy = selectStrategy(basePrice, estimated60dMedian, occ30d, occ120d, impressionRate, paceStatus);
  const actions = generateActions(row, strategy, estimated60dMedian);

  if (strategy.type === 'no_action') return null;

  // Calculate risk level
  let riskLevel: 'low' | 'medium' | 'high' = 'low';
  if (strategy.base_price_change_pct && strategy.base_price_change_pct > 0.15) riskLevel = 'medium';
  if (strategy.effective_rate_change_pct < -0.05) riskLevel = 'medium';
  if (strategy.effective_rate_change_pct < -0.10) riskLevel = 'high';

  return {
    property_id: row.property_id,
    property_name: row.property_name,
    market: row.market,
    quality_tier: row.quality_tier,
    current_base_price: basePrice,
    current_revpar: row.wh_revpar,
    current_occupancy_30d: occ30d,
    current_occupancy_120d: occ120d,
    current_impression_rate: impressionRate,
    current_pace_status: paceStatus,
    estimated_60d_median: estimated60dMedian,
    strategy,
    actions,
    estimated_exposure_lift: estimateExposureLift(strategy),
    risk_level: riskLevel,
    rationale: buildRationale(row, strategy),
  };
}

// ─── Strategy Selection ─────────────────────────────────────────────────────

function selectStrategy(
  basePrice: number,
  median60d: number,
  occ30d: number | null,
  occ120d: number | null,
  impressionRate: number | null,
  paceStatus: string | null,
): DiscountStrategy {

  const isUnderexposed = impressionRate !== null && impressionRate < 0.30;
  const isPacingBehind = paceStatus === 'behind' || paceStatus === 'at_risk';
  const isLowOcc = occ30d !== null && occ30d < OCCUPANCY_LOW;
  const isModerateOcc = occ30d !== null && occ30d < OCCUPANCY_MODERATE;

  // ───────────────────────────────────────────────────────────────────────
  // SCENARIO 1: Severely underexposed + low occupancy
  // Play: Email placement (20% off median) — maximum merchandising impact
  // ───────────────────────────────────────────────────────────────────────
  if ((isUnderexposed && isLowOcc) || (isPacingBehind && isLowOcc)) {
    return buildEmailPlacementStrategy(basePrice, median60d);
  }

  // ───────────────────────────────────────────────────────────────────────
  // SCENARIO 2: Underexposed or pacing behind (moderate occupancy)
  // Play: Strikethrough (10% off median) — visibility boost without deep discount
  // ───────────────────────────────────────────────────────────────────────
  if (isUnderexposed || isPacingBehind || isModerateOcc) {
    return buildStrikethroughStrategy(basePrice, median60d);
  }

  // ───────────────────────────────────────────────────────────────────────
  // SCENARIO 3: Moderate performance, could use a nudge
  // Play: LOS discounts to incentivize longer stays
  // ───────────────────────────────────────────────────────────────────────
  return buildLOSStrategy(basePrice);
}

// ─── Strategy Builders ──────────────────────────────────────────────────────

function buildEmailPlacementStrategy(basePrice: number, median60d: number): DiscountStrategy {
  // Target: effective rate 20% below 60-day median → email placement
  const targetEffective = Math.round(median60d * (1 - EMAIL_PLACEMENT_THRESHOLD));

  // Work backwards: what base price + discount combo gets us there?
  // Use 20% custom promotion (Airbnb's max standard tier)
  const discountPct = 0.20;
  const requiredBase = Math.round(targetEffective / (1 - discountPct));

  // Guardrail: don't raise base more than 25%
  const cappedBase = Math.min(requiredBase, Math.round(basePrice * (1 + MAX_BASE_PRICE_INCREASE_PCT)));
  const actualEffective = Math.round(cappedBase * (1 - discountPct));

  // Check if we actually hit the email threshold after capping
  const actualDiscountFromMedian = (median60d - actualEffective) / median60d;
  const unlockedMerchandising: string[] = ['price_breakdown'];
  if (actualDiscountFromMedian >= STRIKETHROUGH_THRESHOLD) unlockedMerchandising.push('strikethrough');
  if (actualDiscountFromMedian >= LISTING_CALLOUT_THRESHOLD) unlockedMerchandising.push('listing_callout');
  if (actualDiscountFromMedian >= EMAIL_PLACEMENT_THRESHOLD) unlockedMerchandising.push('email_placement');

  const effectiveChange = (actualEffective - basePrice) / basePrice;

  return {
    type: 'email_placement_play',
    new_base_price: cappedBase,
    base_price_change_pct: (cappedBase - basePrice) / basePrice,
    effective_guest_rate: actualEffective,
    effective_rate_change_pct: effectiveChange,
    owner_net_impact: effectiveChange > 0.02 ? 'increase' : effectiveChange > -0.02 ? 'flat' : 'slight_decrease',
    merchandising_unlocked: unlockedMerchandising,
  };
}

function buildStrikethroughStrategy(basePrice: number, median60d: number): DiscountStrategy {
  // Target: effective rate 10-15% below 60-day median → strikethrough
  const targetEffective = Math.round(median60d * (1 - STRIKETHROUGH_THRESHOLD));

  // Use 15% custom promotion (sweet spot: hits strikethrough + listing callout)
  const discountPct = 0.15;
  const requiredBase = Math.round(targetEffective / (1 - discountPct));
  const cappedBase = Math.min(requiredBase, Math.round(basePrice * (1 + MAX_BASE_PRICE_INCREASE_PCT)));
  const actualEffective = Math.round(cappedBase * (1 - discountPct));

  const actualDiscountFromMedian = (median60d - actualEffective) / median60d;
  const unlockedMerchandising: string[] = ['price_breakdown'];
  if (actualDiscountFromMedian >= STRIKETHROUGH_THRESHOLD) unlockedMerchandising.push('strikethrough');
  if (actualDiscountFromMedian >= LISTING_CALLOUT_THRESHOLD) unlockedMerchandising.push('listing_callout');
  if (actualDiscountFromMedian >= EMAIL_PLACEMENT_THRESHOLD) unlockedMerchandising.push('email_placement');

  const effectiveChange = (actualEffective - basePrice) / basePrice;

  return {
    type: 'strikethrough_play',
    new_base_price: cappedBase,
    base_price_change_pct: (cappedBase - basePrice) / basePrice,
    effective_guest_rate: actualEffective,
    effective_rate_change_pct: effectiveChange,
    owner_net_impact: effectiveChange > 0.02 ? 'increase' : effectiveChange > -0.02 ? 'flat' : 'slight_decrease',
    merchandising_unlocked: unlockedMerchandising,
  };
}

function buildLOSStrategy(basePrice: number): DiscountStrategy {
  // Weekly (7+) and monthly (28+) discounts reduce turnover costs
  // ~$150 saved per avoided turnover × expected additional bookings
  return {
    type: 'los_incentive',
    new_base_price: null, // No base price change needed
    base_price_change_pct: null,
    effective_guest_rate: Math.round(basePrice * 0.92), // ~8% blended discount
    effective_rate_change_pct: -0.08,
    owner_net_impact: 'flat', // Turnover cost savings offset the discount
    merchandising_unlocked: ['price_breakdown', 'strikethrough'],
  };
}

// ─── Action Generation ──────────────────────────────────────────────────────

function generateActions(
  row: CommandGridRow,
  strategy: DiscountStrategy,
  median60d: number,
): DiscountAction[] {
  const actions: DiscountAction[] = [];

  switch (strategy.type) {
    case 'email_placement_play':
    case 'strikethrough_play': {
      // Step 1: Raise base price via Wheelhouse
      if (strategy.new_base_price && strategy.new_base_price !== row.wh_base_price) {
        actions.push({
          action_type: 'rate_change',
          execution_channel: 'wheelhouse_api',
          new_base_price: strategy.new_base_price,
          priority: 'high',
          description: `Raise base price from $${row.wh_base_price} to $${strategy.new_base_price} (${((strategy.base_price_change_pct || 0) * 100).toFixed(0)}% increase) to create room for discount merchandising.`,
        });
      }

      // Step 2: Set custom promotion on Airbnb
      const promoPct = strategy.type === 'email_placement_play' ? 20 : 15;
      actions.push({
        action_type: 'promotion_set',
        execution_channel: 'playwright_airbnb',
        discount_type: 'custom_promotion',
        percentage: promoPct,
        priority: 'high',
        description: `Set ${promoPct}% custom promotion on Airbnb. Guest sees $${strategy.effective_guest_rate} (was $${strategy.new_base_price || row.wh_base_price}) with strikethrough. 60-day median: $${median60d}. Unlocks: ${strategy.merchandising_unlocked.join(', ')}.`,
      });

      // Step 3 (if applicable): Set LOS discounts too
      if (strategy.type === 'email_placement_play') {
        actions.push({
          action_type: 'discount_set',
          execution_channel: 'playwright_airbnb',
          discount_type: 'weekly',
          percentage: 10,
          priority: 'normal',
          description: 'Add 10% weekly discount (7+ nights) — reduces turnover costs and stacks with promotion visibility.',
        });
      }
      break;
    }

    case 'los_incentive': {
      actions.push({
        action_type: 'discount_set',
        execution_channel: 'playwright_airbnb',
        discount_type: 'weekly',
        percentage: 10,
        priority: 'normal',
        description: '10% weekly discount (7+ nights). Each avoided turnover saves ~$150 in housekeeping/laundry. Hits strikethrough threshold for LOS discounts.',
      });
      actions.push({
        action_type: 'discount_set',
        execution_channel: 'playwright_airbnb',
        discount_type: 'monthly',
        percentage: 20,
        priority: 'normal',
        description: '20% monthly discount (28+ nights). Hits email placement threshold. Monthly stays dramatically reduce turnover costs and provide stable revenue.',
      });
      break;
    }
  }

  return actions;
}

// ─── Exposure Lift Estimation ───────────────────────────────────────────────

function estimateExposureLift(strategy: DiscountStrategy): string {
  const m = strategy.merchandising_unlocked;
  if (m.includes('email_placement')) return '+30-50% impression rate (email placement + strikethrough)';
  if (m.includes('listing_callout')) return '+20-35% impression rate (listing callout + strikethrough)';
  if (m.includes('strikethrough')) return '+15-25% impression rate (strikethrough pricing)';
  return '+5-10% impression rate (price breakdown display)';
}

// ─── Rationale Builder ──────────────────────────────────────────────────────

function buildRationale(row: CommandGridRow, strategy: DiscountStrategy): string {
  const parts: string[] = [];

  // Context
  if (row.wh_occupancy_30d !== null && row.wh_occupancy_30d < OCCUPANCY_MODERATE) {
    parts.push(`30-day occupancy is ${(row.wh_occupancy_30d * 100).toFixed(0)}% — below 60% threshold.`);
  }
  if (row.airbnb_first_page_impression_rate !== null && row.airbnb_first_page_impression_rate < 0.30) {
    parts.push(`First page impression rate is ${(row.airbnb_first_page_impression_rate * 100).toFixed(0)}% — underexposed.`);
  }
  if (row.rev_pace_status === 'behind' || row.rev_pace_status === 'at_risk') {
    parts.push(`Revenue is pacing ${row.rev_pace_status === 'at_risk' ? 'at risk' : 'behind'} projection.`);
  }

  // Strategy
  switch (strategy.type) {
    case 'email_placement_play':
      parts.push(`Email placement play: raise base price ${((strategy.base_price_change_pct || 0) * 100).toFixed(0)}%, apply 20% custom promotion.`);
      parts.push(`Guest sees $${strategy.effective_guest_rate} with strikethrough — Airbnb features in guest emails.`);
      parts.push(`Owner net impact: ${strategy.owner_net_impact}.`);
      break;
    case 'strikethrough_play':
      parts.push(`Strikethrough play: raise base price ${((strategy.base_price_change_pct || 0) * 100).toFixed(0)}%, apply 15% custom promotion.`);
      parts.push(`Guest sees strikethrough pricing — drives +15-25% more impressions.`);
      parts.push(`Owner net impact: ${strategy.owner_net_impact}.`);
      break;
    case 'los_incentive':
      parts.push('Length-of-stay incentive: 10% weekly + 20% monthly discounts.');
      parts.push('Longer stays reduce turnover costs (~$150/turn saved), offsetting the discount.');
      break;
  }

  return parts.join(' ');
}

// ─── Batch Analysis ─────────────────────────────────────────────────────────

/**
 * Analyze an entire portfolio and return discount opportunities.
 */
export function analyzePortfolio(rows: CommandGridRow[]): DiscountOpportunity[] {
  const opportunities: DiscountOpportunity[] = [];

  for (const row of rows) {
    if (!row.is_active) continue;
    const opp = analyzeDiscountOpportunity(row);
    if (opp) opportunities.push(opp);
  }

  // Sort by impact: email placement plays first, then strikethrough, then LOS
  const typeOrder: Record<string, number> = {
    email_placement_play: 1,
    strikethrough_play: 2,
    combined_stack: 3,
    los_incentive: 4,
    last_minute_fill: 5,
    early_bird_lockdown: 6,
    no_action: 99,
  };

  opportunities.sort((a, b) =>
    (typeOrder[a.strategy.type] || 50) - (typeOrder[b.strategy.type] || 50)
  );

  return opportunities;
}
