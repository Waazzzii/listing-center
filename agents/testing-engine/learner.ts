// agents/testing-engine/learner.ts
// Learning Recorder — writes outcomes from evaluated actions to lc_test_learnings.
// Agents query these learnings to set confidence scores on future proposals.

import { getSupabase } from '../../src/lib/supabase';
import type { EvaluationResult } from './evaluator';

/**
 * Record learnings from evaluated actions.
 * Merges with existing learnings for the same action_type+context to build sample size.
 */
export async function recordLearnings(results: EvaluationResult[]): Promise<number> {
  const supabase = getSupabase();
  let recorded = 0;

  for (const result of results) {
    // Fetch action context for the learning
    const { data: action } = await supabase
      .from('lc_agent_actions')
      .select('action_type, action_category, payload')
      .eq('id', result.action_id)
      .single();

    if (!action) continue;

    // Fetch property context
    const { data: property } = await supabase
      .from('lc_properties')
      .select('market, quality_tier, property_type, bedrooms')
      .eq('id', result.property_id)
      .single();

    if (!property) continue;

    // Determine season based on current month
    const month = new Date().getMonth() + 1;
    const season = getSeason(property.market, month);

    // Check for existing learning with same context
    const { data: existing } = await supabase
      .from('lc_test_learnings')
      .select('id, sample_size, confidence, primary_metric_lift_pct')
      .eq('action_type', action.action_type)
      .eq('action_category', action.action_category)
      .eq('market', property.market)
      .eq('quality_tier', property.quality_tier)
      .eq('outcome', result.outcome)
      .limit(1)
      .single();

    if (existing) {
      // Update existing learning — running average
      const newSampleSize = (existing.sample_size || 1) + 1;
      const prevLift = existing.primary_metric_lift_pct || 0;
      const newLift = result.lift_pct || 0;
      const avgLift = ((prevLift * (newSampleSize - 1)) + newLift) / newSampleSize;

      // Confidence grows with sample size (capped at 95)
      const newConfidence = Math.min(95, 40 + (newSampleSize * 5));

      await supabase
        .from('lc_test_learnings')
        .update({
          sample_size: newSampleSize,
          primary_metric_lift_pct: avgLift,
          confidence: newConfidence,
        })
        .eq('id', existing.id);
    } else {
      // Create new learning
      const changeSummary = buildChangeSummary(action.action_type, action.payload as Record<string, unknown>);

      await supabase.from('lc_test_learnings').insert({
        action_type: action.action_type,
        action_category: action.action_category,
        market: property.market,
        quality_tier: property.quality_tier,
        season,
        property_type: property.property_type,
        bedrooms: property.bedrooms,
        change_summary: changeSummary,
        payload_pattern: abstractPayload(action.payload as Record<string, unknown>),
        outcome: result.outcome,
        primary_metric_name: result.primary_metric,
        primary_metric_before: result.before_value,
        primary_metric_after: result.after_value,
        primary_metric_lift_pct: result.lift_pct,
        metrics_before: result.all_metrics_before,
        metrics_after: result.all_metrics_after,
        soak_period_days: null,
        sample_size: 1,
        confidence: 45, // Initial confidence
        action_id: result.action_id,
      });
    }

    recorded++;
  }

  return recorded;
}

/**
 * Query learnings to predict confidence for a proposed action.
 * Used by optimization agents when setting confidence_score on new proposals.
 */
export async function getConfidenceForAction(params: {
  action_type: string;
  action_category: string;
  market: string;
  quality_tier: string;
}): Promise<{ confidence: number; sample_size: number; avg_lift_pct: number | null }> {
  const supabase = getSupabase();

  // Look for learnings matching this context (exact match first, then broader)
  const { data: exactMatch } = await supabase
    .from('lc_test_learnings')
    .select('confidence, sample_size, primary_metric_lift_pct, outcome')
    .eq('action_type', params.action_type)
    .eq('market', params.market)
    .eq('quality_tier', params.quality_tier)
    .order('sample_size', { ascending: false })
    .limit(5);

  if (exactMatch && exactMatch.length > 0) {
    return aggregateLearnings(exactMatch);
  }

  // Broader: same action type + market (any tier)
  const { data: marketMatch } = await supabase
    .from('lc_test_learnings')
    .select('confidence, sample_size, primary_metric_lift_pct, outcome')
    .eq('action_type', params.action_type)
    .eq('market', params.market)
    .order('sample_size', { ascending: false })
    .limit(10);

  if (marketMatch && marketMatch.length > 0) {
    const result = aggregateLearnings(marketMatch);
    result.confidence = Math.max(result.confidence - 10, 30); // Penalty for broader match
    return result;
  }

  // Broadest: same action type globally
  const { data: globalMatch } = await supabase
    .from('lc_test_learnings')
    .select('confidence, sample_size, primary_metric_lift_pct, outcome')
    .eq('action_type', params.action_type)
    .order('sample_size', { ascending: false })
    .limit(20);

  if (globalMatch && globalMatch.length > 0) {
    const result = aggregateLearnings(globalMatch);
    result.confidence = Math.max(result.confidence - 20, 25); // Bigger penalty
    return result;
  }

  // No data — return default low confidence
  return { confidence: 40, sample_size: 0, avg_lift_pct: null };
}

/**
 * Aggregate multiple learning records into a single confidence prediction.
 */
function aggregateLearnings(
  learnings: Array<{ confidence: number | null; sample_size: number | null; primary_metric_lift_pct: number | null; outcome: string }>
): { confidence: number; sample_size: number; avg_lift_pct: number | null } {
  const totalSamples = learnings.reduce((sum, l) => sum + (l.sample_size || 1), 0);
  const positiveCount = learnings.filter(l => l.outcome === 'positive').length;
  const negativeCount = learnings.filter(l => l.outcome === 'negative').length;

  // Success rate influences confidence
  const successRate = learnings.length > 0 ? positiveCount / learnings.length : 0.5;

  // Weighted average lift
  let totalLift = 0;
  let liftCount = 0;
  for (const l of learnings) {
    if (l.primary_metric_lift_pct !== null) {
      totalLift += l.primary_metric_lift_pct * (l.sample_size || 1);
      liftCount += l.sample_size || 1;
    }
  }
  const avgLift = liftCount > 0 ? totalLift / liftCount : null;

  // Confidence formula:
  // Base: 40 (no data) → grows with samples and success rate
  // Penalty for negative outcomes
  const sampleBonus = Math.min(30, totalSamples * 3);
  const successBonus = successRate * 25;
  const negativePenalty = negativeCount > positiveCount ? 15 : 0;
  const confidence = Math.min(95, Math.max(25, 40 + sampleBonus + successBonus - negativePenalty));

  return {
    confidence: Math.round(confidence),
    sample_size: totalSamples,
    avg_lift_pct: avgLift !== null ? Math.round(avgLift * 10) / 10 : null,
  };
}

/**
 * Determine season based on market and month.
 */
function getSeason(market: string, month: number): string {
  // Desert markets (AZ): peak in winter, low in summer
  const desertMarkets = ['scottsdale', 'tucson', 'phoenix'];
  if (desertMarkets.some(m => market.toLowerCase().includes(m))) {
    if ([1, 2, 3, 10, 11, 12].includes(month)) return 'peak';
    if ([4, 5, 9].includes(month)) return 'shoulder';
    return 'low';
  }

  // Mountain/cool markets: peak in summer
  if (market.toLowerCase().includes('sedona') || market.toLowerCase().includes('flagstaff') || market.toLowerCase().includes('arrowhead')) {
    if ([6, 7, 8].includes(month)) return 'peak';
    if ([5, 9, 10].includes(month)) return 'shoulder';
    return 'low';
  }

  // CA coastal: peak in summer
  if ([6, 7, 8].includes(month)) return 'peak';
  if ([3, 4, 5, 9, 10].includes(month)) return 'shoulder';
  return 'low';
}

/**
 * Build a human-readable change summary from an action type and payload.
 */
function buildChangeSummary(actionType: string, payload: Record<string, unknown>): string {
  switch (actionType) {
    case 'rate_change':
      return `Base price change to $${payload.base_price || '?'}`;
    case 'discount_set':
    case 'promotion_set':
      return `${payload.discount_type || 'Discount'} set to ${payload.discount_pct || '?'}%`;
    case 'title_update':
      return 'Listing title rewrite for CTR optimization';
    case 'description_update':
      return 'Description update for conversion optimization';
    case 'amenity_toggle':
      return 'Amenity completeness update';
    case 'photo_reorder':
      return 'Hero photo reorder for CTR';
    default:
      return `${actionType} change`;
  }
}

/**
 * Abstract a payload into a pattern (removing specific values, keeping structure).
 * Used for pattern matching in future confidence lookups.
 */
function abstractPayload(payload: Record<string, unknown>): Record<string, unknown> {
  const pattern: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(payload)) {
    if (typeof value === 'number') {
      // Categorize numbers into ranges instead of exact values
      if (key.includes('price') || key.includes('rate')) {
        pattern[key] = value > 500 ? 'high' : value > 200 ? 'mid' : 'low';
      } else if (key.includes('pct') || key.includes('discount')) {
        pattern[key] = value > 20 ? 'aggressive' : value > 10 ? 'moderate' : 'conservative';
      } else {
        pattern[key] = typeof value;
      }
    } else if (typeof value === 'boolean') {
      pattern[key] = value;
    } else if (typeof value === 'string') {
      pattern[key] = 'string';
    }
  }
  return pattern;
}
