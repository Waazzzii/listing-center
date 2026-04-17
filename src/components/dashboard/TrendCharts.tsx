'use client';

import { useState, useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import InsufficientDataState from '@/components/shared/InsufficientDataState';
import { ChartSkeleton } from '@/components/shared/LoadingStates';
import { MIN_WEEKS_FOR_TRENDS } from '@/lib/constants';

interface TrendChartsProps {
  /** All latest snapshot data -- we aggregate portfolio-wide trends from this */
  snapshotsByWeek: Array<{
    week: string;
    avg_ctr: number | null;
    avg_conversion: number | null;
    avg_impression_rate: number | null;
  }>;
  weeksAvailable: number;
  isLoading: boolean;
}

type MetricToggle = 'all' | 'ctr' | 'conversion' | 'impression_rate';

const METRIC_LINES: Array<{
  key: string;
  label: string;
  color: string;
  dataKey: string;
}> = [
  { key: 'impression_rate', label: 'Impression Rate', color: '#3B82F6', dataKey: 'avg_impression_rate' },
  { key: 'ctr', label: 'CTR', color: '#8B5CF6', dataKey: 'avg_ctr' },
  { key: 'conversion', label: 'Conversion', color: '#22C55E', dataKey: 'avg_conversion' },
];

export default function TrendCharts({ snapshotsByWeek, weeksAvailable, isLoading }: TrendChartsProps) {
  const [activeMetric, setActiveMetric] = useState<MetricToggle>('all');

  const visibleLines = useMemo(() => {
    if (activeMetric === 'all') return METRIC_LINES;
    return METRIC_LINES.filter((m) => m.key === activeMetric);
  }, [activeMetric]);

  if (isLoading) return <ChartSkeleton height="h-80" />;

  if (weeksAvailable < MIN_WEEKS_FOR_TRENDS) {
    return (
      <div className="bg-[var(--card-bg)] rounded-lg border border-lc-border p-6">
        <h3 className="text-sm font-semibold text-[var(--text-secondary)] mb-4">Portfolio Trends (12-Week Trailing)</h3>
        <InsufficientDataState weeksAvailable={weeksAvailable} />
      </div>
    );
  }

  return (
    <div className="bg-[var(--card-bg)] rounded-lg border border-lc-border p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-[var(--text-secondary)]">Portfolio Trends (12-Week Trailing)</h3>

        {/* Toggle buttons */}
        <div className="flex items-center gap-1 bg-[var(--surface)] rounded-lg p-0.5">
          {[
            { key: 'all' as MetricToggle, label: 'All' },
            { key: 'impression_rate' as MetricToggle, label: 'Impressions' },
            { key: 'ctr' as MetricToggle, label: 'CTR' },
            { key: 'conversion' as MetricToggle, label: 'Conversion' },
          ].map((toggle) => (
            <button
              key={toggle.key}
              onClick={() => setActiveMetric(toggle.key)}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                activeMetric === toggle.key
                  ? 'bg-[var(--card-bg)] text-[var(--text-primary)] shadow-sm'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
              }`}
            >
              {toggle.label}
            </button>
          ))}
        </div>
      </div>

      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={snapshotsByWeek}>
          <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
          <XAxis
            dataKey="week"
            tick={{ fontSize: 11, fill: '#94A3B8' }}
            tickLine={false}
            axisLine={{ stroke: '#E2E8F0' }}
          />
          <YAxis
            tick={{ fontSize: 11, fill: '#94A3B8' }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v) => `${v}%`}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#fff',
              border: '1px solid #E2E8F0',
              borderRadius: '8px',
              fontSize: '12px',
            }}
            formatter={(value) => [`${Number(value)?.toFixed(1)}%`]}
          />
          <Legend
            verticalAlign="bottom"
            height={36}
            iconType="line"
            wrapperStyle={{ fontSize: '12px' }}
          />
          {visibleLines.map((line) => (
            <Line
              key={line.key}
              type="monotone"
              dataKey={line.dataKey}
              name={line.label}
              stroke={line.color}
              strokeWidth={2}
              dot={{ r: 3, fill: line.color }}
              activeDot={{ r: 5 }}
              connectNulls
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
