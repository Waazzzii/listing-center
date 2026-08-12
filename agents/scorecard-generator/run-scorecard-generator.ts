// agents/scorecard-generator/run-scorecard-generator.ts
// Entry point: generate monthly scorecards for all active properties.

import { SupabaseClient } from '@supabase/supabase-js';
import { buildScorecardData, type ScorecardInput } from './scorecard-builder';

export interface ScorecardGeneratorResult {
  scorecards_generated: number;
  scorecards_failed: number;
  errors: Array<{ property_id: string; error: string }>;
  execution_id: string;
}

/**
 * Generate monthly scorecards for all active properties.
 *
 * 1. Determine report month (previous month)
 * 2. Fetch all active properties
 * 3. For each property:
 *    a. Fetch latest + prior month snapshots
 *    b. Fetch reviews for that month
 *    c. Fetch changes made that month
 *    d. Fetch active recommendations
 *    e. Resolve benchmark
 *    f. Build scorecard data
 *    g. Upsert into lc_owner_scorecards
 * 4. Log execution
 */
export async function runScorecardGenerator(
  supabase: SupabaseClient
): Promise<ScorecardGeneratorResult> {
  const errors: Array<{ property_id: string; error: string }> = [];
  let scorecardsGenerated = 0;

  // Determine report month: previous month
  const now = new Date();
  const reportMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const reportMonthStr = reportMonth.toISOString().split('T')[0];
  const reportMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
  const reportMonthEndStr = reportMonthEnd.toISOString().split('T')[0];

  // Prior month (two months ago)
  const priorMonth = new Date(now.getFullYear(), now.getMonth() - 2, 1);
  const priorMonthStr = priorMonth.toISOString().split('T')[0];

  // Log execution start
  const { data: execution } = await supabase
    .from('lc_agent_executions')
    .insert({
      agent_name: 'scorecard_generator',
      execution_type: 'scheduled',
      status: 'running',
    })
    .select('id')
    .single();

  const executionId = execution?.id || 'unknown';

  try {
    // Fetch all active properties
    const { data: properties, error: propError } = await supabase
      .from('lc_properties')
      .select('*')
      .eq('is_active', true);

    if (propError)
      throw new Error(`Failed to fetch properties: ${propError.message}`);
    if (!properties || properties.length === 0)
      throw new Error('No active properties found');

    // Fetch all benchmarks
    const { data: benchmarks } = await supabase
      .from('lc_benchmarks')
      .select('*')
      .eq('is_active', true);

    for (const property of properties) {
      try {
        // Fetch latest snapshot for the report month
        const { data: latestSnaps } = await supabase
          .from('lc_metric_snapshots')
          .select('*')
          .eq('property_id', property.id)
          .eq('scrape_completeness', 'complete')
          .gte('snapshot_date', reportMonthStr)
          .lte('snapshot_date', reportMonthEndStr)
          .order('snapshot_date', { ascending: false })
          .limit(1);

        const latestSnapshot = latestSnaps?.[0];
        if (!latestSnapshot) {
          errors.push({
            property_id: property.id,
            error: 'No snapshot data for report month',
          });
          continue;
        }

        // Fetch prior month snapshot
        const { data: priorSnaps } = await supabase
          .from('lc_metric_snapshots')
          .select('*')
          .eq('property_id', property.id)
          .eq('scrape_completeness', 'complete')
          .gte('snapshot_date', priorMonthStr)
          .lt('snapshot_date', reportMonthStr)
          .order('snapshot_date', { ascending: false })
          .limit(1);

        const priorSnapshot = priorSnaps?.[0] || null;

        // Fetch reviews for the month
        const { data: reviews } = await supabase
          .from('lc_reviews')
          .select('guest_name, rating, review_date, sentiment')
          .eq('property_id', property.id)
          .gte('review_date', reportMonthStr)
          .lte('review_date', reportMonthEndStr);

        // Fetch changes made this month
        const { data: changes } = await supabase
          .from('lc_change_log')
          .select('change_type, change_date, thesis, execution_status')
          .eq('property_id', property.id)
          .gte('change_date', reportMonthStr)
          .lte('change_date', reportMonthEndStr);

        // Fetch active recommendations
        const { data: recommendations } = await supabase
          .from('lc_recommendations')
          .select('title, severity, funnel_stage')
          .eq('property_id', property.id)
          .eq('status', 'pending');

        // Resolve benchmark for this tier (global default)
        const tierBenchmark = benchmarks?.find(
          (b: any) =>
            b.quality_tier === property.quality_tier &&
            b.market == null &&
            b.season == null
        );

        const defaultBenchmark = {
          impression_rate_low: 50,
          impression_rate_high: 65,
          ctr_low: 10,
          ctr_high: 25,
          conversion_low: 2,
          conversion_high: 5,
        };

        const input: ScorecardInput = {
          property_id: property.id,
          property_name: property.property_name,
          market: property.market,
          quality_tier: property.quality_tier,
          report_month: reportMonthStr,
          latest_snapshot: latestSnapshot,
          prior_month_snapshot: priorSnapshot,
          reviews: reviews || [],
          changes_made: changes || [],
          active_recommendations: recommendations || [],
          benchmark: tierBenchmark || defaultBenchmark,
        };

        const scorecardData = buildScorecardData(input);

        // Upsert scorecard
        await supabase.from('lc_owner_scorecards').upsert(
          {
            property_id: property.id,
            report_month: reportMonthStr,
            generated_at: new Date().toISOString(),
            generation_status: 'generated',
            scorecard_data: scorecardData,
          },
          {
            onConflict: 'property_id,report_month',
          }
        );

        scorecardsGenerated++;
      } catch (err: any) {
        errors.push({ property_id: property.id, error: err.message });
      }
    }

    // Update execution log
    if (execution) {
      await supabase
        .from('lc_agent_executions')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          properties_processed: scorecardsGenerated,
          properties_skipped: errors.length,
          results_summary: {
            scorecards_generated: scorecardsGenerated,
            report_month: reportMonthStr,
          },
          errors: errors.length > 0 ? errors : null,
        })
        .eq('id', execution.id);
    }
  } catch (fatalError: any) {
    if (execution) {
      await supabase
        .from('lc_agent_executions')
        .update({
          status: 'failed',
          completed_at: new Date().toISOString(),
          errors: [{ property_id: 'system', error: fatalError.message }],
        })
        .eq('id', execution.id);
    }
    throw fatalError;
  }

  return {
    scorecards_generated: scorecardsGenerated,
    scorecards_failed: errors.length,
    errors,
    execution_id: executionId,
  };
}
