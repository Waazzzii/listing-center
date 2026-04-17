'use client';

import React from 'react';
import type { ABTest } from '@/hooks/useABTests';

interface Props {
  tests: ABTest[];
}

const RESULT_BADGES: Record<string, { label: string; color: string }> = {
  positive: { label: 'Positive', color: 'bg-green-100 text-green-700' },
  negative: { label: 'Negative', color: 'bg-red-100 text-red-700' },
  no_change: { label: 'No Change', color: 'bg-[var(--surface)] text-[var(--text-secondary)]' },
};

export default function CompletedTestsTable({ tests }: Props) {
  if (tests.length === 0) {
    return (
      <div className="text-center py-12 text-[var(--text-muted)]">
        <p className="text-lg font-medium">No completed tests yet</p>
        <p className="mt-1 text-sm">Results will appear here as tests complete their soak periods.</p>
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
            <th className="px-4 py-3 text-left text-xs font-medium text-[var(--text-muted)] uppercase">Result</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-[var(--text-muted)] uppercase">Lift</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-[var(--text-muted)] uppercase">Summary</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-[var(--text-muted)] uppercase">Decision</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-[var(--text-muted)] uppercase">Completed</th>
          </tr>
        </thead>
        <tbody className="bg-[var(--card-bg)] divide-y divide-[var(--border)]">
          {tests.map((test) => {
            const badge = RESULT_BADGES[test.result || 'no_change'] || RESULT_BADGES.no_change;
            const liftStr = test.metric_lift != null
              ? `${test.metric_lift > 0 ? '+' : ''}${test.metric_lift.toFixed(1)}%`
              : '\u2014';
            const liftColor = test.metric_lift != null
              ? test.metric_lift > 0 ? 'text-green-600' : test.metric_lift < 0 ? 'text-red-600' : 'text-[var(--text-secondary)]'
              : 'text-[var(--text-muted)]';

            return (
              <tr key={test.id} className="hover:bg-[var(--table-row-hover)]">
                <td className="px-4 py-3 text-sm font-medium text-[var(--text-primary)]">
                  {test.property_name || test.property_id.slice(0, 8)}
                </td>
                <td className="px-4 py-3 text-sm text-[var(--text-secondary)]">
                  {test.test_type.replace(/_/g, ' ')}
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${badge.color}`}>
                    {badge.label}
                  </span>
                </td>
                <td className={`px-4 py-3 text-sm font-semibold ${liftColor}`}>
                  {liftStr}
                </td>
                <td className="px-4 py-3 text-sm text-[var(--text-secondary)] max-w-sm truncate">
                  {test.result_summary || '\u2014'}
                </td>
                <td className="px-4 py-3 text-sm text-[var(--text-secondary)] capitalize">
                  {test.decision || '\u2014'}
                </td>
                <td className="px-4 py-3 text-sm text-[var(--text-muted)]">
                  {test.after_snapshot_date || '\u2014'}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
