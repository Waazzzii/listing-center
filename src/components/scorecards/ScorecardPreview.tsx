'use client';

import React, { useState, useEffect } from 'react';
import ScorecardTemplate from './ScorecardTemplate';

interface Props {
  scorecardId: string;
  onClose: () => void;
  onStatusChange?: () => void;
}

// Scorecard data from the API — matches ScorecardTemplate's expected shape.
// Using React.ComponentProps to extract the exact type ScorecardTemplate expects.
type ScorecardPayload = React.ComponentProps<typeof ScorecardTemplate>['data'];

export default function ScorecardPreview({
  scorecardId,
  onClose,
  // onStatusChange reserved for Phase 4 delivery workflow
}: Props) {
  const [data, setData] = useState<ScorecardPayload | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchScorecard() {
      try {
        const res = await fetch(`/api/scorecards/${scorecardId}`);
        if (!res.ok) throw new Error(`API error: ${res.status}`);
        const json = await res.json() as { data?: { scorecard_data?: ScorecardPayload } };
        setData(json.data?.scorecard_data ?? null);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setIsLoading(false);
      }
    }
    fetchScorecard();
  }, [scorecardId]);

  // Close on escape key
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-card rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Sticky header */}
        <div className="border-b border-border px-6 py-4 flex justify-between items-center flex-shrink-0">
          <h2 className="text-lg font-bold text-foreground">
            Scorecard Preview
          </h2>
          <div className="flex items-center gap-3">
            <button
              className="px-3 py-1.5 bg-health-green text-white rounded-md text-sm font-medium hover:bg-health-green/90 transition-colors"
              title="Approve and mark as ready to send (delivery infrastructure TBD)"
            >
              Approve &amp; Send
            </button>
            <button
              onClick={onClose}
              className="text-muted-foreground hover:text-muted-foreground text-2xl leading-none transition-colors"
              aria-label="Close preview"
            >
              &times;
            </button>
          </div>
        </div>

        {/* Scrollable content */}
        <div className="p-6 overflow-y-auto flex-1">
          {isLoading && (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-24 bg-muted rounded-lg animate-pulse"
                />
              ))}
            </div>
          )}

          {error && (
            <div className="bg-destructive/10 border border-destructive/30 rounded-md p-4">
              <p className="text-sm text-destructive">
                Failed to load scorecard: {error}
              </p>
            </div>
          )}

          {!isLoading && !error && data && <ScorecardTemplate data={data} />}

          {!isLoading && !error && !data && (
            <div className="text-center py-8 text-muted-foreground">
              <p>Scorecard data is not yet available.</p>
              <p className="text-sm mt-1">
                This scorecard may still be pending generation.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
