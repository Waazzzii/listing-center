'use client';

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { HEALTH_STATUS_CONFIG } from '@/lib/constants';
import type { HealthStatus } from '@/lib/types';

interface HealthCounts {
  red_count: number;
  orange_count: number;
  yellow_count: number;
  green_count: number;
  blue_count: number;
  unknown_count: number;
}

interface HealthDistributionProps {
  counts: HealthCounts | null;
  onSegmentClick?: (status: HealthStatus) => void;
  activeFilter?: HealthStatus | null;
}

const STATUS_KEYS: Array<{ key: keyof HealthCounts; status: HealthStatus }> = [
  { key: 'red_count', status: 'red' },
  { key: 'orange_count', status: 'orange' },
  { key: 'yellow_count', status: 'yellow' },
  { key: 'green_count', status: 'green' },
  { key: 'blue_count', status: 'blue_spell' },
  { key: 'unknown_count', status: 'unknown' },
];

const COLORS: Record<HealthStatus, string> = {
  red: '#EF4444',
  orange: '#F97316',
  yellow: '#EAB308',
  green: '#22C55E',
  blue_spell: '#3B82F6',
  unknown: '#D1D5DB',
};

interface ChartDataPoint {
  name: string;
  value: number;
  status: HealthStatus;
  fill: string;
}

export default function HealthDistribution({ counts, onSegmentClick, activeFilter }: HealthDistributionProps) {
  if (!counts) return null;

  const chartData: ChartDataPoint[] = STATUS_KEYS
    .map(({ key, status }) => ({
      name: HEALTH_STATUS_CONFIG[status].label,
      value: counts[key] || 0,
      status,
      fill: COLORS[status],
    }))
    .filter((d) => d.value > 0);

  const total = chartData.reduce((sum, d) => sum + d.value, 0);

  if (total === 0) {
    return (
      <div className="bg-[var(--card-bg)] rounded-lg border border-lc-border p-6 text-center text-[var(--text-muted)]">
        No property data available
      </div>
    );
  }

  return (
    <div className="bg-[var(--card-bg)] rounded-lg border border-lc-border p-6">
      <h3 className="text-sm font-semibold text-[var(--text-secondary)] mb-4">Health Distribution</h3>

      <div className="flex items-center gap-8">
        {/* Donut chart */}
        <div className="w-48 h-48 flex-shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={75}
                paddingAngle={2}
                dataKey="value"
                onClick={(_, index) => onSegmentClick?.(chartData[index].status)}
                className="cursor-pointer"
              >
                {chartData.map((entry) => (
                  <Cell
                    key={entry.status}
                    fill={entry.fill}
                    opacity={activeFilter && activeFilter !== entry.status ? 0.3 : 1}
                    stroke={activeFilter === entry.status ? 'var(--text-primary)' : 'transparent'}
                    strokeWidth={activeFilter === entry.status ? 2 : 0}
                  />
                ))}
              </Pie>
              <Tooltip
                formatter={(value, name) => [`${value} properties`, String(name)]}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Legend */}
        <div className="flex flex-col gap-2">
          {chartData.map((entry) => (
            <button
              key={entry.status}
              onClick={() => onSegmentClick?.(entry.status)}
              className={`flex items-center gap-3 px-3 py-1.5 rounded-md text-left transition-colors ${
                activeFilter === entry.status
                  ? 'bg-[var(--surface)] ring-1 ring-[var(--border-strong)]'
                  : 'hover:bg-[var(--surface)]'
              }`}
            >
              <span
                className="w-3 h-3 rounded-full flex-shrink-0"
                style={{ backgroundColor: entry.fill }}
              />
              <span className="text-sm font-medium text-[var(--text-secondary)] w-24">{entry.name}</span>
              <span className="text-sm font-semibold text-[var(--text-primary)]">{entry.value}</span>
              <span className="text-xs text-[var(--text-muted)]">
                ({((entry.value / total) * 100).toFixed(0)}%)
              </span>
            </button>
          ))}

          {activeFilter && (
            <button
              onClick={() => onSegmentClick?.(activeFilter)}
              className="mt-1 text-xs text-lc-primary hover:underline self-start"
            >
              Clear filter
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
