'use client';

import { formatCurrency, formatPct, cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { CommandGridSummary } from '@/lib/types';

interface RevenuePaceCardsProps {
  summary: CommandGridSummary | null;
  onPaceClick: (status: string) => void;
  activePace: string | null;
}

interface PaceCard {
  key: string;
  label: string;
  count: number;
  dotClass: string;
  textClass: string;
}

export default function RevenuePaceCards({
  summary,
  onPaceClick,
  activePace,
}: RevenuePaceCardsProps) {
  if (!summary) return null;

  const total =
    summary.pace_ahead_count +
    summary.pace_on_track_count +
    summary.pace_behind_count +
    summary.pace_at_risk_count;

  const paceCards: PaceCard[] = [
    {
      key: 'ahead',
      label: 'Ahead',
      count: summary.pace_ahead_count,
      dotClass: 'bg-health-green',
      textClass: 'text-health-green',
    },
    {
      key: 'on_track',
      label: 'On track',
      count: summary.pace_on_track_count,
      dotClass: 'bg-chart-2',
      textClass: 'text-chart-2',
    },
    {
      key: 'behind',
      label: 'Behind',
      count: summary.pace_behind_count,
      dotClass: 'bg-health-orange',
      textClass: 'text-health-orange',
    },
    {
      key: 'at_risk',
      label: 'At risk',
      count: summary.pace_at_risk_count,
      dotClass: 'bg-health-red',
      textClass: 'text-health-red',
    },
  ];

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-3">
        <div>
          <CardTitle>Revenue Pace</CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            vs Wheelhouse projection · {total.toLocaleString()} properties
          </p>
        </div>
        {activePace && (
          <button
            type="button"
            onClick={() => onPaceClick(activePace)}
            className="text-xs text-primary hover:underline"
          >
            Clear filter
          </button>
        )}
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-4 gap-3">
          {paceCards.map((card) => {
            const isActive = activePace === card.key;
            const isDim = activePace !== null && !isActive;
            const pct = total > 0 ? ((card.count / total) * 100).toFixed(0) : '0';
            return (
              <button
                key={card.key}
                type="button"
                onClick={() => onPaceClick(card.key)}
                className={cn(
                  'flex flex-col items-start p-3 rounded-md border text-left transition-all',
                  isActive
                    ? 'border-foreground bg-accent'
                    : 'border-border hover:bg-accent/50',
                  isDim && 'opacity-50',
                )}
              >
                <span className={cn('w-2 h-2 rounded-full mb-2', card.dotClass)} />
                <span className={cn('text-2xl font-semibold tabular-nums', card.textClass)}>
                  {card.count}
                </span>
                <span className="text-xs text-muted-foreground mt-1">{card.label}</span>
                <span className="text-[10px] text-muted-foreground mt-0.5">{pct}%</span>
              </button>
            );
          })}
        </div>

        <div className="grid grid-cols-3 gap-4 pt-4 mt-4 border-t border-border">
          <div className="flex flex-col">
            <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
              Avg RevPAR
            </span>
            <span className="text-sm font-semibold text-foreground mt-1 tabular-nums">
              {formatCurrency(summary.avg_revpar)}
            </span>
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
              Avg Occ. 30d
            </span>
            <span className="text-sm font-semibold text-foreground mt-1 tabular-nums">
              {formatPct(summary.avg_occupancy_30d)}
            </span>
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
              Avg % to Proj
            </span>
            <span className="text-sm font-semibold text-foreground mt-1 tabular-nums">
              {formatPct(summary.avg_pct_to_projection, 0)}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
