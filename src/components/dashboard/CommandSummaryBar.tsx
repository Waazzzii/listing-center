'use client';

import { formatPct, formatNumber, formatCurrency, scoreToGrade, formatDate } from '@/lib/utils';
import { SummaryBarSkeleton } from '@/components/shared/LoadingStates';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { CommandGridSummary } from '@/lib/types';

interface CommandSummaryBarProps {
  summary: CommandGridSummary | null;
  dataDate: string | null;
  isLoading: boolean;
}

function Stat({ label, value, sublabel }: { label: string; value: React.ReactNode; sublabel?: string }) {
  return (
    <div className="flex flex-col min-w-0">
      <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <span className="text-xl font-semibold text-foreground tabular-nums leading-tight mt-0.5">
        {value}
      </span>
      {sublabel && <span className="text-[11px] text-muted-foreground mt-0.5">{sublabel}</span>}
    </div>
  );
}

export default function CommandSummaryBar({
  summary,
  dataDate,
  isLoading,
}: CommandSummaryBarProps) {
  if (isLoading || !summary) return <SummaryBarSkeleton />;

  const avgGrade = scoreToGrade(summary.avg_health_score);
  const avgScore = summary.avg_health_score;
  const agentQueue =
    summary.total_proposed_actions + summary.total_approved_actions + summary.total_executing_actions;

  return (
    <div className="px-6 pt-6">
      <Card>
        <CardContent className="p-5 flex flex-wrap items-center gap-x-8 gap-y-5">
          <Stat label="Properties" value={formatNumber(summary.total_properties)} />
          <Stat
            label="Avg Health"
            value={
              <span className="flex items-baseline gap-1.5">
                <span>{avgScore !== null ? avgScore.toFixed(0) : '—'}</span>
                <Badge variant="secondary" className="text-[10px] py-0">{avgGrade}</Badge>
              </span>
            }
          />
          <Stat label="Avg RevPAR" value={formatCurrency(summary.avg_revpar)} />
          <Stat label="Avg Occ. 30d" value={formatPct(summary.avg_occupancy_30d)} />
          <Stat label="% to Projection" value={formatPct(summary.avg_pct_to_projection, 0)} />

          <div className="h-10 w-px bg-border" />

          <div className="flex items-center gap-3">
            <div className="flex flex-col">
              <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Pending actions
              </span>
              <Badge
                variant={summary.total_pending_actions > 0 ? 'warning' : 'secondary'}
                className="mt-1 w-fit"
                dot={summary.total_pending_actions > 0}
              >
                {summary.total_pending_actions}
              </Badge>
            </div>
            <div className="flex flex-col">
              <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Active tests
              </span>
              <Badge
                variant={summary.total_active_tests > 0 ? 'info' : 'secondary'}
                className="mt-1 w-fit"
                dot={summary.total_active_tests > 0}
              >
                {summary.total_active_tests}
              </Badge>
            </div>
            <div className="flex flex-col">
              <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Agent queue
              </span>
              <Badge
                variant={agentQueue > 0 ? 'default' : 'secondary'}
                className="mt-1 w-fit"
                dot={agentQueue > 0}
              >
                {agentQueue}
              </Badge>
            </div>
          </div>

          <div className="h-10 w-px bg-border" />

          <Stat label="Price Alignment" value={formatPct(summary.avg_price_alignment, 0)} />

          <div className="ml-auto flex flex-col items-end">
            <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Data freshness
            </span>
            <span className="text-sm font-medium text-foreground mt-0.5">
              {dataDate ? formatDate(dataDate) : 'No data'}
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
