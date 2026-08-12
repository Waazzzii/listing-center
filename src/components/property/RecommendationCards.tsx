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
      <div className="bg-card rounded-lg border border-border p-6">
        <h3 className="text-sm font-semibold text-muted-foreground mb-4">Recommendations</h3>
        <div className="animate-pulse space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-24 bg-muted rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card rounded-lg border border-border p-6">
      <h3 className="text-sm font-semibold text-muted-foreground mb-4">
        Recommendations
        {pending.length > 0 && (
          <span className="ml-2 px-2 py-0.5 text-xs bg-destructive/15 text-destructive rounded-full">
            {pending.length} pending
          </span>
        )}
      </h3>

      {recommendations.length === 0 ? (
        <p className="text-sm text-muted-foreground">No recommendations for this property yet.</p>
      ) : (
        <div className="space-y-3">
          {/* Pending recommendations first */}
          {pending.map((rec) => (
            <div
              key={rec.id}
              className={`border border-border rounded-lg p-4 border-l-4 ${
                SEVERITY_COLORS[rec.severity || 'low'] || 'border-l-gray-300'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-foreground">{rec.title}</span>
                    <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                      {rec.agent_name}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">{rec.description}</p>
                  {rec.predicted_impact && (
                    <p className="text-xs text-health-green mt-1">Expected: {rec.predicted_impact}</p>
                  )}
                  {rec.diagnosed_issue && (
                    <p className="text-xs text-muted-foreground mt-0.5">Issue: {rec.diagnosed_issue}</p>
                  )}
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex items-center gap-2 mt-3">
                <button
                  onClick={() => onApprove(rec.id)}
                  className="px-3 py-1.5 text-xs font-medium bg-health-green text-white rounded-md hover:bg-health-green/90 transition-colors"
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
                      className="text-xs border border-border rounded px-2 py-1 w-48 bg-card text-foreground"
                      autoFocus
                    />
                    <button
                      onClick={() => {
                        onReject(rec.id, rejectionReason);
                        setRejectingId(null);
                        setRejectionReason('');
                      }}
                      className="px-2 py-1 text-xs font-medium bg-destructive text-white rounded-md hover:bg-destructive/90"
                    >
                      Confirm
                    </button>
                    <button
                      onClick={() => { setRejectingId(null); setRejectionReason(''); }}
                      className="px-2 py-1 text-xs text-muted-foreground hover:text-muted-foreground"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setRejectingId(rec.id)}
                    className="px-3 py-1.5 text-xs font-medium border border-destructive/40 text-destructive rounded-md hover:bg-destructive/10 transition-colors"
                  >
                    Reject
                  </button>
                )}

                <button
                  onClick={() => onDefer(rec.id)}
                  className="px-3 py-1.5 text-xs font-medium border border-border text-muted-foreground rounded-md hover:bg-accent transition-colors"
                >
                  Defer
                </button>
              </div>
            </div>
          ))}

          {/* Past recommendations (collapsed by default) */}
          {past.length > 0 && (
            <details className="mt-4">
              <summary className="text-xs text-muted-foreground cursor-pointer hover:text-muted-foreground">
                {past.length} past recommendation{past.length !== 1 ? 's' : ''}
              </summary>
              <div className="mt-2 space-y-2">
                {past.map((rec) => (
                  <div key={rec.id} className="border border-border rounded-lg p-3 opacity-60">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">{rec.title}</span>
                      <span className={`text-xs px-1.5 py-0.5 rounded ${
                        rec.status === 'approved' ? 'bg-health-green/15 text-health-green' :
                        rec.status === 'rejected' ? 'bg-destructive/15 text-destructive' :
                        'bg-muted text-muted-foreground'
                      }`}>
                        {rec.status}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
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
