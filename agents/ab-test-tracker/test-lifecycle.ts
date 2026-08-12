// agents/ab-test-tracker/test-lifecycle.ts
// State machine for A/B test lifecycle management.
// pending -> active -> snapshot_due -> completed

export interface TestRecord {
  id: string;
  property_id: string;
  test_type: string;
  thesis: string;
  target_metric: string;
  status: 'pending' | 'active' | 'snapshot_due' | 'completed' | 'cancelled';
  before_snapshot_date: string | null;
  before_metrics: Record<string, unknown> | null;
  change_executed_date: string | null;
  after_snapshot_due_date: string | null;
  after_snapshot_date: string | null;
  after_metrics: Record<string, unknown> | null;
  soak_period_days: number;
  minimum_impressions: number;
}

/**
 * Determine the next status for a test based on its current state and data.
 *
 * State machine:
 *   pending -> active          (when change is executed + before snapshot captured)
 *   active -> snapshot_due     (when soak period has elapsed)
 *   snapshot_due -> completed  (when after snapshot is captured)
 *   completed -> (terminal)
 *   cancelled -> (terminal)
 */
export function determineNextStatus(
  test: TestRecord,
  now: Date = new Date()
): TestRecord['status'] {
  switch (test.status) {
    case 'pending':
      // Move to active when we have a before snapshot and the change is executed
      if (test.before_metrics && test.change_executed_date) {
        return 'active';
      }
      return 'pending';

    case 'active':
      // Move to snapshot_due when soak period has elapsed
      if (test.after_snapshot_due_date && isSnapshotDue(test.after_snapshot_due_date, now)) {
        return 'snapshot_due';
      }
      return 'active';

    case 'snapshot_due':
      // Move to completed when after snapshot is captured
      if (test.after_metrics && test.after_snapshot_date) {
        return 'completed';
      }
      return 'snapshot_due';

    case 'completed':
    case 'cancelled':
      return test.status;

    default:
      return test.status;
  }
}

/**
 * Check if the current date is on or past the after snapshot due date.
 */
export function isSnapshotDue(dueDateStr: string | null, now: Date): boolean {
  if (!dueDateStr) return false;
  const dueDate = new Date(dueDateStr);
  return now >= dueDate;
}
