// agents/testing-engine/reverter.ts
// Auto-Revert Engine — creates revert actions for changes that caused regression.
// Only reverts actions flagged with auto_revert_if_regression = true.

import { getSupabase } from '../../src/lib/supabase';
import { postSlackMessage } from '../../src/lib/slack';
import type { EvaluationResult } from './evaluator';

const SLACK_CHANNEL = process.env.SLACK_LISTING_CENTER_CHANNEL || '';

/**
 * Process evaluation results and create revert actions where needed.
 */
export async function processReverts(results: EvaluationResult[]): Promise<number> {
  const needsRevert = results.filter(r => r.should_revert);
  if (!needsRevert.length) return 0;

  console.log(`[Reverter] ${needsRevert.length} actions need revert`);
  const supabase = getSupabase();
  let reverted = 0;

  for (const result of needsRevert) {
    // Fetch the original action to build the revert
    const { data: original } = await supabase
      .from('lc_agent_actions')
      .select('*')
      .eq('id', result.action_id)
      .single();

    if (!original) continue;

    // Get the before-state to know what to revert to
    const { data: beforeState } = await supabase
      .from('lc_action_states')
      .select('listing_state, metrics')
      .eq('action_id', result.action_id)
      .eq('snapshot_type', 'before')
      .single();

    // Build revert payload — inverts the original action
    const revertPayload = buildRevertPayload(original, beforeState?.listing_state || {});

    // Create the revert action
    const { error: insertErr } = await supabase.from('lc_agent_actions').insert({
      property_id: original.property_id,
      agent_name: 'testing_engine',
      action_type: `revert_${original.action_type}`,
      action_category: original.action_category,
      execution_channel: original.execution_channel,
      title: `[AUTO-REVERT] ${original.title}`,
      description: `Auto-reverting action because: ${result.revert_reason}\n\nOriginal action: ${original.title}\nPrimary metric: ${result.primary_metric} went from ${result.before_value} to ${result.after_value} (${result.lift_pct?.toFixed(1)}%)`,
      payload: revertPayload,
      expected_impact: 'Restore metrics to pre-action levels',
      confidence_score: 90,
      status: 'auto_approved', // Auto-reverts skip approval
      priority: 'high',
      requires_approval: false,
      is_revertible: false, // Don't revert a revert
      revert_action_id: original.id,
      auto_revert_if_regression: false,
    });

    if (insertErr) {
      console.error(`[Reverter] Failed to create revert for ${result.action_id}:`, insertErr.message);
      continue;
    }

    // Mark original as reverted
    await supabase
      .from('lc_agent_actions')
      .update({
        status: 'reverted',
        reverted_at: new Date().toISOString(),
        revert_reason: result.revert_reason,
        updated_at: new Date().toISOString(),
      })
      .eq('id', result.action_id);

    reverted++;
  }

  // Send Slack alert for reverts
  if (SLACK_CHANNEL && reverted > 0) {
    const lines = needsRevert.map(r =>
      `  :rewind: *${r.action_id.slice(0, 8)}* — ${r.primary_metric}: ${formatMetric(r.before_value)} → ${formatMetric(r.after_value)} (${r.lift_pct?.toFixed(1)}%)`
    );

    const text = [
      `:warning: *Auto-Revert Alert* — ${reverted} action${reverted > 1 ? 's' : ''} reverted`,
      '',
      ...lines,
      '',
      'These actions caused metric regression beyond safety thresholds. Revert actions have been auto-approved and queued for execution.',
    ].join('\n');

    await postSlackMessage(SLACK_CHANNEL, text, [
      { type: 'section', text: { type: 'mrkdwn', text } },
    ]);
  }

  return reverted;
}

/**
 * Build a revert payload that restores the original state.
 */
function buildRevertPayload(
  original: Record<string, unknown>,
  beforeListingState: Record<string, unknown>
): Record<string, unknown> {
  const payload = original.payload as Record<string, unknown> || {};

  // For pricing actions, swap current/new base prices
  if (original.action_category === 'pricing' && beforeListingState.base_price) {
    return {
      ...payload,
      base_price: beforeListingState.base_price,
      revert_from: payload.base_price,
      is_revert: true,
    };
  }

  // For discount actions, remove/zero the discount
  if (original.action_category === 'discount') {
    return {
      ...payload,
      discount_pct: 0,
      promotion_active: false,
      is_revert: true,
      restore_base_price: beforeListingState.base_price || null,
    };
  }

  // For content actions, restore original content
  if (original.action_category === 'content') {
    return {
      ...beforeListingState,
      is_revert: true,
    };
  }

  // Generic: pass along the before-state
  return { ...beforeListingState, is_revert: true };
}

function formatMetric(val: number | null): string {
  if (val === null) return 'N/A';
  if (val < 1) return `${(val * 100).toFixed(1)}%`;
  return val.toFixed(1);
}
