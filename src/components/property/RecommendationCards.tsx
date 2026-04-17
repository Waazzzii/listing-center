'use client';

import { useState } from 'react';
import { formatDate } from '@/lib/utils';
import type { LcRecommendation } from '@/lib/types';

interface RecommendationCardsProps {
  recommendations: LcRecommendation[];
  onApprove: (id: string) => void;
  onReject: (id: string, reason: string) => void;
  onDefer: (id: string) => void;
  isLoading: boolean;
}

const SEVERITY_COLORS: Record<string, string> = {
  high: 'border-l-red-500',
  medium: 'border-l-amber-500',
  low: 'border-l-blue-500',
};

export default function RecommendationCards({
  recommendations,
  onApprove,
  onReject,
  onDefer,
  isLoading,
}: RecommendationCardsProps) {
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');

  const pending = recommendations.filter((r) => r.status === 'pending');
  const past = recommendations.filter((r) => r.status !== 'pending');

  if (isLoading) {
    return (
      <div className="bg-[var(--card-bg)] rounded-lg border border-lc-border p-6">
        <h3 className="text-sm font-semibold text-[var(--text-secondary)] mb-4">Recommendations</h3>
        <div className="animate-pulse space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-24 bg-[var(--surface)] rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[var(--card-bg)] rounded-lg border border-lc-border p-6">
      <h3 className="text-sm font-semibold text-[var(--text-secondary)] mb-4">
        Recommendations
        {pending.length > 0 && (
          <span className="ml-2 px-2 py-0.5 text-xs bg-red-100 text-red-700 rounded-full">
            {pending.length} pending
          </span>
        )}
      </h3>

      {recommendations.length === 0 ? (
        <p className="text-sm text-[var(--text-muted)]">No recommendations for this property yet.</p>
      ) : (
        <div className="space-y-3">
          {/* Pending recommendations first */}
          {pending.map((rec) => (
            <div
              key={rec.id}
              className={`border border-lc-border rounded-lg p-4 border-l-4 ${
                SEVERITY_COLORS[rec.severity || 'low'] || 'border-l-gray-300'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-[var(--text-primary)]">{rec.title}</span>
                    <span className="text-xs text-[var(--text-muted)] bg-[var(--surface)] px-1.5 py-0.5 rounded">
                      {rec.agent_name}
                    </span>
                  </div>
                  <p className="text-sm text-[var(--text-secondary)] mt-1">{rec.description}</p>
                  {rec.predicted_impact && (
                    <p className="text-xs text-green-600 mt-1">Expected: {rec.predicted_impact}</p>
                  )}
                  {rec.diagnosed_issue && (
                    <p className="text-xs text-[var(--text-muted)] mt-0.5">Issue: {rec.diagnosed_issue}</p>
                  )}
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex items-center gap-2 mt-3">
                <button
                  onClick={() => onApprove(rec.id)}
                  className="px-3 py-1.5 text-xs font-medium bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
                >
                  Approve
                </button>

                {rejectingId === rec.id ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={rejectionReason}
                      onChange={(e) => setRejectionReason(e.target.value)}
                      placeholder="Reason (optional)"
                      className="text-xs border border-[var(--border)] rounded px-2 py-1 w-48 bg-[var(--card-bg)] text-[var(--text-primary)]"
                      autoFocus
                    />
                    <button
                      onClick={() => {
                        onReject(rec.id, rejectionReason);
                        setRejectingId(null);
                        setRejectionReason('');
                      }}
                      className="px-2 py-1 text-xs font-medium bg-red-600 text-white rounded-md hover:bg-red-700"
                    >
                      Confirm
                    </button>
                    <button
                      onClick={() => { setRejectingId(null); setRejectionReason(''); }}
                      className="px-2 py-1 text-xs text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setRejectingId(rec.id)}
                    className="px-3 py-1.5 text-xs font-medium border border-red-300 text-red-600 rounded-md hover:bg-red-50 transition-colors"
                  >
                    Reject
                  </button>
                )}

                <button
                  onClick={() => onDefer(rec.id)}
                  className="px-3 py-1.5 text-xs font-medium border border-[var(--border)] text-[var(--text-secondary)] rounded-md hover:bg-[var(--table-row-hover)] transition-colors"
                >
                  Defer
                </button>
              </div>
            </div>
          ))}

          {/* Past recommendations (collapsed by default) */}
          {past.length > 0 && (
            <details className="mt-4">
              <summary className="text-xs text-[var(--text-muted)] cursor-pointer hover:text-[var(--text-secondary)]">
                {past.length} past recommendation{past.length !== 1 ? 's' : ''}
              </summary>
              <div className="mt-2 space-y-2">
                {past.map((rec) => (
                  <div key={rec.id} className="border border-[var(--border)] rounded-lg p-3 opacity-60">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-[var(--text-secondary)]">{rec.title}</span>
                      <span className={`text-xs px-1.5 py-0.5 rounded ${
                        rec.status === 'approved' ? 'bg-green-100 text-green-700' :
                        rec.status === 'rejected' ? 'bg-red-100 text-red-700' :
                        'bg-[var(--surface)] text-[var(--text-muted)]'
                      }`}>
                        {rec.status}
                      </span>
                    </div>
                    <p className="text-xs text-[var(--text-muted)] mt-0.5">
                      {rec.reviewed_by} on {formatDate(rec.reviewed_at)}
                    </p>
                  </div>
                ))}
              </div>
            </details>
          )}
        </div>
      )}
    </div>
  );
}
