'use client';

import { useRouter } from 'next/navigation';
import DataTable, { type ColumnDef, type FilterDef } from '@/components/shared/DataTable';
import StatusBadge from '@/components/shared/StatusBadge';
import TrendArrow from '@/components/shared/TrendArrow';
import { formatPct, formatCurrency, scoreToGrade, scoreColor, paceColor, paceLabel, computeTrend } from '@/lib/utils';
import { MARKET_LABELS, QUALITY_TIER_CONFIG, HEALTH_STATUS_CONFIG } from '@/lib/constants';
import type { CommandGridRow } from '@/lib/types';

interface CommandGridProps {
  data: CommandGridRow[];
  isLoading: boolean;
  healthGradeFilter?: string | null;
  paceStatusFilter?: string | null;
}

/** Small circular health score badge with letter grade */
function HealthScoreBadge({ score, delta }: { score: number | null; delta: number | null }) {
  if (score === null || score === undefined) {
    return <span className="text-[var(--text-muted)] text-xs">--</span>;
  }

  const grade = scoreToGrade(score);
  const color = scoreColor(score);

  // Ring color mapped from text color
  const ringColors: Record<string, string> = {
    'text-health-green': 'border-health-green',
    'text-health-yellow': 'border-health-yellow',
    'text-health-orange': 'border-health-orange',
    'text-health-red': 'border-health-red',
    'text-[var(--text-muted)]': 'border-[var(--text-muted)]',
  };
  const ringColor = ringColors[color] || 'border-[var(--text-muted)]';

  return (
    <div className="flex items-center gap-1.5">
      <div
        className={`w-9 h-9 rounded-full border-2 ${ringColor} flex flex-col items-center justify-center leading-none`}
      >
        <span className={`text-xs font-bold ${color}`}>{score}</span>
        <span className={`text-[9px] font-semibold ${color}`}>{grade}</span>
      </div>
      {delta !== null && delta !== 0 && (
        <TrendArrow direction={delta > 0 ? 'up' : 'down'} size="sm" />
      )}
    </div>
  );
}

/** Channel presence dots */
function ChannelDots({ row }: { row: CommandGridRow }) {
  return (
    <div className="flex items-center gap-1">
      {row.airbnb_listing_id && (
        <span className="w-2.5 h-2.5 rounded-full bg-[#FF5A5F] flex-shrink-0" title="Airbnb" />
      )}
      {row.vrbo_listing_id && (
        <span className="w-2.5 h-2.5 rounded-full bg-[#3B5FC0] flex-shrink-0" title="VRBO" />
      )}
      {row.booking_property_id && (
        <span className="w-2.5 h-2.5 rounded-full bg-[#F5B942] flex-shrink-0" title="Booking.com" />
      )}
    </div>
  );
}

/** Base price with alignment indicator */
function BasePriceCell({ basePrice, recommendedPrice, alignment }: {
  basePrice: number | null;
  recommendedPrice: number | null;
  alignment: number | null;
}) {
  if (basePrice === null) return <span className="text-[var(--text-muted)]">{'\u2014'}</span>;

  let icon: React.ReactNode = null;
  if (alignment !== null && recommendedPrice !== null) {
    const diff = Math.abs(alignment);
    if (diff <= 10) {
      icon = <span className="text-health-green text-xs" title={`${alignment.toFixed(0)}% of recommended`}>{'\u2713'}</span>;
    } else if (diff <= 25) {
      icon = <span className="text-health-orange text-xs" title={`${alignment.toFixed(0)}% off recommended`}>{'\u26A0'}</span>;
    } else {
      icon = <span className="text-health-red text-xs" title={`${alignment.toFixed(0)}% off recommended`}>{'\u2717'}</span>;
    }
  }

  return (
    <span className="flex items-center gap-1">
      <span className="font-medium">{formatCurrency(basePrice)}</span>
      {icon}
    </span>
  );
}

/** Pace status pill badge */
function PaceBadge({ status }: { status: string | null }) {
  if (!status) return <span className="text-[var(--text-muted)]">{'\u2014'}</span>;

  const color = paceColor(status);
  const label = paceLabel(status);

  const dotBg: Record<string, string> = {
    'text-health-green': 'bg-health-green',
    'text-health-orange': 'bg-health-orange',
    'text-health-red': 'bg-health-red',
    'text-[var(--text-muted)]': 'bg-[var(--text-muted)]',
  };
  const dot = dotBg[color] || 'bg-[var(--text-muted)]';

  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs font-medium ${color}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${dot} flex-shrink-0`} />
      {label}
    </span>
  );
}

/** Count badge for actions/tests */
function CountBadge({ count, variant }: { count: number; variant: 'amber' | 'blue' | 'green' | 'purple' }) {
  if (count === 0) return <span className="text-[var(--text-muted)] text-xs">0</span>;

  const colors = {
    amber: 'bg-[var(--badge-orange-bg)] text-[var(--badge-orange-text)]',
    blue: 'bg-[var(--badge-blue-bg)] text-[var(--badge-blue-text)]',
    green: 'bg-health-green/20 text-health-green',
    purple: 'bg-purple-500/20 text-purple-400',
  };

  return (
    <span className={`inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-xs font-semibold ${colors[variant]}`}>
      {count}
    </span>
  );
}

export default function CommandGrid({ data, isLoading, healthGradeFilter, paceStatusFilter }: CommandGridProps) {
  const router = useRouter();

  // Apply external filters from summary cards
  const filteredData = data.filter((row) => {
    if (healthGradeFilter && scoreToGrade(row.health_score) !== healthGradeFilter) return false;
    if (paceStatusFilter && row.rev_pace_status !== paceStatusFilter) return false;
    return true;
  });

  const columns: ColumnDef<CommandGridRow>[] = [
    {
      key: 'property',
      header: 'Property',
      sortable: true,
      width: '20%',
      render: (row) => (
        <div>
          <p className="font-medium text-[var(--text-primary)] truncate max-w-xs">{row.property_name}</p>
          <p className="text-xs text-[var(--text-muted)]">{MARKET_LABELS[row.market] || row.market}</p>
        </div>
      ),
      sortValue: (row) => row.property_name,
    },
    {
      key: 'health_score',
      header: 'Health',
      sortable: true,
      render: (row) => <HealthScoreBadge score={row.health_score} delta={row.health_score_delta} />,
      sortValue: (row) => row.health_score,
    },
    {
      key: 'channels',
      header: 'Channels',
      render: (row) => <ChannelDots row={row} />,
    },
    {
      key: 'impression_rate',
      header: 'Impressions',
      sortable: true,
      render: (row) => (
        <span className="flex items-center gap-1">
          <span className="font-medium">{formatPct(row.airbnb_first_page_impression_rate)}</span>
          <TrendArrow direction={computeTrend(row.airbnb_first_page_impression_rate, null)} />
        </span>
      ),
      sortValue: (row) => row.airbnb_first_page_impression_rate,
    },
    {
      key: 'ctr',
      header: 'CTR',
      sortable: true,
      render: (row) => <span className="font-medium">{formatPct(row.airbnb_search_to_listing_ctr)}</span>,
      sortValue: (row) => row.airbnb_search_to_listing_ctr,
    },
    {
      key: 'conversion',
      header: 'Conv.',
      sortable: true,
      render: (row) => <span className="font-medium">{formatPct(row.airbnb_listing_to_booking_conversion)}</span>,
      sortValue: (row) => row.airbnb_listing_to_booking_conversion,
    },
    {
      key: 'revpar',
      header: 'RevPAR',
      sortable: true,
      render: (row) => <span className="font-medium">{formatCurrency(row.wh_revpar)}</span>,
      sortValue: (row) => row.wh_revpar,
    },
    {
      key: 'occupancy',
      header: 'Occ. 30d',
      sortable: true,
      render: (row) => <span className="font-medium">{formatPct(row.wh_occupancy_30d)}</span>,
      sortValue: (row) => row.wh_occupancy_30d,
    },
    {
      key: 'base_price',
      header: 'Base Price',
      sortable: true,
      render: (row) => (
        <BasePriceCell
          basePrice={row.wh_base_price}
          recommendedPrice={row.wh_recommended_price}
          alignment={row.wh_price_alignment}
        />
      ),
      sortValue: (row) => row.wh_base_price,
    },
    {
      key: 'rev_pace',
      header: 'Rev Pace',
      sortable: true,
      render: (row) => (
        <div className="flex flex-col gap-0.5">
          <span className="font-medium text-sm">{formatPct(row.rev_pct_to_proj, 0)}</span>
          <PaceBadge status={row.rev_pace_status ?? null} />
        </div>
      ),
      sortValue: (row) => row.rev_pct_to_proj,
    },
    {
      key: 'actions',
      header: 'Actions',
      sortable: true,
      render: (row) => {
        const totalAgentActions = row.proposed_actions + row.approved_actions + row.executing_actions;
        return (
          <div className="flex items-center gap-1.5">
            <CountBadge count={row.pending_actions} variant="amber" />
            <CountBadge count={row.active_tests} variant="blue" />
            {totalAgentActions > 0 && (
              <CountBadge count={totalAgentActions} variant="purple" />
            )}
          </div>
        );
      },
      sortValue: (row) => row.pending_actions + row.active_tests + row.proposed_actions + row.approved_actions,
    },
    {
      key: 'status',
      header: 'Status',
      sortable: true,
      render: (row) => <StatusBadge status={row.health_status} size="sm" />,
      sortValue: (row) => HEALTH_STATUS_CONFIG[row.health_status]?.sortOrder ?? 99,
    },
  ];

  const filters: FilterDef[] = [
    {
      key: 'market',
      label: 'Market',
      options: Object.entries(MARKET_LABELS).map(([value, label]) => ({ value, label })),
    },
    {
      key: 'tier',
      label: 'Tier',
      options: Object.entries(QUALITY_TIER_CONFIG).map(([value, config]) => ({
        value,
        label: config.label,
      })),
    },
    {
      key: 'grade',
      label: 'Health Grade',
      options: [
        { value: 'A', label: 'A (80+)' },
        { value: 'B', label: 'B (60-79)' },
        { value: 'C', label: 'C (40-59)' },
        { value: 'D', label: 'D (20-39)' },
      ],
    },
    {
      key: 'pace',
      label: 'Pace',
      options: [
        { value: 'ahead', label: 'Ahead' },
        { value: 'on_track', label: 'On Track' },
        { value: 'behind', label: 'Behind' },
        { value: 'at_risk', label: 'At Risk' },
      ],
    },
  ];

  return (
    <DataTable
      data={filteredData}
      columns={columns}
      filters={filters}
      isLoading={isLoading}
      onRowClick={(row) => router.push(`/property/${row.property_id}`)}
      rowKey={(row) => row.property_id}
      emptyMessage="No properties match the current filters."
      stickyHeader={true}
    />
  );
}
