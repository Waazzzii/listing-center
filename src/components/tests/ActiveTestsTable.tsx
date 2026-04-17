'use client';

import React from 'react';
import type { ABTest } from '@/hooks/useABTests';

interface Props {
  tests: ABTest[];
}

const STATUS_BADGES: Record<string, { label: string; color: string }> = {
  pending: { label: 'Pending', color: 'bg-[var(--surface)] text-[var(--text-secondary)]' },
  active: { label: 'Active', color: 'bg-[var(--badge-blue-bg)] text-[var(--badge-blue-text)]' },
  snapshot_due: { label: 'Snapshot Due', color: 'bg-yellow-100 text-yellow-700' },
};

function daysRemaining(dueDate: string | null): string {
  if (!dueDate) return '\u2014';
  const due = new Date(dueDate);
  const now = new Date();
  const diff = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  if (diff < 0) return 'Overdue';
  if (diff === 0) return 'Today';
  return `${diff}d`;
}

function progressPercent(changeDate: string | null, dueDate: string | null): number {
  if (!changeDate || !dueDate) return 0;
  const start = new Date(changeDate).getTime();
  const end = new Date(dueDate).getTime();
  const now = Date.now();
  if (end <= start) return 100;
  const pct = ((now - start) / (end - start)) * 100;
  return Math.min(Math.max(Math.round(pct), 0), 100);
}

export default function ActiveTestsTable({ tests }: Props) {
  if (tests.length === 0) {
    return (
      <div className="text-center py-12 text-[var(--text-muted)]">
        <p className="text-lg font-medium">No active A/B tests</p>
        <p className="mt-1 text-sm">Create a test to start optimizing listings.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-[var(--border)]">
        <thead className="bg-[var(--surface)]">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-medium text-[var(--text-muted)] uppercase">Property</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-[var(--text-muted)] uppercase">Type</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-[var(--text-muted)] uppercase">Thesis</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-[var(--text-muted)] uppercase">Target</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-[var(--text-muted)] uppercase">Status</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-[var(--text-muted)] uppercase">Progress</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-[var(--text-muted)] uppercase">Before</th>
          </tr>
        </thead>
        <tbody className="bg-[var(--card-bg)] divide-y divide-[var(--border)]">
          {tests.map((test) => {
            const badge = STATUS_BADGES[test.status] || STATUS_BADGES.pending;
            const targetBefore = test.before_metrics?.[test.target_metric];
            const pct = progressPercent(test.change_executed_date, test.after_snapshot_due_date);
            const remaining = daysRemaining(test.after_snapshot_due_date);

            return (
              <tr key={test.id} className="hover:bg-[var(--table-row-hover)]">
                <td className="px-4 py-3 text-sm font-medium text-[var(--text-primary)]">
                  {test.property_name || test.property_id.slice(0, 8)}
                </td>
                <td className="px-4 py-3 text-sm text-[var(--text-secondary)]">
                  {test.test_type.replace(/_/g, ' ')}
                </td>
                <td className="px-4 py-3 text-sm text-[var(--text-secondary)] max-w-xs truncate">
                  {test.thesis}
                </td>
                <td className="px-4 py-3 text-sm text-[var(--text-secondary)]">
                  {test.target_metric.replace(/_/g, ' ')}
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${badge.color}`}>
                    {badge.label}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="w-20 bg-[var(--surface)] rounded-full h-1.5">
                      <div
                        className={`h-1.5 rounded-full ${
                          pct >= 100 ? 'bg-yellow-500' : 'bg-blue-500'
                        }`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="text-xs text-[var(--text-muted)]">{remaining}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-sm text-[var(--text-secondary)]">
                  {targetBefore != null ? `${targetBefore}%` : '\u2014'}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
