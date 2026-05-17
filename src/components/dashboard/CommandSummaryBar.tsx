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

interface StatProps {
  label: string;
  value: React.ReactNode;
  hint?: string;
}

function Stat({ label, value, hint }: StatProps) {
  return (
    <div className="flex flex-col gap-0.5 min-w-0">
      <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground whitespace-nowrap">
        {label}
      </span>
      <span className="text-xl font-semibold text-foreground tabular-nums leading-none">
        {value}
      </span>
      {hint && <span className="text-[10px] text-muted-foreground">{hint}</span>}
    </div>
  );
}

interface CounterProps {
  label: string;
  count: number;
  variant: 'warning' | 'info' | 'default' | 'secondary';
}

function Counter({ label, count, variant }: CounterProps) {
  const active = count > 0;
  return (
    <div className="flex flex-col gap-1 min-w-0">
      <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground whitespace-nowrap">
        {label}
      </span>
      <Badge variant={active ? variant : 'secondary'} className="w-fit" dot={active}>
        {count}
      </Badge>
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
    summary.total_proposed_actions +
    summary.total_approved_actions +
    summary.total_executing_actions;

  return (
    <div className="px-6 pt-6">
      <Card>
        <CardContent className="p-5">
          <div className="flex items-start justify-between gap-6">
            {/* Left: portfolio totals */}
            <div className="flex items-start gap-8 flex-wrap">
              <Stat label="Properties" value={formatNumber(summary.total_properties)} />
              <Stat
                label="Avg Health"
                value={
                  <span className="flex items-baseline gap-1.5">
                    <span>{avgScore !== null ? avgScore.toFixed(0) : '—'}</span>
                    <Badge variant="secondary" className="text-[10px] py-0 px-1.5">
                      {avgGrade}
                    </Badge>
                  </span>
                }
              />
              <Stat label="Avg RevPAR" value={formatCurrency(summary.avg_revpar)} />
              <Stat label="Avg Occ. 30d" value={formatPct(summary.avg_occupancy_30d)} />
              <Stat label="% to Projection" value={formatPct(summary.avg_pct_to_projection, 0)} />
              <Stat
                label="Price Alignment"
                value={formatPct(summary.avg_price_alignment, 0)}
              />
            </div>

            {/* Right: action queue + freshness */}
            <div className="flex items-start gap-6 shrink-0">
              <Counter
                label="Pending"
                count={summary.total_pending_actions}
                variant="warning"
              />
              <Counter label="Tests" count={summary.total_active_tests} variant="info" />
              <Counter label="Queue" count={agentQueue} variant="default" />

              <div className="flex flex-col gap-0.5 pl-6 border-l border-border">
                <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground whitespace-nowrap">
                  Data freshness
                </span>
                <span className="text-sm font-semibold text-foreground">
                  {dataDate ? formatDate(dataDate) : 'No data'}
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
