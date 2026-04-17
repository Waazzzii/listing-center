'use client';

import { formatDate } from '@/lib/utils';
import type { LcABTest } from '@/lib/types';

interface ABTestHistoryProps {
  tests: LcABTest[];
  isLoading: boolean;
}

const STATUS_BADGES: Record<string, { bg: string; text: string }> = {
  pending: { bg: 'bg-[var(--surface)]', text: 'text-[var(--text-secondary)]' },
  active: { bg: 'bg-[var(--badge-blue-bg)]', text: 'text-[var(--badge-blue-text)]' },
  snapshot_due: { bg: 'bg-amber-100', text: 'text-amber-700' },
  completed: { bg: 'bg-green-100', text: 'text-green-700' },
  cancelled: { bg: 'bg-red-100', text: 'text-red-600' },
};

const RESULT_BADGES: Record<string, { bg: string; text: string; label: string }> = {
  positive: { bg: 'bg-green-100', text: 'text-green-700', label: 'Positive' },
  negative: { bg: 'bg-red-100', text: 'text-red-700', label: 'Negative' },
  no_change: { bg: 'bg-[var(--surface)]', text: 'text-[var(--text-secondary)]', label: 'No Change' },
};

export default function ABTestHistory({ tests, isLoading }: ABTestHistoryProps) {
  if (isLoading) {
    return (
      <div className="bg-[var(--card-bg)] rounded-lg border border-lc-border p-6">
        <h3 className="text-sm font-semibold text-[var(--text-secondary)] mb-4">A/B Test History</h3>
        <div className="animate-pulse space-y-3">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="h-16 bg-[var(--surface)] rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  const active = tests.filter((t) => ['pending', 'active', 'snapshot_due'].includes(t.status));
  const completed = tests.filter((t) => ['completed', 'cancelled'].includes(t.status));

  return (
    <div className="bg-[var(--card-bg)] rounded-lg border border-lc-border p-6">
      <h3 className="text-sm font-semibold text-[var(--text-secondary)] mb-4">
        A/B Test History
        {active.length > 0 && (
          <span className="ml-2 px-2 py-0.5 text-xs bg-[var(--badge-blue-bg)] text-[var(--badge-blue-text)] rounded-full">
            {active.length} active
          </span>
        )}
      </h3>

      {tests.length === 0 ? (
        <p className="text-sm text-[var(--text-muted)]">No A/B tests for this property yet.</p>
      ) : (
        <div className="space-y-3">
          {/* Active tests */}
          {active.map((test) => {
            const statusStyle = STATUS_BADGES[test.status] || STATUS_BADGES.pending;

            return (
              <div key={test.id} className="border border-blue-200 rounded-lg p-3 bg-blue-50/30">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-[var(--text-primary)]">{test.test_type}</span>
                  <span className={`text-xs px-1.5 py-0.5 rounded ${statusStyle.bg} ${statusStyle.text}`}>
                    {test.status.replace('_', ' ')}
                  </span>
                </div>
                <p className="text-xs text-[var(--text-secondary)] mt-1">{test.thesis}</p>
                <div className="flex items-center gap-3 mt-2 text-xs text-[var(--text-muted)]">
                  <span>Target: {test.target_metric}</span>
                  <span>Started: {formatDate(test.change_executed_date)}</span>
                  {test.after_snapshot_due_date && (
                    <span>Snapshot due: {formatDate(test.after_snapshot_due_date)}</span>
                  )}
                </div>
              </div>
            );
          })}

          {/* Completed tests */}
          {completed.map((test) => {
            const resultStyle = test.result ? RESULT_BADGES[test.result] : null;

            return (
              <div key={test.id} className="border border-[var(--border)] rounded-lg p-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-[var(--text-secondary)]">{test.test_type}</span>
                  <div className="flex items-center gap-2">
                    {resultStyle && (
                      <span className={`text-xs px-1.5 py-0.5 rounded ${resultStyle.bg} ${resultStyle.text}`}>
                        {resultStyle.label}
                      </span>
                    )}
                    {test.metric_lift !== null && (
                      <span className={`text-xs font-medium ${
                        test.metric_lift > 0 ? 'text-green-600' : test.metric_lift < 0 ? 'text-red-600' : 'text-[var(--text-muted)]'
                      }`}>
                        {test.metric_lift > 0 ? '+' : ''}{test.metric_lift.toFixed(1)}%
                      </span>
                    )}
                  </div>
                </div>
                <p className="text-xs text-[var(--text-muted)] mt-1">{test.thesis}</p>
                {test.result_summary && (
                  <p className="text-xs text-[var(--text-secondary)] mt-1 italic">{test.result_summary}</p>
                )}
                <div className="flex items-center gap-3 mt-1 text-xs text-[var(--text-muted)]">
                  <span>{formatDate(test.before_snapshot_date)} - {formatDate(test.after_snapshot_date)}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
