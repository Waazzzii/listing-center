'use client';

import React, { useState } from 'react';
import { useScorecards } from '@/hooks/useScorecards';
import ScorecardQueue from '@/components/scorecards/ScorecardQueue';
import ScorecardPreview from '@/components/scorecards/ScorecardPreview';

export default function ScorecardsPage() {
  const { scorecards, isLoading, error, refresh } = useScorecards();
  const [previewId, setPreviewId] = useState<string | null>(null);

  const statusCounts = {
    pending: scorecards.filter((s) => s.generation_status === 'pending').length,
    generated: scorecards.filter((s) => s.generation_status === 'generated')
      .length,
    sent: scorecards.filter((s) => s.generation_status === 'sent').length,
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">
            Owner Listing Scorecards
          </h1>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            Monthly per-property reports for owners. Preview and approve before
            sending.
          </p>
        </div>
        <button
          onClick={refresh}
          className="px-4 py-2 bg-[var(--card-bg)] border border-[var(--border)] rounded-md text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--table-row-hover)] transition-colors"
        >
          Refresh
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-[var(--text-primary)]">
            {statusCounts.pending}
          </div>
          <div className="text-sm text-[var(--text-muted)]">Pending Generation</div>
        </div>
        <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-blue-600">
            {statusCounts.generated}
          </div>
          <div className="text-sm text-[var(--text-muted)]">Ready for Review</div>
        </div>
        <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-green-600">
            {statusCounts.sent}
          </div>
          <div className="text-sm text-[var(--text-muted)]">Sent to Owners</div>
        </div>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-16 bg-[var(--surface)] rounded-lg animate-pulse"
            />
          ))}
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-6">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Queue Table */}
      {!isLoading && !error && (
        <ScorecardQueue
          scorecards={scorecards}
          onPreview={(id) => setPreviewId(id)}
        />
      )}

      {/* Preview Modal */}
      {previewId && (
        <ScorecardPreview
          scorecardId={previewId}
          onClose={() => setPreviewId(null)}
          onStatusChange={refresh}
        />
      )}
    </div>
  );
}
