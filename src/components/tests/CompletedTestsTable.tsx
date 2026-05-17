'use client';

import React from 'react';
import type { ABTest } from '@/hooks/useABTests';

interface Props {
  tests: ABTest[];
}

const RESULT_BADGES: Record<string, { label: string; color: string }> = {
  positive: { label: 'Positive', color: 'bg-health-green/15 text-health-green' },
  negative: { label: 'Negative', color: 'bg-destructive/15 text-destructive' },
  no_change: { label: 'No Change', color: 'bg-muted text-muted-foreground' },
};

export default function CompletedTestsTable({ tests }: Props) {
  if (tests.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p className="text-lg font-medium">No completed tests yet</p>
        <p className="mt-1 text-sm">Results will appear here as tests complete their soak periods.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-[var(--border)]">
        <thead className="bg-muted">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Property</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Type</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Result</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Lift</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Summary</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Decision</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Completed</th>
          </tr>
        </thead>
        <tbody className="bg-card divide-y divide-[var(--border)]">
          {tests.map((test) => {
            const badge = RESULT_BADGES[test.result || 'no_change'] || RESULT_BADGES.no_change;
            const liftStr = test.metric_lift != null
              ? `${test.metric_lift > 0 ? '+' : ''}${test.metric_lift.toFixed(1)}%`
              : '\u2014';
            const liftColor = test.metric_lift != null
              ? test.metric_lift > 0 ? 'text-health-green' : test.metric_lift < 0 ? 'text-destructive' : 'text-muted-foreground'
              : 'text-muted-foreground';

            return (
              <tr key={test.id} className="hover:bg-accent">
                <td className="px-4 py-3 text-sm font-medium text-foreground">
                  {test.property_name || test.property_id.slice(0, 8)}
                </td>
                <td className="px-4 py-3 text-sm text-muted-foreground">
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
                <td className="px-4 py-3 text-sm text-muted-foreground max-w-sm truncate">
                  {test.result_summary || '\u2014'}
                </td>
                <td className="px-4 py-3 text-sm text-muted-foreground capitalize">
                  {test.decision || '\u2014'}
                </td>
                <td className="px-4 py-3 text-sm text-muted-foreground">
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
