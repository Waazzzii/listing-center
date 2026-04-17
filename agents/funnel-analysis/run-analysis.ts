import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { analyzeProperty, type SnapshotForAnalysis } from './analyzer';
import { classifyHealth, type MarketContext } from './health-classifier';
import { calculatePriority, getRemainingSeasonDays, type PriorityInput } from './priority-scorer';
import { generateRecommendations, type RecommendationDraft } from './recommendation-router';
import { resolveBenchmark, type BenchmarkRow, type ResolvedBenchmark } from './benchmark-lookup';
import { getSeason } from '../../src/lib/season';

export interface AnalysisResult {
  properties_processed: number;
  properties_skipped: number;
  health_distribution: Record<string, number>;
  recommendations_generated: number;
  errors: Array<{ property_id: string; error: string }>;
  execution_id: string;
}

interface PropertyWithSnapshot {
  property_id: string;
  property_name: string;
  market: string;
  quality_tier: string;
  airbnb_avg_nightly_rate: number | null;
  snapshot: SnapshotForAnalysis;
}

/**
 * Run the full Funnel Analysis cycle.
 *
 * 1. Create agent execution log entry (status: running)
 * 2. Fetch all benchmarks
 * 3. Fetch latest complete snapshots (via materialized view)
 * 4. For each property with a complete snapshot:
 *    a. Resolve benchmark (tier + market + season)
 *    b. Run funnel analysis (Sean's framework)
 *    c. Classify health status
 *    d. Calculate priority score
 *    e. Generate recommendations
 * 5. Write health_status + priority_score back to lc_metric_snapshots
 * 6. Insert recommendations into lc_recommendations
 * 7. Update agent execution log (status: completed)
 * 8. Return summary
 */
export async function runFullAnalysis(supabase: SupabaseClient): Promise<AnalysisResult> {
  const errors: Array<{ property_id: string; error: string }> = [];
  const healthDist: Record<string, number> = {
    red: 0, orange: 0, yellow: 0, green: 0, blue_spell: 0, unknown: 0,
  };
  let propertiesProcessed = 0;
  let propertiesSkipped = 0;
  let recommendationsGenerated = 0;

  // Step 1: Create execution log entry
  const { data: execution, error: execError } = await supabase
    .from('lc_agent_executions')
    .insert({
      agent_name: 'funnel_analysis',
      execution_type: 'scheduled',
      status: 'running',
    })
    .select('id')
    .single();

  if (execError || !execution) {
    throw new Error(`Failed to create execution log: ${execError?.message}`);
  }
  const executionId = execution.id;

  try {
    // Step 2: Fetch all active benchmarks
    const { data: benchmarkRows, error: benchError } = await supabase
      .from('lc_benchmarks')
      .select('*')
      .eq('is_active', true);

    if (benchError) throw new Error(`Failed to fetch benchmarks: ${benchError.message}`);
    if (!benchmarkRows || benchmarkRows.length === 0) {
      throw new Error('No active benchmarks found — run seed-benchmarks.ts first');
    }

    // Step 3: Fetch latest complete snapshots via materialized view
    const { data: latestSnapshots, error: snapError } = await supabase
      .from('lc_latest_snapshots')
      .select('*');

    if (snapError) throw new Error(`Failed to fetch latest snapshots: ${snapError.message}`);
    if (!latestSnapshots || latestSnapshots.length === 0) {
      throw new Error('No snapshots found — run Data Collection Agent first');
    }

    const now = new Date();
    const allRecommendations: RecommendationDraft[] = [];

    // Step 4: Process each property
    for (const row of latestSnapshots) {
      try {
        const propertyId = row.property_id;
        const market = row.market ?? 'unknown';
        const qualityTier = row.quality_tier ?? 'standard';
        const propertyName = row.property_name ?? 'Unknown Property';

        // 4a. Resolve benchmark
        const season = getSeason(market, now);
        let benchmark: ResolvedBenchmark;
        try {
          benchmark = resolveBenchmark(benchmarkRows as BenchmarkRow[], qualityTier, market, season);
        } catch (e: any) {
          errors.push({ property_id: propertyId, error: `Benchmark resolution failed: ${e.message}` });
          propertiesSkipped++;
          healthDist['unknown'] = (healthDist['unknown'] || 0) + 1;
          continue;
        }

        // 4b. Run funnel analysis
        const diagnosis = analyzeProperty(row as SnapshotForAnalysis, benchmark);

        if (diagnosis.skipped) {
          propertiesSkipped++;
          healthDist['unknown'] = (healthDist['unknown'] || 0) + 1;
          continue;
        }

        // 4c. Classify health status
        // Market occupancy comes from the snapshot (Streamline enrichment)
        const marketContext: MarketContext = {
          market_occupancy: row.airbnb_occupancy_rate ?? null,
          previous_health_status: row.previous_health_status ?? null,
        };
        const healthResult = classifyHealth(diagnosis, marketContext);

        // 4d. Calculate priority score
        const remainingDays = getRemainingSeasonDays(market, now);
        const maxSeverity = diagnosis.issues.length > 0
          ? diagnosis.issues.reduce((worst, issue) => {
              const order: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1 };
              return (order[issue.severity] ?? 0) > (order[worst] ?? 0) ? issue.severity : worst;
            }, diagnosis.issues[0].severity)
          : null;

        const priorityInput: PriorityInput = {
          adr: row.airbnb_avg_nightly_rate ?? null,
          projected_occupancy_lift_pct: 0, // Will be estimated by calculatePriority from severity
          remaining_season_days: remainingDays,
          max_severity: maxSeverity,
          effort: 'medium', // Default; refined when specific recommendations are generated
          issue_count: diagnosis.issues.length,
          opportunity_count: diagnosis.opportunities.length,
        };
        const priorityScore = calculatePriority(priorityInput);

        // 4e. Generate recommendations
        const recs = generateRecommendations(diagnosis, {
          property_id: propertyId,
          property_name: propertyName,
          market,
          quality_tier: qualityTier,
        });
        allRecommendations.push(...recs);

        // Write health status + priority score back to the snapshot
        const { error: updateError } = await supabase
          .from('lc_metric_snapshots')
          .update({
            health_status: healthResult.health_status,
            previous_health_status: healthResult.previous_health_status,
            priority_score: priorityScore,
            funnel_bottleneck: diagnosis.funnel_bottleneck,
          })
          .eq('id', row.id);

        if (updateError) {
          errors.push({ property_id: propertyId, error: `Snapshot update failed: ${updateError.message}` });
        }

        propertiesProcessed++;
        healthDist[healthResult.health_status] = (healthDist[healthResult.health_status] || 0) + 1;
      } catch (propError: any) {
        errors.push({ property_id: row.property_id, error: propError.message });
        propertiesSkipped++;
      }
    }

    // Step 5: Batch insert recommendations
    if (allRecommendations.length > 0) {
      // Insert in batches of 50
      for (let i = 0; i < allRecommendations.length; i += 50) {
        const batch = allRecommendations.slice(i, i + 50);
        const { error: recError } = await supabase
          .from('lc_recommendations')
          .insert(batch);

        if (recError) {
          errors.push({ property_id: 'batch', error: `Recommendation insert failed: ${recError.message}` });
        } else {
          recommendationsGenerated += batch.length;
        }
      }
    }

    // Step 6: Refresh materialized view after updating health statuses
    const { error: refreshError } = await supabase.rpc('refresh_lc_latest_snapshots');
    if (refreshError) {
      // Non-fatal: log but don't throw. The materialized view refresh can also be run via script.
      errors.push({ property_id: 'system', error: `Materialized view refresh failed: ${refreshError.message}` });
    }

    // Step 7: Update execution log
    await supabase
      .from('lc_agent_executions')
      .update({
        status: errors.length > 0 ? 'completed_with_errors' : 'completed',
        completed_at: new Date().toISOString(),
        properties_processed: propertiesProcessed,
        properties_skipped: propertiesSkipped,
        errors: errors.length > 0 ? errors : null,
        results_summary: {
          health_distribution: healthDist,
          recommendations_generated: recommendationsGenerated,
        },
      })
      .eq('id', executionId);

  } catch (fatalError: any) {
    // Fatal error — mark execution as failed
    await supabase
      .from('lc_agent_executions')
      .update({
        status: 'failed',
        completed_at: new Date().toISOString(),
        errors: [{ property_id: 'system', error: fatalError.message }],
      })
      .eq('id', executionId);

    throw fatalError;
  }

  return {
    properties_processed: propertiesProcessed,
    properties_skipped: propertiesSkipped,
    health_distribution: healthDist,
    recommendations_generated: recommendationsGenerated,
    errors,
    execution_id: executionId,
  };
}

/**
 * Entry point for agent execution.
 * Initializes Supabase client from environment and runs analysis.
 */
export async function main(): Promise<void> {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY environment variables');
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  console.log('[Funnel Analysis] Starting full analysis run...');
  const result = await runFullAnalysis(supabase);

  console.log('[Funnel Analysis] Complete.');
  console.log(`  Processed: ${result.properties_processed}`);
  console.log(`  Skipped: ${result.properties_skipped}`);
  console.log(`  Recommendations: ${result.recommendations_generated}`);
  console.log(`  Health distribution:`, result.health_distribution);
  if (result.errors.length > 0) {
    console.warn(`  Errors: ${result.errors.length}`);
    result.errors.forEach(e => console.warn(`    ${e.property_id}: ${e.error}`));
  }
}

// Allow direct execution: npx tsx agents/funnel-analysis/run-analysis.ts
if (require.main === module) {
  main().catch(err => {
    console.error('[Funnel Analysis] Fatal error:', err);
    process.exit(1);
  });
}
