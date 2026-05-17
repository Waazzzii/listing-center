'use client';

import { useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { useScorecards } from '@/hooks/useScorecards';
import ScorecardQueue from '@/components/scorecards/ScorecardQueue';
import ScorecardPreview from '@/components/scorecards/ScorecardPreview';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function ScorecardsPage() {
  const { scorecards, isLoading, error, refresh } = useScorecards();
  const [previewId, setPreviewId] = useState<string | null>(null);

  const statusCounts = {
    pending: scorecards.filter((s) => s.generation_status === 'pending').length,
    generated: scorecards.filter((s) => s.generation_status === 'generated').length,
    sent: scorecards.filter((s) => s.generation_status === 'sent').length,
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Owner Listing Scorecards
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Monthly per-property reports for owners. Preview and approve before sending.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={refresh}>
          <RefreshCw className="h-3.5 w-3.5" />
          Refresh
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-semibold tabular-nums text-foreground">
              {statusCounts.pending}
            </div>
            <div className="text-xs uppercase tracking-wide text-muted-foreground mt-1">
              Pending generation
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-semibold tabular-nums text-chart-2">
              {statusCounts.generated}
            </div>
            <div className="text-xs uppercase tracking-wide text-muted-foreground mt-1">
              Ready for review
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-semibold tabular-nums text-health-green">
              {statusCounts.sent}
            </div>
            <div className="text-xs uppercase tracking-wide text-muted-foreground mt-1">
              Sent to owners
            </div>
          </CardContent>
        </Card>
      </div>

      {isLoading && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 bg-muted rounded-md animate-pulse" />
          ))}
        </div>
      )}

      {error && (
        <Card className="border-destructive/40 bg-destructive/5">
          <CardContent className="p-4">
            <p className="text-sm text-destructive">{error}</p>
          </CardContent>
        </Card>
      )}

      {!isLoading && !error && (
        <ScorecardQueue scorecards={scorecards} onPreview={(id) => setPreviewId(id)} />
      )}

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
