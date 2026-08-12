'use client';

import { useState } from 'react';
import { FileBarChart } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { MARKET_LABELS } from '@/lib/constants';
import { cn } from '@/lib/utils';
import type { ScorecardUI } from '@/hooks/useScorecards';

interface Props {
  scorecards: ScorecardUI[];
  onPreview: (id: string) => void;
}

const STATUS_VARIANT: Record<
  string,
  { variant: 'secondary' | 'info' | 'warning' | 'success' | 'danger'; label: string }
> = {
  pending: { variant: 'secondary', label: 'Pending' },
  generated: { variant: 'info', label: 'Generated' },
  reviewed: { variant: 'warning', label: 'Reviewed' },
  sent: { variant: 'success', label: 'Sent' },
  failed: { variant: 'danger', label: 'Failed' },
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
      <Card>
        <CardContent className="p-0">
          <EmptyState
            icon={FileBarChart}
            title="No scorecards generated yet"
            description="Scorecards are generated monthly at the end of each month."
          />
        </CardContent>
      </Card>
    );
  }

  const tabs: StatusFilter[] = ['all', 'pending', 'generated', 'reviewed', 'sent', 'failed'];

  return (
    <div className="space-y-4">
      {/* Filter pills */}
      <div className="flex gap-2 flex-wrap">
        {tabs.map((status) => {
          const count =
            status === 'all'
              ? scorecards.length
              : scorecards.filter((s) => s.generation_status === status).length;
          if (status !== 'all' && count === 0) return null;
          return (
            <button
              key={status}
              type="button"
              onClick={() => setFilter(status)}
              className={cn(
                'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
                filter === status
                  ? 'bg-foreground text-background'
                  : 'bg-card border border-border text-muted-foreground hover:bg-accent hover:text-foreground',
              )}
            >
              {status.charAt(0).toUpperCase() + status.slice(1)}
              <span
                className={cn(
                  'text-xs tabular-nums',
                  filter === status ? 'opacity-70' : 'text-muted-foreground',
                )}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      <Card>
        <CardContent className="p-0">
          {filtered.length === 0 ? (
            <EmptyState title="No scorecards match this filter" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Property</TableHead>
                  <TableHead>Market</TableHead>
                  <TableHead>Report month</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Generated</TableHead>
                  <TableHead>Delivered</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((sc) => {
                  const cfg = STATUS_VARIANT[sc.generation_status] || STATUS_VARIANT.pending;
                  const monthDate = new Date(sc.report_month + 'T00:00:00');
                  const monthLabel = monthDate.toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                  });
                  const canPreview =
                    sc.generation_status === 'generated' ||
                    sc.generation_status === 'reviewed' ||
                    sc.generation_status === 'sent';
                  return (
                    <TableRow key={sc.id}>
                      <TableCell className="font-medium">
                        {sc.property_name || sc.property_id.slice(0, 8)}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {MARKET_LABELS[sc.market || ''] || sc.market || '—'}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{monthLabel}</TableCell>
                      <TableCell>
                        <Badge variant={cfg.variant} dot>
                          {cfg.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground tabular-nums">
                        {sc.generated_at
                          ? new Date(sc.generated_at).toLocaleDateString()
                          : '—'}
                      </TableCell>
                      <TableCell className="text-muted-foreground tabular-nums">
                        {sc.delivered_at
                          ? new Date(sc.delivered_at).toLocaleDateString()
                          : '—'}
                      </TableCell>
                      <TableCell className="text-right">
                        {canPreview ? (
                          <button
                            type="button"
                            onClick={() => onPreview(sc.id)}
                            className="text-sm font-medium text-primary hover:underline"
                          >
                            {sc.generation_status === 'sent' ? 'View' : 'Preview'}
                          </button>
                        ) : (
                          <span className="text-sm text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
