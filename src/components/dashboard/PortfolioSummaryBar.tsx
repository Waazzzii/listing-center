'use client';

import { formatPct, formatNumber, computeTrend } from '@/lib/utils';
import TrendArrow from '@/components/shared/TrendArrow';
import DataFreshnessTag from '@/components/shared/DataFreshnessTag';
import { SummaryBarSkeleton } from '@/components/shared/LoadingStates';

interface SummaryData {
  total_properties: number;
  avg_ctr: number | null;
  avg_conversion: number | null;
  avg_impression_rate: number | null;
  red_count: number;
  orange_count: number;
  yellow_count: number;
  green_count: number;
  blue_count: number;
  unknown_count: number;
  last_scan_date: string | null;
}

interface PortfolioSummaryBarProps {
  summary: SummaryData | null;
  activeTests: number;
  pendingApprovals: number;
  reviewsNeedingAttention: number;
  /** Previous week summary for trend computation */
  previousSummary?: SummaryData | null;
  isLoading: boolean;
}

function SummaryMetric({
  label,
  value,
  trend,
}: {
  label: string;
  value: string;
  trend?: 'up' | 'down' | 'flat';
}) {
  return (
    <div className="flex flex-col">
      <span className="text-xs text-[var(--text-muted)] font-medium">{label}</span>
      <span className="flex items-center gap-1">
        <span className="text-sm font-semibold text-[var(--text-primary)]">{value}</span>
        {trend && <TrendArrow direction={trend} size="sm" />}
      </span>
    </div>
  );
}

function SummaryBadge({ label, count, variant }: { label: string; count: number; variant: 'red' | 'blue' | 'amber' }) {
  const colors = {
    red: count > 0 ? 'bg-red-100 text-red-700' : 'bg-[var(--surface)] text-[var(--text-muted)]',
    blue: count > 0 ? 'bg-[var(--badge-blue-bg)] text-[var(--badge-blue-text)]' : 'bg-[var(--surface)] text-[var(--text-muted)]',
    amber: count > 0 ? 'bg-[var(--badge-orange-bg)] text-[var(--badge-orange-text)]' : 'bg-[var(--surface)] text-[var(--text-muted)]',
  };

  return (
    <div className="flex flex-col">
      <span className="text-xs text-[var(--text-muted)] font-medium">{label}</span>
      <span className={`inline-flex items-center px-2 py-0.5 rounded text-sm font-semibold ${colors[variant]}`}>
        {count}
      </span>
    </div>
  );
}

export default function PortfolioSummaryBar({
  summary,
  activeTests,
  pendingApprovals,
  reviewsNeedingAttention,
  previousSummary,
  isLoading,
}: PortfolioSummaryBarProps) {
  if (isLoading || !summary) return <SummaryBarSkeleton />;

  const ctrTrend = computeTrend(summary.avg_ctr, previousSummary?.avg_ctr);
  const convTrend = computeTrend(summary.avg_conversion, previousSummary?.avg_conversion);
  const impTrend = computeTrend(summary.avg_impression_rate, previousSummary?.avg_impression_rate);

  return (
    <div className="sticky top-14 z-10 bg-[var(--card-bg)] border-b border-lc-border px-6 py-3 flex items-center gap-6 overflow-x-auto">
      <SummaryMetric
        label="Properties"
        value={formatNumber(summary.total_properties)}
      />

      <div className="w-px h-8 bg-[var(--border)]" />

      <SummaryMetric
        label="Avg CTR"
        value={formatPct(summary.avg_ctr)}
        trend={ctrTrend}
      />
      <SummaryMetric
        label="Avg Conversion"
        value={formatPct(summary.avg_conversion)}
        trend={convTrend}
      />
      <SummaryMetric
        label="Avg Impression Rate"
        value={formatPct(summary.avg_impression_rate)}
        trend={impTrend}
      />

      <div className="w-px h-8 bg-[var(--border)]" />

      <SummaryBadge label="Active Tests" count={activeTests} variant="blue" />
      <SummaryBadge label="Pending Approvals" count={pendingApprovals} variant="red" />
      <SummaryBadge label="Reviews" count={reviewsNeedingAttention} variant="amber" />

      <div className="w-px h-8 bg-[var(--border)]" />

      <DataFreshnessTag lastScanDate={summary.last_scan_date} />
    </div>
  );
}
