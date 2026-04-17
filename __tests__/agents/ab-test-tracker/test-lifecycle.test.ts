import { describe, it, expect } from 'vitest';
import {
  determineNextStatus,
  isSnapshotDue,
  type TestRecord,
} from '../../../agents/ab-test-tracker/test-lifecycle';

function makeTest(overrides: Partial<TestRecord> = {}): TestRecord {
  return {
    id: 'test-1',
    property_id: 'prop-1',
    test_type: 'hero_photo',
    thesis: 'Pool aerial will increase CTR',
    target_metric: 'ctr',
    status: 'pending',
    before_snapshot_date: null,
    before_metrics: null,
    change_executed_date: null,
    after_snapshot_due_date: null,
    after_snapshot_date: null,
    after_metrics: null,
    soak_period_days: 14,
    minimum_impressions: 3000,
    ...overrides,
  };
}

describe('determineNextStatus', () => {
  it('moves pending to active when change is executed', () => {
    const test = makeTest({
      status: 'pending',
      before_metrics: { ctr: 7.2 },
      change_executed_date: '2026-04-01',
    });
    expect(determineNextStatus(test)).toBe('active');
  });

  it('keeps pending when no before snapshot yet', () => {
    const test = makeTest({ status: 'pending' });
    expect(determineNextStatus(test)).toBe('pending');
  });

  it('moves active to snapshot_due when soak period has elapsed', () => {
    const test = makeTest({
      status: 'active',
      before_metrics: { ctr: 7.2 },
      change_executed_date: '2026-03-15',
      after_snapshot_due_date: '2026-03-29',
    });
    const now = new Date('2026-04-06');
    expect(determineNextStatus(test, now)).toBe('snapshot_due');
  });

  it('keeps active when soak period has not elapsed', () => {
    const test = makeTest({
      status: 'active',
      before_metrics: { ctr: 7.2 },
      change_executed_date: '2026-04-01',
      after_snapshot_due_date: '2026-04-15',
    });
    const now = new Date('2026-04-06');
    expect(determineNextStatus(test, now)).toBe('active');
  });

  it('moves snapshot_due to completed when after snapshot is captured', () => {
    const test = makeTest({
      status: 'snapshot_due',
      before_metrics: { ctr: 7.2 },
      after_metrics: { ctr: 18.0 },
      after_snapshot_date: '2026-04-15',
    });
    expect(determineNextStatus(test)).toBe('completed');
  });

  it('keeps snapshot_due when after snapshot not yet captured', () => {
    const test = makeTest({
      status: 'snapshot_due',
      before_metrics: { ctr: 7.2 },
      after_metrics: null,
    });
    expect(determineNextStatus(test)).toBe('snapshot_due');
  });

  it('does not transition completed tests', () => {
    const test = makeTest({ status: 'completed' });
    expect(determineNextStatus(test)).toBe('completed');
  });

  it('does not transition cancelled tests', () => {
    const test = makeTest({ status: 'cancelled' });
    expect(determineNextStatus(test)).toBe('cancelled');
  });
});

describe('isSnapshotDue', () => {
  it('returns true when current date is past due date', () => {
    expect(isSnapshotDue('2026-03-29', new Date('2026-04-06'))).toBe(true);
  });

  it('returns true when current date equals due date', () => {
    expect(isSnapshotDue('2026-04-06', new Date('2026-04-06'))).toBe(true);
  });

  it('returns false when current date is before due date', () => {
    expect(isSnapshotDue('2026-04-15', new Date('2026-04-06'))).toBe(false);
  });

  it('returns false for null due date', () => {
    expect(isSnapshotDue(null, new Date('2026-04-06'))).toBe(false);
  });
});
