// agents/testing-engine/evaluator.ts
// Measurement Evaluator — checks completed actions whose soak period has elapsed.
// Compares before/after metrics, determines outcome, triggers revert if needed.

import { getSupabase } from '../../src/lib/supabase';
import type { AgentAction, ActionState } from '../../src/lib/types';

export interface EvaluationResult {
  action_id: string;
  property_id: string;
  outcome: 'positive' | 'negative' | 'neutral';
  primary_metric: string;
  before_value: number | null;
  after_value: number | null;
  lift_pct: number | null;
  all_metrics_before: Record<string, number>;
  all_metrics_after: Record<string, number>;
  should_revert: boolean;
  revert_reason?: string;
}

// Metric definitions: which direction is "better" and what's a meaningful change
const METRIC_CONFIG: Record<string, { higher_is_better: boolean; min_change_pct: number }> = {
  revpar:                              { higher_is_better: true,  min_change_pct: 3 },
  occupancy_30d:                       { higher_is_better: true,  min_change_pct: 5 },
  impression_rate:                     { higher_is_better: true,  min_change_pct: 5 },
  ctr:                                 { higher_is_better: true,  min_change_pct: 5 },
  conversion:                          { higher_is_better: true,  min_change_pct: 5 },
  page_views:                          { higher_is_better: true,  min_change_pct: 10 },
  avg_nightly_rate:                    { higher_is_better: true,  min_change_pct: 3 },
  review_score:                        { higher_is_better: true,  min_change_pct: 2 },
  health_score:                        { higher_is_better: true,  min_change_pct: 5 },
  base_price:                          { higher_is_better: true,  min_change_pct: 3 },
};

// Primary metric for each action category
const PRIMARY_METRICS: Record<string, string> = {
  pricing: 'revpar',
  discount: 'impression_rate',
  content: 'ctr',
  exposure: 'impression_rate',
};

// Regression thresholds — how much a primary metric must drop to trigger revert
const REVERT_THRESHOLDS: Record<string, number> = {
  pricing: -10,    // RevPAR drops >10% → revert
  discount: -15,   // Impression rate drops >15% → revert
  content: -20,    // CTR drops >20% → revert
  exposure: -15,
};

/**
 * Evaluate all actions whose measurement is due.
 * Returns evaluation results with revert recommendations.
 */
export async function evaluateDueActions(): Promise<EvaluationResult[]> {
  const supabase = getSupabase();

  // Find completed actions where measurement_due_at has passed
  const { data: dueActions, error } = await supabase
    .from('lc_agent_actions')
    .select('*')
    .eq('status', 'completed')
    .not('measurement_due_at', 'is', null)
    .lte('measurement_due_at', new Date().toISOString())
    .is('measurement_result', null) // not yet evaluated
    .order('measurement_due_at', { ascending: true })
    .limit(50);

  if (error || !dueActions?.length) {
    console.log(`[Evaluator] No actions due for measurement`);
    return [];
  }

  console.log(`[Evaluator] Found ${dueActions.length} actions due for measurement`);

  const results: EvaluationResult[] = [];

  for (const action of dueActions as AgentAction[]) {
    const result = await evaluateAction(action);
    if (result) results.push(result);
  }

  return results;
}

/**
 * Evaluate a single action by comparing before/after metrics.
 */
async function evaluateAction(action: AgentAction): Promise<EvaluationResult | null> {
  const supabase = getSupabase();

  // Get the before-state snapshot
  const { data: beforeState } = await supabase
    .from('lc_action_states')
    .select('*')
    .eq('action_id', action.id)
    .eq('snapshot_type', 'before')
    .single();

  if (!beforeState) {
    console.warn(`[Evaluator] No before-state for action ${action.id} — skipping`);
    return null;
  }

  // Capture current state as "after"
  const afterMetrics = await captureCurrentMetrics(action.property_id);
  const beforeMetrics = (beforeState as ActionState).metrics as Record<string, number>;

  // Save after-state snapshot
  await supabase.from('lc_action_states').insert({
    action_id: action.id,
    property_id: action.property_id,
    snapshot_type: 'after',
    listing_state: {},
    metrics: afterMetrics,
    exposure_metrics: {},
  });

  // Determine primary metric
  const primaryMetric = PRIMARY_METRICS[action.action_category] || 'revpar';
  const beforeVal = beforeMetrics[primaryMetric] ?? null;
  const afterVal = afterMetrics[primaryMetric] ?? null;

  let liftPct: number | null = null;
  if (beforeVal !== null && afterVal !== null && beforeVal !== 0) {
    liftPct = ((afterVal - beforeVal) / Math.abs(beforeVal)) * 100;
  }

  // Determine outcome
  const config = METRIC_CONFIG[primaryMetric] || { higher_is_better: true, min_change_pct: 5 };
  let outcome: EvaluationResult['outcome'] = 'neutral';

  if (liftPct !== null) {
    const effectiveLift = config.higher_is_better ? liftPct : -liftPct;
    if (effectiveLift > config.min_change_pct) {
      outcome = 'positive';
    } else if (effectiveLift < -config.min_change_pct) {
      outcome = 'negative';
    }
  }

  // Check for revert trigger
  const revertThreshold = REVERT_THRESHOLDS[action.action_category] || -15;
  const effectiveLift = config.higher_is_better ? (liftPct ?? 0) : -(liftPct ?? 0);
  const shouldRevert = action.auto_revert_if_regression && effectiveLift < revertThreshold;

  const revertReason = shouldRevert
    ? `Primary metric ${primaryMetric} dropped ${Math.abs(liftPct ?? 0).toFixed(1)}% (threshold: ${Math.abs(revertThreshold)}%)`
    : undefined;

  // Save measurement result on the action
  const measurementResult = {
    primary_metric: primaryMetric,
    before_value: beforeVal,
    after_value: afterVal,
    lift_pct: liftPct,
    outcome,
    should_revert: shouldRevert,
    revert_reason: revertReason,
    evaluated_at: new Date().toISOString(),
  };

  await supabase
    .from('lc_agent_actions')
    .update({
      measurement_result: measurementResult,
      updated_at: new Date().toISOString(),
    })
    .eq('id', action.id);

  return {
    action_id: action.id,
    property_id: action.property_id,
    outcome,
    primary_metric: primaryMetric,
    before_value: beforeVal,
    after_value: afterVal,
    lift_pct: liftPct,
    all_metrics_before: beforeMetrics,
    all_metrics_after: afterMetrics,
    should_revert: shouldRevert,
    revert_reason: revertReason,
  };
}

/**
 * Capture current metrics for a property (for after-state comparison).
 */
async function captureCurrentMetrics(propertyId: string): Promise<Record<string, number>> {
  const supabase = getSupabase();

  const [snapshotResult, whResult, healthResult] = await Promise.all([
    supabase
      .from('lc_latest_snapshots')
      .select('airbnb_first_page_impression_rate, airbnb_search_to_listing_ctr, airbnb_listing_to_booking_conversion, airbnb_page_views, airbnb_occupancy_rate, airbnb_avg_nightly_rate, airbnb_overall_rating')
      .eq('property_id', propertyId)
      .single(),
    supabase
      .from('lc_wheelhouse_kpis')
      .select('adjusted_occupancy_30d, nightly_revpar, base_price_selected')
      .eq('property_id', propertyId)
      .order('sync_date', { ascending: false })
      .limit(1)
      .single(),
    supabase
      .from('lc_health_scores')
      .select('overall_score')
      .eq('property_id', propertyId)
      .order('score_date', { ascending: false })
      .limit(1)
      .single(),
  ]);

  const metrics: Record<string, number> = {};

  if (snapshotResult.data) {
    const s = snapshotResult.data;
    if (s.airbnb_first_page_impression_rate != null) metrics.impression_rate = s.airbnb_first_page_impression_rate;
    if (s.airbnb_search_to_listing_ctr != null) metrics.ctr = s.airbnb_search_to_listing_ctr;
    if (s.airbnb_listing_to_booking_conversion != null) metrics.conversion = s.airbnb_listing_to_booking_conversion;
    if (s.airbnb_page_views != null) metrics.page_views = s.airbnb_page_views;
    if (s.airbnb_occupancy_rate != null) metrics.occupancy_rate = s.airbnb_occupancy_rate;
    if (s.airbnb_avg_nightly_rate != null) metrics.avg_nightly_rate = s.airbnb_avg_nightly_rate;
    if (s.airbnb_overall_rating != null) metrics.review_score = s.airbnb_overall_rating;
  }
  if (whResult.data) {
    if (whResult.data.adjusted_occupancy_30d != null) metrics.occupancy_30d = whResult.data.adjusted_occupancy_30d;
    if (whResult.data.nightly_revpar != null) metrics.revpar = whResult.data.nightly_revpar;
    if (whResult.data.base_price_selected != null) metrics.base_price = whResult.data.base_price_selected;
  }
  if (healthResult.data) {
    if (healthResult.data.overall_score != null) metrics.health_score = healthResult.data.overall_score;
  }

  return metrics;
}
