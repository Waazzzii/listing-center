'use client';

import { formatCurrency, formatPct } from '@/lib/utils';
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
  dotColor: string;
  textColor: string;
  borderColor: string;
}

export default function RevenuePaceCards({ summary, onPaceClick, activePace }: RevenuePaceCardsProps) {
  if (!summary) return null;

  const total = summary.pace_ahead_count + summary.pace_on_track_count + summary.pace_behind_count + summary.pace_at_risk_count;

  const paceCards: PaceCard[] = [
    {
      key: 'ahead',
      label: 'Ahead',
      count: summary.pace_ahead_count,
      dotColor: 'bg-health-green',
      textColor: 'text-health-green',
      borderColor: 'border-health-green',
    },
    {
      key: 'on_track',
      label: 'On Track',
      count: summary.pace_on_track_count,
      dotColor: 'bg-green-300',
      textColor: 'text-green-500',
      borderColor: 'border-green-300',
    },
    {
      key: 'behind',
      label: 'Behind',
      count: summary.pace_behind_count,
      dotColor: 'bg-health-orange',
      textColor: 'text-health-orange',
      borderColor: 'border-health-orange',
    },
    {
      key: 'at_risk',
      label: 'At Risk',
      count: summary.pace_at_risk_count,
      dotColor: 'bg-health-red',
      textColor: 'text-health-red',
      borderColor: 'border-health-red',
    },
  ];

  return (
    <div className="bg-[var(--card-bg)] rounded-lg border border-lc-border p-6">
      <h3 className="text-sm font-semibold text-[var(--text-secondary)] mb-4">Revenue Pace</h3>

      {/* Pace distribution cards */}
      <div className="grid grid-cols-4 gap-3 mb-4">
        {paceCards.map((card) => {
          const isActive = activePace === card.key;
          const isInactive = activePace !== null && !isActive;
          const pct = total > 0 ? ((card.count / total) * 100).toFixed(0) : '0';
          return (
            <button
              key={card.key}
              onClick={() => onPaceClick(card.key)}
              className={`flex flex-col items-center p-3 rounded-lg border transition-all ${
                isActive
                  ? `${card.borderColor} border-2 bg-[var(--surface)]`
                  : 'border-lc-border hover:bg-[var(--surface)]'
              } ${isInactive ? 'opacity-50' : ''}`}
            >
              <span className={`w-2.5 h-2.5 rounded-full ${card.dotColor} mb-1`} />
              <span className={`text-lg font-bold ${card.textColor}`}>{card.count}</span>
              <span className="text-xs text-[var(--text-muted)]">{card.label}</span>
              <span className="text-[10px] text-[var(--text-muted)]">{pct}%</span>
            </button>
          );
        })}
      </div>

      {activePace && (
        <div className="mb-3 text-center">
          <button
            onClick={() => onPaceClick(activePace)}
            className="text-xs text-lc-primary hover:underline"
          >
            Clear pace filter
          </button>
        </div>
      )}

      {/* Summary metrics row */}
      <div className="grid grid-cols-3 gap-4 pt-3 border-t border-lc-border">
        <div className="flex flex-col items-center">
          <span className="text-xs text-[var(--text-muted)] mb-0.5">Avg RevPAR</span>
          <span className="text-sm font-semibold text-[var(--text-primary)]">
            {formatCurrency(summary.avg_revpar)}
          </span>
        </div>
        <div className="flex flex-col items-center">
          <span className="text-xs text-[var(--text-muted)] mb-0.5">Avg Occ. 30d</span>
          <span className="text-sm font-semibold text-[var(--text-primary)]">
            {formatPct(summary.avg_occupancy_30d)}
          </span>
        </div>
        <div className="flex flex-col items-center">
          <span className="text-xs text-[var(--text-muted)] mb-0.5">Avg % to Proj</span>
          <span className="text-sm font-semibold text-[var(--text-primary)]">
            {formatPct(summary.avg_pct_to_projection, 0)}
          </span>
        </div>
      </div>
    </div>
  );
}
