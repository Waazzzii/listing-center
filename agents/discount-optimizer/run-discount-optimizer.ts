// agents/discount-optimizer/run-discount-optimizer.ts
// Entry point for the Discount & Merchandising Agent.
//
// Analyzes the entire portfolio for discount optimization opportunities,
// generates agent actions, and sends them for approval.
//
// Usage: npx tsx agents/discount-optimizer/run-discount-optimizer.ts
// Schedule: Daily at 6am (before team reviews Slack)

import { getSupabase } from '../../src/lib/supabase';
import { analyzePortfolio } from './strategy';
import { generateActions } from './action-generator';
import type { CommandGridRow } from '../../src/lib/types';

async function main() {
  console.log('[Discount Optimizer] Starting analysis run...');
  const startTime = Date.now();

  const supabase = getSupabase();

  // Fetch all active properties from the command grid view
  // Split into two queries to work around the Supabase wide-view bug
  const coreColumns = [
    'property_id', 'property_name', 'market', 'quality_tier', 'quality_tier_numeric',
    'airbnb_listing_id', 'vrbo_listing_id', 'booking_property_id',
    'bedrooms', 'property_type', 'is_active',
    'airbnb_first_page_impression_rate', 'airbnb_search_to_listing_ctr',
    'airbnb_listing_to_booking_conversion', 'airbnb_overall_conversion_rate',
    'airbnb_page_views', 'airbnb_avg_nightly_rate', 'airbnb_occupancy_rate',
    'health_status', 'priority_score', 'funnel_bottleneck',
    'wh_occupancy_30d', 'wh_occupancy_120d', 'wh_asking_rate', 'wh_revpar',
    'wh_base_price', 'wh_recommended_price', 'wh_price_alignment',
    'health_score', 'health_grade',
  ].join(',');

  const revColumns = [
    'property_id', 'rev_projected', 'rev_booked', 'rev_actual',
    'rev_pct_to_proj', 'rev_pace_status',
  ].join(',');

  const [coreResult, revResult] = await Promise.all([
    supabase.from('lc_command_grid').select(coreColumns),
    supabase.from('lc_command_grid').select(revColumns),
  ]);

  if (coreResult.error) {
    console.error('[Discount Optimizer] Failed to fetch command grid:', coreResult.error.message);
    process.exit(1);
  }

  // Merge revenue data into core rows
  const revMap = new Map<string, Record<string, unknown>>();
  if (revResult.data) {
    for (const r of revResult.data as unknown as Record<string, unknown>[]) {
      revMap.set(r.property_id as string, r);
    }
  }

  const rows: CommandGridRow[] = ((coreResult.data || []) as unknown as Record<string, unknown>[]).map((row) => {
    const rev = revMap.get(row.property_id as string);
    return {
      ...row,
      rev_projected: rev?.rev_projected ?? null,
      rev_booked: rev?.rev_booked ?? null,
      rev_actual: rev?.rev_actual ?? null,
      rev_pct_to_proj: rev?.rev_pct_to_proj ?? null,
      rev_pace_status: rev?.rev_pace_status ?? null,
      pending_actions: 0,
      active_tests: 0,
      proposed_actions: 0,
      approved_actions: 0,
      executing_actions: 0,
      completed_actions_7d: 0,
    } as CommandGridRow;
  });

  console.log(`[Discount Optimizer] Loaded ${rows.length} active properties`);

  // Analyze portfolio for discount opportunities
  const opportunities = analyzePortfolio(rows);

  console.log(`[Discount Optimizer] Found ${opportunities.length} discount opportunities:`);
  const byType: Record<string, number> = {};
  for (const opp of opportunities) {
    byType[opp.strategy.type] = (byType[opp.strategy.type] || 0) + 1;
  }
  for (const [type, count] of Object.entries(byType)) {
    console.log(`  ${type}: ${count}`);
  }

  // Generate agent actions
  const result = await generateActions(opportunities);

  const duration = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n[Discount Optimizer] Completed in ${duration}s`);
  console.log(`  Opportunities found: ${result.total_opportunities}`);
  console.log(`  Actions created: ${result.actions_created}`);
  console.log(`  Auto-approved: ${result.auto_approved}`);
  console.log(`  Pending approval: ${result.pending_approval}`);

  if (result.errors.length > 0) {
    console.log(`  Errors (${result.errors.length}):`);
    for (const err of result.errors) {
      console.log(`    - ${err}`);
    }
  }
}

main().catch((err) => {
  console.error('[Discount Optimizer] Fatal error:', err);
  process.exit(1);
});
