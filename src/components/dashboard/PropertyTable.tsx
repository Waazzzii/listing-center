'use client';

import { useRouter } from 'next/navigation';
import DataTable, { type ColumnDef, type FilterDef } from '@/components/shared/DataTable';
import StatusBadge from '@/components/shared/StatusBadge';
import TrendArrow from '@/components/shared/TrendArrow';
import { formatPct, formatNumber, formatDate, computeTrend } from '@/lib/utils';
import { MARKET_LABELS, QUALITY_TIER_CONFIG, HEALTH_STATUS_CONFIG } from '@/lib/constants';
import type { LcLatestSnapshot, HealthStatus } from '@/lib/types';

interface PropertyTableProps {
  data: LcLatestSnapshot[];
  isLoading: boolean;
  healthFilter?: HealthStatus | null;
}

export default function PropertyTable({ data, isLoading, healthFilter }: PropertyTableProps) {
  const router = useRouter();

  // Apply health filter from donut chart click
  const filteredData = healthFilter
    ? data.filter((row) => row.health_status === healthFilter)
    : data;

  const columns: ColumnDef<LcLatestSnapshot>[] = [
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
      key: 'tier',
      header: 'Tier',
      sortable: true,
      width: '8%',
      render: (row) => (
        <span className="text-xs font-medium text-[var(--text-secondary)] bg-[var(--surface)] px-2 py-0.5 rounded">
          {QUALITY_TIER_CONFIG[row.quality_tier]?.label || row.quality_tier}
        </span>
      ),
      sortValue: (row) => row.quality_tier_numeric,
    },
    {
      key: 'impression_rate',
      header: 'Impression Rate',
      sortable: true,
      render: (row) => (
        <span className="flex items-center gap-1">
          <span className="font-medium">{formatPct(row.airbnb_first_page_impression_rate)}</span>
          <TrendArrow direction={computeTrend(
            row.airbnb_first_page_impression_rate,
            null
          )} />
        </span>
      ),
      sortValue: (row) => row.airbnb_first_page_impression_rate,
    },
    {
      key: 'ctr',
      header: 'CTR',
      sortable: true,
      render: (row) => (
        <span className="flex items-center gap-1">
          <span className="font-medium">{formatPct(row.airbnb_search_to_listing_ctr)}</span>
        </span>
      ),
      sortValue: (row) => row.airbnb_search_to_listing_ctr,
    },
    {
      key: 'conversion',
      header: 'Conversion',
      sortable: true,
      render: (row) => (
        <span className="flex items-center gap-1">
          <span className="font-medium">{formatPct(row.airbnb_listing_to_booking_conversion)}</span>
        </span>
      ),
      sortValue: (row) => row.airbnb_listing_to_booking_conversion,
    },
    {
      key: 'wishlists',
      header: 'Wishlists',
      sortable: true,
      render: (row) => (
        <span className="font-medium">{formatNumber(row.airbnb_wishlist_additions)}</span>
      ),
      sortValue: (row) => row.airbnb_wishlist_additions,
    },
    {
      key: 'status',
      header: 'Status',
      sortable: true,
      render: (row) => <StatusBadge status={row.health_status} size="sm" />,
      sortValue: (row) => HEALTH_STATUS_CONFIG[row.health_status]?.sortOrder ?? 99,
    },
    {
      key: 'last_change',
      header: 'Last Change',
      sortable: true,
      render: (row) => (
        <span className="text-sm text-[var(--text-secondary)]">{formatDate(row.snapshot_date)}</span>
      ),
      sortValue: (row) => row.snapshot_date,
    },
    {
      key: 'action',
      header: '',
      width: '80px',
      render: (row) => (
        <button
          onClick={(e) => {
            e.stopPropagation();
            router.push(`/property/${row.property_id}`);
          }}
          className="text-xs font-medium text-lc-primary hover:underline"
        >
          View
        </button>
      ),
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
      key: 'status',
      label: 'Status',
      options: Object.entries(HEALTH_STATUS_CONFIG).map(([value, config]) => ({
        value,
        label: config.label,
      })),
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
