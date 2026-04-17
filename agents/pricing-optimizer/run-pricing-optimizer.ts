// agents/pricing-optimizer/run-pricing-optimizer.ts
// Entry point for the Pricing Optimization Agent.
// Analyzes portfolio pricing via Wheelhouse data, generates rate change actions.
//
// Usage: npx tsx agents/pricing-optimizer/run-pricing-optimizer.ts
// Schedule: Daily at 7am (after discount optimizer)

import { getSupabase } from '../../src/lib/supabase';
import { analyzePortfolioPricing } from './analyzer';
import { sendActionApprovalRequest } from '../../src/lib/slack-action-notifier';
import type { CommandGridRow } from '../../src/lib/types';

const AGENT_NAME = 'pricing_optimizer';
const SLACK_CHANNEL = process.env.SLACK_LISTING_CENTER_CHANNEL || '';

async function main() {
  console.log('[Pricing Optimizer] Starting analysis run...');
  const startTime = Date.now();
  const supabase = getSupabase();

  // Fetch command grid data (split query pattern)
  const coreColumns = [
    'property_id', 'property_name', 'market', 'quality_tier', 'quality_tier_numeric',
    'airbnb_listing_id', 'vrbo_listing_id', 'booking_property_id',
    'bedrooms', 'property_type', 'is_active',
    'airbnb_first_page_impression_rate', 'airbnb_search_to_listing_ctr',
    'airbnb_listing_to_booking_conversion', 'airbnb_avg_nightly_rate',
    'health_status', 'funnel_bottleneck',
    'wh_occupancy_30d', 'wh_occupancy_120d', 'wh_revpar',
    'wh_base_price', 'wh_recommended_price', 'wh_price_alignment',
    'wh_auto_rates', 'wh_flags',
    'health_score', 'health_grade',
  ].join(',');

  const revColumns = ['property_id', 'rev_pct_to_proj', 'rev_pace_status'].join(',');

  const [coreResult, revResult] = await Promise.all([
    supabase.from('lc_command_grid').select(coreColumns),
    supabase.from('lc_command_grid').select(revColumns),
  ]);

  if (coreResult.error) {
    console.error('[Pricing Optimizer] Failed to fetch:', coreResult.error.message);
    process.exit(1);
  }

  const revMap = new Map<string, Record<string, unknown>>();
  if (revResult.data) {
    for (const r of revResult.data as unknown as Record<string, unknown>[]) {
      revMap.set(r.property_id as string, r);
    }
  }

  const rows: CommandGridRow[] = ((coreResult.data || []) as unknown as Record<string, unknown>[]).map((row) => {
    const rev = revMap.get(row.property_id as string);
    return { ...row, rev_pace_status: rev?.rev_pace_status ?? null } as CommandGridRow;
  });

  console.log(`[Pricing Optimizer] Loaded ${rows.length} properties`);

  // Analyze
  const opportunities = analyzePortfolioPricing(rows);
  console.log(`[Pricing Optimizer] Found ${opportunities.length} pricing opportunities`);

  const byType: Record<string, number> = {};
  for (const opp of opportunities) {
    byType[opp.recommendation.type] = (byType[opp.recommendation.type] || 0) + 1;
  }
  for (const [type, count] of Object.entries(byType)) {
    console.log(`  ${type}: ${count}`);
  }

  // Create actions
  const batchId = crypto.randomUUID();
  let created = 0;
  let errors = 0;

  for (const opp of opportunities) {
    // Skip if already has active pricing action
    const { data: existing } = await supabase
      .from('lc_agent_actions')
      .select('id')
      .eq('property_id', opp.property_id)
      .eq('agent_name', AGENT_NAME)
      .in('status', ['proposed', 'approved', 'auto_approved', 'executing'])
      .limit(1);

    if (existing && existing.length > 0) continue;

    const { data: action, error } = await supabase
      .from('lc_agent_actions')
      .insert({
        property_id: opp.property_id,
        agent_name: AGENT_NAME,
        action_type: opp.recommendation.type,
        action_category: 'pricing',
        execution_channel: 'wheelhouse_api',
        title: `${opp.recommendation.type === 'raise_base' ? 'Raise' : opp.recommendation.type === 'lower_base' ? 'Lower' : 'Adjust'} base: $${opp.recommendation.current_base} → $${opp.recommendation.recommended_base}`,
        description: opp.rationale,
        payload: opp.actions[0]?.payload || {},
        expected_impact: opp.recommendation.expected_revpar_impact,
        confidence_score: opp.confidence,
        status: 'proposed',
        priority: opp.actions[0]?.priority || 'normal',
        requires_approval: true,
        is_revertible: true,
        auto_revert_if_regression: opp.recommendation.type === 'lower_base',
        batch_id: batchId,
      })
      .select('*')
      .single();

    if (error) {
      console.error(`  Error for ${opp.property_name}: ${error.message}`);
      errors++;
      continue;
    }

    created++;

    // Send to Slack
    if (SLACK_CHANNEL && action) {
      await sendActionApprovalRequest(
        { ...action, property_name: opp.property_name, market: opp.market },
        SLACK_CHANNEL
      );
    }
  }

  const duration = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n[Pricing Optimizer] Completed in ${duration}s: ${created} actions created, ${errors} errors`);
}

main().catch((err) => {
  console.error('[Pricing Optimizer] Fatal error:', err);
  process.exit(1);
});
