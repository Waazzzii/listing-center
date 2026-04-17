'use client';

import { formatPct, formatNumber, formatCurrency, scoreToGrade, formatDate } from '@/lib/utils';
import { SummaryBarSkeleton } from '@/components/shared/LoadingStates';
import type { CommandGridSummary } from '@/lib/types';

interface CommandSummaryBarProps {
  summary: CommandGridSummary | null;
  dataDate: string | null;
  isLoading: boolean;
}

function SummaryMetric({ label, value, className = '' }: { label: string; value: string; className?: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-xs text-white/70 font-medium">{label}</span>
      <span className={`text-sm font-semibold text-white ${className}`}>{value}</span>
    </div>
  );
}

function SummaryBadge({ label, count, variant }: { label: string; count: number; variant: 'amber' | 'blue' | 'purple' }) {
  const colors = {
    amber: count > 0
      ? 'bg-orange-400/20 text-orange-200 border-orange-400/40'
      : 'bg-white/10 text-white/50 border-white/10',
    blue: count > 0
      ? 'bg-blue-400/20 text-blue-200 border-blue-400/40'
      : 'bg-white/10 text-white/50 border-white/10',
    purple: count > 0
      ? 'bg-purple-400/20 text-purple-200 border-purple-400/40'
      : 'bg-white/10 text-white/50 border-white/10',
  };

  return (
    <div className="flex flex-col">
      <span className="text-xs text-white/70 font-medium">{label}</span>
      <span className={`inline-flex items-center justify-center px-2 py-0.5 rounded border text-sm font-semibold ${colors[variant]}`}>
        {count}
      </span>
    </div>
  );
}

export default function CommandSummaryBar({ summary, dataDate, isLoading }: CommandSummaryBarProps) {
  if (isLoading || !summary) return <SummaryBarSkeleton />;

  const avgGrade = scoreToGrade(summary.avg_health_score);
  const avgScore = summary.avg_health_score;

  return (
    <div className="sticky top-14 z-10 bg-casago-blue dark:bg-casago-blue/80 border-b border-casago-blue/30 px-6 py-3 flex items-center gap-6 overflow-x-auto">
      <SummaryMetric
        label="Properties"
        value={formatNumber(summary.total_properties)}
      />

      <div className="w-px h-8 bg-white/20" />

      <div className="flex flex-col">
        <span className="text-xs text-white/70 font-medium">Avg Health</span>
        <span className="flex items-center gap-1">
          <span className="text-sm font-bold text-white">
            {avgScore !== null ? avgScore.toFixed(0) : '\u2014'}
          </span>
          <span className="text-xs font-semibold text-white/80">{avgGrade}</span>
        </span>
      </div>

      <SummaryMetric
        label="Avg RevPAR"
        value={formatCurrency(summary.avg_revpar)}
      />

      <SummaryMetric
        label="Avg Occ. 30d"
        value={formatPct(summary.avg_occupancy_30d)}
      />

      <SummaryMetric
        label="% to Projection"
        value={formatPct(summary.avg_pct_to_projection, 0)}
      />

      <div className="w-px h-8 bg-white/20" />

      <SummaryBadge label="Pending Actions" count={summary.total_pending_actions} variant="amber" />
      <SummaryBadge label="Active Tests" count={summary.total_active_tests} variant="blue" />
      <SummaryBadge label="Agent Queue" count={summary.total_proposed_actions + summary.total_approved_actions + summary.total_executing_actions} variant="purple" />

      <div className="w-px h-8 bg-white/20" />

      <SummaryMetric
        label="Price Alignment"
        value={formatPct(summary.avg_price_alignment, 0)}
      />

      <div className="w-px h-8 bg-white/20" />

      <div className="flex flex-col">
        <span className="text-xs text-white/70 font-medium">Data</span>
        <span className="text-xs text-white/60">
          {dataDate ? formatDate(dataDate) : 'No data'}
        </span>
      </div>
    </div>
  );
}
