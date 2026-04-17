'use client';

import React, { useState } from 'react';
import type { ScorecardUI } from '@/hooks/useScorecards';

interface Props {
  scorecards: ScorecardUI[];
  onPreview: (id: string) => void;
}

const STATUS_BADGES: Record<string, { label: string; color: string }> = {
  pending: { label: 'Pending', color: 'bg-[var(--surface)] text-[var(--text-secondary)]' },
  generated: { label: 'Generated', color: 'bg-[var(--badge-blue-bg)] text-[var(--badge-blue-text)]' },
  reviewed: { label: 'Reviewed', color: 'bg-yellow-100 text-yellow-700' },
  sent: { label: 'Sent', color: 'bg-green-100 text-green-700' },
  failed: { label: 'Failed', color: 'bg-red-100 text-red-700' },
};

type StatusFilter = 'all' | 'pending' | 'generated' | 'reviewed' | 'sent' | 'failed';

export default function ScorecardQueue({ scorecards, onPreview }: Props) {
  const [filter, setFilter] = useState<StatusFilter>('all');

  const filtered =
    filter === 'all'
      ? scorecards
      : scorecards.filter((s) => s.generation_status === filter);

  if (scorecards.length === 0) {
    return (
      <div className="text-center py-12 text-[var(--text-muted)]">
        <p className="text-lg font-medium">No scorecards generated yet</p>
        <p className="mt-1 text-sm">
          Scorecards are generated monthly at the end of each month.
        </p>
      </div>
    );
  }

  return (
    <div>
      {/* Filter tabs */}
      <div className="flex gap-2 mb-4">
        {(['all', 'pending', 'generated', 'reviewed', 'sent', 'failed'] as StatusFilter[]).map(
          (status) => {
            const count =
              status === 'all'
                ? scorecards.length
                : scorecards.filter((s) => s.generation_status === status).length;
            return (
              <button
                key={status}
                onClick={() => setFilter(status)}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  filter === status
                    ? 'bg-[var(--sidebar-bg)] text-white'
                    : 'bg-[var(--surface)] text-[var(--text-secondary)] hover:bg-[var(--table-row-hover)]'
                }`}
              >
                {status.charAt(0).toUpperCase() + status.slice(1)}{' '}
                <span className="ml-1 text-xs opacity-75">({count})</span>
              </button>
            );
          }
        )}
      </div>

      {/* Table */}
      <div className="overflow-x-auto bg-[var(--card-bg)] border border-[var(--border)] rounded-lg">
        <table className="min-w-full divide-y divide-[var(--border)]">
          <thead className="bg-[var(--surface)]">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-[var(--text-muted)] uppercase">
                Property
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-[var(--text-muted)] uppercase">
                Market
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-[var(--text-muted)] uppercase">
                Report Month
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-[var(--text-muted)] uppercase">
                Status
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-[var(--text-muted)] uppercase">
                Generated
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-[var(--text-muted)] uppercase">
                Delivered
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-[var(--text-muted)] uppercase">
                Action
              </th>
            </tr>
          </thead>
          <tbody className="bg-[var(--card-bg)] divide-y divide-[var(--border)]">
            {filtered.map((sc) => {
              const badge =
                STATUS_BADGES[sc.generation_status] || STATUS_BADGES.pending;
              const monthDate = new Date(sc.report_month + 'T00:00:00');
              const monthLabel = monthDate.toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
              });

              return (
                <tr key={sc.id} className="hover:bg-[var(--table-row-hover)]">
                  <td className="px-4 py-3 text-sm font-medium text-[var(--text-primary)]">
                    {sc.property_name || sc.property_id.slice(0, 8)}
                  </td>
                  <td className="px-4 py-3 text-sm text-[var(--text-secondary)] capitalize">
                    {(sc.market || '').replace(/_/g, ' ')}
                  </td>
                  <td className="px-4 py-3 text-sm text-[var(--text-secondary)]">
                    {monthLabel}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${badge.color}`}
                    >
                      {badge.label}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-[var(--text-muted)]">
                    {sc.generated_at
                      ? new Date(sc.generated_at).toLocaleDateString()
                      : '\u2014'}
                  </td>
                  <td className="px-4 py-3 text-sm text-[var(--text-muted)]">
                    {sc.delivered_at
                      ? new Date(sc.delivered_at).toLocaleDateString()
                      : '\u2014'}
                  </td>
                  <td className="px-4 py-3">
                    {sc.generation_status === 'generated' ||
                    sc.generation_status === 'reviewed' ? (
                      <button
                        onClick={() => onPreview(sc.id)}
                        className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                      >
                        Preview
                      </button>
                    ) : sc.generation_status === 'sent' ? (
                      <button
                        onClick={() => onPreview(sc.id)}
                        className="text-sm text-[var(--text-muted)] hover:text-[var(--text-secondary)] font-medium"
                      >
                        View
                      </button>
                    ) : (
                      <span className="text-sm text-[var(--text-muted)]">{'\u2014'}</span>
                    )}
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td
                  colSpan={7}
                  className="px-4 py-8 text-center text-sm text-[var(--text-muted)]"
                >
                  No scorecards match this filter.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
