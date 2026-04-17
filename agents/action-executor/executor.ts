// agents/action-executor/executor.ts
// Core execution engine. Takes approved actions and routes them to the correct
// execution channel (Wheelhouse API, Playwright browser automation, etc.).
// Captures before-state, executes, captures after-state, schedules measurement.

import { getSupabase } from '../../src/lib/supabase';
import { executeWheelhouseAction } from './channels/wheelhouse';
import { executePlaywrightAction } from './channels/playwright';
import type { AgentAction, ActionState } from '../../src/lib/types';

export interface ExecutionResult {
  success: boolean;
  result?: Record<string, unknown>;
  error?: string;
}

// Default soak periods by action category (days)
const SOAK_PERIODS: Record<string, number> = {
  pricing: 7,
  discount: 14,
  content: 21,
  exposure: 14,
  other: 14,
};

/**
 * Process all approved actions that are ready for execution.
 * Called on a schedule (e.g. every 5 minutes) or triggered by approval.
 */
export async function processActionQueue(): Promise<{
  processed: number;
  succeeded: number;
  failed: number;
  errors: string[];
}> {
  const supabase = getSupabase();
  const stats = { processed: 0, succeeded: 0, failed: 0, errors: [] as string[] };

  // Fetch approved and auto-approved actions ordered by priority
  const { data: actions, error } = await supabase
    .from('lc_agent_actions')
    .select('*')
    .in('status', ['approved', 'auto_approved'])
    .order('priority', { ascending: true })
    .order('created_at', { ascending: true })
    .limit(20); // Process in batches

  if (error || !actions?.length) return stats;

  for (const action of actions as AgentAction[]) {
    stats.processed++;
    try {
      await executeAction(action);
      stats.succeeded++;
    } catch (err) {
      stats.failed++;
      stats.errors.push(`${action.id}: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  }

  return stats;
}

/**
 * Execute a single approved action through its full lifecycle:
 * 1. Capture before-state snapshot
 * 2. Mark as executing
 * 3. Route to execution channel
 * 4. On success: mark completed, schedule measurement
 * 5. On failure: mark failed or retry
 */
export async function executeAction(action: AgentAction): Promise<void> {
  const supabase = getSupabase();

  // 1. Capture before-state
  const beforeState = await captureState(action, 'before');

  // 2. Mark as executing
  await supabase
    .from('lc_agent_actions')
    .update({
      status: 'executing',
      executed_at: new Date().toISOString(),
      state_snapshot_id: beforeState?.id || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', action.id);

  // 3. Route to execution channel
  let result: ExecutionResult;
  try {
    result = await routeToChannel(action);
  } catch (err) {
    result = {
      success: false,
      error: err instanceof Error ? err.message : 'Execution channel error',
    };
  }

  // 4/5. Handle result
  if (result.success) {
    const soakDays = SOAK_PERIODS[action.action_category] || 14;
    const measurementDue = new Date();
    measurementDue.setDate(measurementDue.getDate() + soakDays);

    await supabase
      .from('lc_agent_actions')
      .update({
        status: 'completed',
        execution_result: result.result || {},
        measurement_due_at: measurementDue.toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', action.id);

    // Create A/B test for trackable actions
    if (action.auto_revert_if_regression) {
      await createMeasurementTest(action, soakDays);
    }
  } else {
    const newRetryCount = action.retry_count + 1;
    const canRetry = newRetryCount <= action.max_retries;

    await supabase
      .from('lc_agent_actions')
      .update({
        status: canRetry ? 'approved' : 'failed', // back to queue for retry
        execution_error: result.error,
        retry_count: newRetryCount,
        executed_at: canRetry ? null : action.executed_at,
        updated_at: new Date().toISOString(),
      })
      .eq('id', action.id);
  }
}

/**
 * Route an action to the appropriate execution channel.
 */
async function routeToChannel(action: AgentAction): Promise<ExecutionResult> {
  switch (action.execution_channel) {
    case 'wheelhouse_api':
      return executeWheelhouseAction(action);

    case 'playwright_airbnb':
    case 'playwright_vrbo':
    case 'playwright_booking':
      return executePlaywrightAction(action);

    case 'streamline_api':
      // TODO: Implement Streamline API execution
      return { success: false, error: 'Streamline API execution not yet implemented' };

    case 'manual':
      // Manual actions are just marked as completed — human does the work
      return { success: true, result: { note: 'Manual action — flagged for human execution' } };

    default:
      return { success: false, error: `Unknown execution channel: ${action.execution_channel}` };
  }
}

/**
 * Capture a state snapshot (before or after) for an action.
 */
async function captureState(
  action: AgentAction,
  snapshotType: 'before' | 'after'
): Promise<ActionState | null> {
  const supabase = getSupabase();

  // Gather current metrics for this property
  const [snapshotResult, whResult, healthResult] = await Promise.all([
    supabase
      .from('lc_latest_snapshots')
      .select('airbnb_first_page_impression_rate, airbnb_search_to_listing_ctr, airbnb_listing_to_booking_conversion, airbnb_page_views, airbnb_occupancy_rate, airbnb_avg_nightly_rate, airbnb_overall_rating')
      .eq('property_id', action.property_id)
      .single(),
    supabase
      .from('lc_wheelhouse_kpis')
      .select('adjusted_occupancy_30d, nightly_revpar, base_price_selected, base_price_recommended, price_alignment_pct, auto_rate_posting_enabled')
      .eq('property_id', action.property_id)
      .order('sync_date', { ascending: false })
      .limit(1)
      .single(),
    supabase
      .from('lc_health_scores')
      .select('overall_score')
      .eq('property_id', action.property_id)
      .order('score_date', { ascending: false })
      .limit(1)
      .single(),
  ]);

  const metrics: Record<string, unknown> = {};
  if (snapshotResult.data) {
    Object.assign(metrics, {
      impression_rate: snapshotResult.data.airbnb_first_page_impression_rate,
      ctr: snapshotResult.data.airbnb_search_to_listing_ctr,
      conversion: snapshotResult.data.airbnb_listing_to_booking_conversion,
      page_views: snapshotResult.data.airbnb_page_views,
      occupancy_rate: snapshotResult.data.airbnb_occupancy_rate,
      avg_nightly_rate: snapshotResult.data.airbnb_avg_nightly_rate,
      review_score: snapshotResult.data.airbnb_overall_rating,
    });
  }
  if (whResult.data) {
    Object.assign(metrics, {
      occupancy_30d: whResult.data.adjusted_occupancy_30d,
      revpar: whResult.data.nightly_revpar,
      base_price: whResult.data.base_price_selected,
      recommended_price: whResult.data.base_price_recommended,
      price_alignment: whResult.data.price_alignment_pct,
    });
  }
  if (healthResult.data) {
    metrics.health_score = healthResult.data.overall_score;
  }

  // Build listing state from the action payload (channel-specific)
  const listingState = action.payload || {};

  const { data, error } = await supabase
    .from('lc_action_states')
    .insert({
      action_id: action.id,
      property_id: action.property_id,
      snapshot_type: snapshotType,
      listing_state: listingState,
      metrics,
      exposure_metrics: {},
    })
    .select()
    .single();

  if (error) {
    console.error(`[Executor] Failed to capture ${snapshotType} state for action ${action.id}:`, error.message);
    return null;
  }

  return data as ActionState;
}

/**
 * Create an A/B test record to track the impact of a completed action.
 */
async function createMeasurementTest(action: AgentAction, soakDays: number): Promise<void> {
  const supabase = getSupabase();

  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + soakDays);

  await supabase.from('lc_ab_tests').insert({
    property_id: action.property_id,
    test_type: action.action_type,
    thesis: action.expected_impact || action.title,
    target_metric: primaryMetricForCategory(action.action_category),
    before_snapshot_date: new Date().toISOString().split('T')[0],
    change_description: action.title,
    change_executed_date: new Date().toISOString().split('T')[0],
    after_snapshot_due_date: dueDate.toISOString().split('T')[0],
    status: 'active',
    minimum_impressions: 3000,
    soak_period_days: soakDays,
  });

  // Link the test to the action
  const { data: test } = await supabase
    .from('lc_ab_tests')
    .select('id')
    .eq('property_id', action.property_id)
    .eq('test_type', action.action_type)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (test) {
    await supabase
      .from('lc_agent_actions')
      .update({ ab_test_id: test.id })
      .eq('id', action.id);
  }
}

function primaryMetricForCategory(category: string): string {
  switch (category) {
    case 'pricing': return 'revpar';
    case 'discount': return 'airbnb_first_page_impression_rate';
    case 'content': return 'airbnb_search_to_listing_ctr';
    case 'exposure': return 'airbnb_first_page_impression_rate';
    default: return 'airbnb_overall_conversion_rate';
  }
}
