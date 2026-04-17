// agents/ab-test-tracker/run-tracker.ts
// Orchestrator: processes all active A/B tests, captures snapshots, and calculates results.

import { SupabaseClient } from '@supabase/supabase-js';
import { determineNextStatus, type TestRecord } from './test-lifecycle';
import { captureAfterSnapshot, calculateResult, type TestMetrics } from './snapshot-manager';

export interface TrackerResult {
  tests_checked: number;
  transitions: Array<{ test_id: string; from: string; to: string }>;
  snapshots_captured: number;
  tests_completed: number;
  errors: Array<{ test_id: string; error: string }>;
}

/**
 * Process all non-terminal A/B tests:
 * 1. Fetch all tests with status in (pending, active, snapshot_due)
 * 2. For each test, determine if status should transition
 * 3. For snapshot_due tests, attempt to capture after snapshot from latest metrics
 * 4. For newly completed tests, calculate result and update
 * 5. Log execution
 */
export async function runTracker(supabase: SupabaseClient): Promise<TrackerResult> {
  const result: TrackerResult = {
    tests_checked: 0,
    transitions: [],
    snapshots_captured: 0,
    tests_completed: 0,
    errors: [],
  };

  // Fetch all active tests
  const { data: tests, error: fetchError } = await supabase
    .from('lc_ab_tests')
    .select('*')
    .in('status', ['pending', 'active', 'snapshot_due']);

  if (fetchError) throw new Error(`Failed to fetch tests: ${fetchError.message}`);
  if (!tests || tests.length === 0) return result;

  const now = new Date();
  result.tests_checked = tests.length;

  for (const test of tests) {
    try {
      const testRecord = test as unknown as TestRecord;
      const newStatus = determineNextStatus(testRecord, now);

      // If snapshot_due and no after metrics yet, try to capture
      if (newStatus === 'snapshot_due' && !testRecord.after_metrics) {
        const { data: latestSnap } = await supabase
          .from('lc_latest_snapshots')
          .select('*')
          .eq('property_id', testRecord.property_id)
          .single();

        if (latestSnap) {
          const afterMetrics = captureAfterSnapshot(latestSnap as Record<string, unknown>);
          const afterSnapshotDate = (latestSnap as Record<string, unknown>).snapshot_date as string;

          // Calculate result
          const beforeMetrics = testRecord.before_metrics as unknown as TestMetrics;
          const testResult = calculateResult(
            beforeMetrics,
            afterMetrics,
            testRecord.target_metric
          );

          // Update the test with after snapshot + result
          await supabase
            .from('lc_ab_tests')
            .update({
              after_snapshot_date: afterSnapshotDate,
              after_metrics: afterMetrics,
              status: 'completed',
              result: testResult.result,
              metric_lift: testResult.metric_lift,
              result_summary: testResult.result_summary,
              decision: testResult.decision,
              updated_at: new Date().toISOString(),
            })
            .eq('id', test.id);

          result.snapshots_captured++;
          result.tests_completed++;
          result.transitions.push({ test_id: test.id, from: testRecord.status, to: 'completed' });
          continue;
        }
      }

      // If status changed, update in DB
      if (newStatus !== testRecord.status) {
        await supabase
          .from('lc_ab_tests')
          .update({
            status: newStatus,
            updated_at: new Date().toISOString(),
          })
          .eq('id', test.id);

        result.transitions.push({ test_id: test.id, from: testRecord.status, to: newStatus });
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      result.errors.push({ test_id: test.id, error: message });
    }
  }

  // Log execution
  await supabase.from('lc_agent_executions').insert({
    agent_name: 'ab_test_tracker',
    execution_type: 'scheduled',
    status: 'completed',
    completed_at: new Date().toISOString(),
    properties_processed: result.tests_checked,
    results_summary: {
      transitions: result.transitions.length,
      snapshots_captured: result.snapshots_captured,
      tests_completed: result.tests_completed,
    },
    errors: result.errors.length > 0 ? result.errors : null,
  });

  return result;
}
