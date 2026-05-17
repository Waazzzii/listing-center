'use client';

import { useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import InsufficientDataState from '@/components/shared/InsufficientDataState';
import { ChartSkeleton } from '@/components/shared/LoadingStates';
import { formatDate } from '@/lib/utils';
import { MIN_WEEKS_FOR_TRENDS } from '@/lib/constants';
import type { LcMetricSnapshot, LcChangeLog } from '@/lib/types';

interface MetricHistoryChartsProps {
  snapshots: LcMetricSnapshot[];
  changeLogs?: LcChangeLog[];
  isLoading: boolean;
}

interface ChartDataPoint {
  week: string;
  weekLabel: string;
  impression_rate: number | null;
  ctr: number | null;
  conversion: number | null;
  hasChange?: boolean;
  changeLabel?: string;
}

export default function MetricHistoryCharts({ snapshots, changeLogs = [], isLoading }: MetricHistoryChartsProps) {
  const chartData = useMemo<ChartDataPoint[]>(() => {
    return snapshots.map((s) => {
      // Check if any change happened on this snapshot's date
      const change = changeLogs.find(
        (cl) => cl.change_date?.split('T')[0] === s.snapshot_date
      );

      return {
        week: s.snapshot_date,
        weekLabel: formatDate(s.snapshot_date),
        impression_rate: s.airbnb_first_page_impression_rate,
        ctr: s.airbnb_search_to_listing_ctr,
        conversion: s.airbnb_listing_to_booking_conversion,
        hasChange: !!change,
        changeLabel: change ? `${change.change_type}: ${change.field_changed || ''}` : undefined,
      };
    });
  }, [snapshots, changeLogs]);

  if (isLoading) return <ChartSkeleton height="h-80" />;

  if (snapshots.length < MIN_WEEKS_FOR_TRENDS) {
    return (
      <div className="bg-card rounded-lg border border-border p-6">
        <h3 className="text-sm font-semibold text-muted-foreground mb-4">Metric History (12-Week Trailing)</h3>
        <InsufficientDataState weeksAvailable={snapshots.length} />
      </div>
    );
  }

  // Find weeks with changes for overlays
  const changeWeeks = chartData.filter((d) => d.hasChange);

  return (
    <div className="bg-card rounded-lg border border-border p-6">
      <h3 className="text-sm font-semibold text-muted-foreground mb-4">Metric History (12-Week Trailing)</h3>

      {/* Change event legend */}
      {changeWeeks.length > 0 && (
        <div className="mb-3 flex items-center gap-2 text-xs text-muted-foreground">
          <span className="w-3 h-3 bg-health-orange/15 border border-health-orange/40 rounded" />
          <span>Listing change events ({changeWeeks.length})</span>
        </div>
      )}

      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
          <XAxis
            dataKey="weekLabel"
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
            formatter={(value, name) => [
              `${Number(value)?.toFixed(1)}%`,
              String(name) === 'impression_rate' ? 'Impression Rate' :
              String(name) === 'ctr' ? 'CTR' : 'Conversion',
            ]}
            labelFormatter={(label) => `Week of ${label}`}
          />

          {/* Change event overlays */}
          {changeWeeks.map((cw) => (
            <ReferenceLine
              key={cw.week}
              x={cw.weekLabel}
              stroke="#F59E0B"
              strokeDasharray="4 4"
              strokeWidth={1.5}
              label={{
                value: '\u25CF',
                position: 'top',
                fill: '#F59E0B',
                fontSize: 10,
              }}
            />
          ))}

          <Line
            type="monotone"
            dataKey="impression_rate"
            name="Impression Rate"
            stroke="#3B82F6"
            strokeWidth={2}
            dot={{ r: 3, fill: '#3B82F6' }}
            connectNulls
          />
          <Line
            type="monotone"
            dataKey="ctr"
            name="CTR"
            stroke="#8B5CF6"
            strokeWidth={2}
            dot={{ r: 3, fill: '#8B5CF6' }}
            connectNulls
          />
          <Line
            type="monotone"
            dataKey="conversion"
            name="Conversion"
            stroke="#22C55E"
            strokeWidth={2}
            dot={{ r: 3, fill: '#22C55E' }}
            connectNulls
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
