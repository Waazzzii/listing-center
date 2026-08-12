'use client';

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
import { FlaskConical } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ABTest } from '@/hooks/useABTests';

interface Props {
  tests: ABTest[];
}

const STATUS_BADGES: Record<
  string,
  { label: string; variant: 'secondary' | 'info' | 'warning' | 'danger' }
> = {
  pending: { label: 'Pending', variant: 'secondary' },
  active: { label: 'Active', variant: 'info' },
  snapshot_due: { label: 'Snapshot due', variant: 'warning' },
};

function daysRemaining(dueDate: string | null): { label: string; overdue: boolean } {
  if (!dueDate) return { label: '—', overdue: false };
  const due = new Date(dueDate);
  const now = new Date();
  const diff = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  if (diff < 0) return { label: `Overdue ${Math.abs(diff)}d`, overdue: true };
  if (diff === 0) return { label: 'Today', overdue: false };
  return { label: `${diff}d`, overdue: false };
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
      <Card>
        <CardContent className="p-0">
          <EmptyState
            icon={FlaskConical}
            title="No active A/B tests"
            description="Create a test to start optimizing listings with measurable, controlled changes."
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Property</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Thesis</TableHead>
              <TableHead>Target</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Progress</TableHead>
              <TableHead className="text-right">Before</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tests.map((test) => {
              const badge = STATUS_BADGES[test.status] || STATUS_BADGES.pending;
              const targetBefore = test.before_metrics?.[test.target_metric];
              const pct = progressPercent(test.change_executed_date, test.after_snapshot_due_date);
              const remaining = daysRemaining(test.after_snapshot_due_date);
              const variant = remaining.overdue ? 'danger' : badge.variant;

              return (
                <TableRow key={test.id}>
                  <TableCell className="font-medium">
                    {test.lc_properties?.property_name ||
                      test.property_name ||
                      test.property_id.slice(0, 8)}
                  </TableCell>
                  <TableCell className="text-muted-foreground capitalize">
                    {test.test_type.replace(/_/g, ' ')}
                  </TableCell>
                  <TableCell className="text-muted-foreground max-w-xs truncate">
                    {test.thesis}
                  </TableCell>
                  <TableCell className="text-muted-foreground capitalize">
                    {test.target_metric.replace(/_/g, ' ')}
                  </TableCell>
                  <TableCell>
                    <Badge variant={variant} dot>
                      {remaining.overdue ? 'Overdue' : badge.label}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className="w-20 bg-muted rounded-full h-1.5 overflow-hidden">
                        <div
                          className={cn(
                            'h-1.5 rounded-full transition-all',
                            remaining.overdue
                              ? 'bg-destructive'
                              : pct >= 100
                                ? 'bg-health-orange'
                                : 'bg-chart-2',
                          )}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span
                        className={cn(
                          'text-xs tabular-nums',
                          remaining.overdue
                            ? 'text-destructive font-medium'
                            : 'text-muted-foreground',
                        )}
                      >
                        {remaining.label}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground tabular-nums">
                    {targetBefore != null ? `${targetBefore}%` : '—'}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
