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
    <div className={`bg-card rounded-md border border-border shadow-sm p-4 ${borderColor}`}>
      <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">{label}</p>
      <div className="mt-2 flex items-baseline gap-2">
        <span className="text-2xl font-semibold text-foreground tabular-nums leading-none">{formattedValue}</span>
        {trend && <TrendArrow direction={trend} upIsGood={upIsGood} />}
      </div>
      {benchmark !== null && benchmark !== undefined && (
        <p className="mt-1.5 text-[11px] text-muted-foreground">
          {benchmarkLabel || 'Benchmark'}: {format === 'pct' ? formatPct(benchmark) : formatNumber(benchmark)}
        </p>
      )}
    </div>
  );
}
