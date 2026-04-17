import { formatPct, formatNumber } from '@/lib/utils';
import type { TrendDirection } from '@/lib/utils';
import TrendArrow from './TrendArrow';
import type { HealthStatus } from '@/lib/types';
import { HEALTH_STATUS_CONFIG } from '@/lib/constants';

interface MetricCardProps {
  label: string;
  value: number | null;
  format: 'pct' | 'number' | 'rating';
  benchmark?: number | null;
  benchmarkLabel?: string;
  trend?: TrendDirection;
  status?: HealthStatus;
  upIsGood?: boolean;
}

export default function MetricCard({
  label,
  value,
  format,
  benchmark,
  benchmarkLabel,
  trend,
  status,
  upIsGood = true,
}: MetricCardProps) {
  const formattedValue =
    format === 'pct' ? formatPct(value) :
    format === 'rating' ? (value !== null && value !== undefined ? value.toFixed(2) : '\u2014') :
    formatNumber(value);

  const statusConfig = status ? HEALTH_STATUS_CONFIG[status] : null;
  const borderColor = statusConfig
    ? `border-l-4 ${statusConfig.bgColor.replace('bg-', 'border-')}`
    : 'border-l-4 border-transparent';

  return (
    <div className={`bg-[var(--card-bg)] rounded-lg border border-lc-border p-4 ${borderColor}`}>
      <p className="text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wider">{label}</p>
      <div className="mt-1 flex items-baseline gap-2">
        <span className="text-2xl font-bold text-[var(--text-primary)]">{formattedValue}</span>
        {trend && <TrendArrow direction={trend} upIsGood={upIsGood} />}
      </div>
      {benchmark !== null && benchmark !== undefined && (
        <p className="mt-1 text-xs text-[var(--text-muted)]">
          {benchmarkLabel || 'Benchmark'}: {format === 'pct' ? formatPct(benchmark) : formatNumber(benchmark)}
        </p>
      )}
    </div>
  );
}
