'use client';

import { useState, useMemo, useCallback } from 'react';
import { TableRowSkeleton } from './LoadingStates';

export type SortDirection = 'asc' | 'desc';

export interface ColumnDef<T> {
  key: string;
  header: string;
  sortable?: boolean;
  width?: string;
  render: (row: T) => React.ReactNode;
  sortValue?: (row: T) => string | number | null;
}

export interface FilterDef {
  key: string;
  label: string;
  options: Array<{ value: string; label: string }>;
}

interface DataTableProps<T> {
  data: T[];
  columns: ColumnDef<T>[];
  filters?: FilterDef[];
  isLoading?: boolean;
  onRowClick?: (row: T) => void;
  rowKey: (row: T) => string;
  emptyMessage?: string;
  stickyHeader?: boolean;
}

export default function DataTable<T>({
  data,
  columns,
  filters = [],
  isLoading = false,
  onRowClick,
  rowKey,
  emptyMessage = 'No results found.',
  stickyHeader = true,
}: DataTableProps<T>) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<SortDirection>('desc');
  const [activeFilters, setActiveFilters] = useState<Record<string, string>>({});

  const handleSort = useCallback((key: string) => {
    if (sortKey === key) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  }, [sortKey]);

  const handleFilterChange = useCallback((filterKey: string, value: string) => {
    setActiveFilters((prev) => {
      const next = { ...prev };
      if (value === '') {
        delete next[filterKey];
      } else {
        next[filterKey] = value;
      }
      return next;
    });
  }, []);

  // Apply sorting
  const sortedData = useMemo(() => {
    if (!sortKey) return data;

    const col = columns.find((c) => c.key === sortKey);
    if (!col?.sortValue) return data;

    return [...data].sort((a, b) => {
      const aVal = col.sortValue!(a);
      const bVal = col.sortValue!(b);
      if (aVal === null || aVal === undefined) return 1;
      if (bVal === null || bVal === undefined) return -1;
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortDir === 'asc' ? aVal - bVal : bVal - aVal;
      }
      const comparison = String(aVal).localeCompare(String(bVal));
      return sortDir === 'asc' ? comparison : -comparison;
    });
  }, [data, sortKey, sortDir, columns]);

  return (
    <div className="bg-[var(--card-bg)] rounded-lg border border-lc-border overflow-hidden">
      {/* Filters bar */}
      {filters.length > 0 && (
        <div className="px-4 py-3 border-b border-lc-border flex items-center gap-4 flex-wrap">
          {filters.map((filter) => (
            <div key={filter.key} className="flex items-center gap-2">
              <label className="text-xs font-medium text-[var(--text-secondary)]">{filter.label}:</label>
              <select
                className="text-sm border border-[var(--border)] rounded-md px-2 py-1 bg-[var(--card-bg)] text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-lc-primary"
                value={activeFilters[filter.key] || ''}
                onChange={(e) => handleFilterChange(filter.key, e.target.value)}
              >
                <option value="">All</option>
                {filter.options.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
          ))}
          {Object.keys(activeFilters).length > 0 && (
            <button
              onClick={() => setActiveFilters({})}
              className="text-xs text-lc-primary hover:underline"
            >
              Clear filters
            </button>
          )}
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className={stickyHeader ? 'sticky top-0 z-10' : ''}>
            <tr className="bg-[var(--table-header-bg)] border-b border-lc-border">
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={`px-4 py-3 text-left text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider ${
                    col.sortable ? 'cursor-pointer select-none hover:text-[var(--text-primary)]' : ''
                  }`}
                  style={col.width ? { width: col.width } : undefined}
                  onClick={col.sortable ? () => handleSort(col.key) : undefined}
                >
                  <span className="flex items-center gap-1">
                    {col.header}
                    {col.sortable && sortKey === col.key && (
                      <span className="text-lc-primary">
                        {sortDir === 'asc' ? '\u25B2' : '\u25BC'}
                      </span>
                    )}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {isLoading ? (
              Array.from({ length: 10 }).map((_, i) => (
                <TableRowSkeleton key={i} columns={columns.length} />
              ))
            ) : sortedData.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-12 text-center text-[var(--text-muted)]">
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              sortedData.map((row) => (
                <tr
                  key={rowKey(row)}
                  className={`${
                    onRowClick ? 'cursor-pointer hover:bg-[var(--table-row-hover)]' : ''
                  } transition-colors`}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                >
                  {columns.map((col) => (
                    <td key={col.key} className="px-4 py-3">
                      {col.render(row)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Footer: row count */}
      {!isLoading && sortedData.length > 0 && (
        <div className="px-4 py-2 border-t border-lc-border text-xs text-[var(--text-muted)]">
          {sortedData.length} propert{sortedData.length === 1 ? 'y' : 'ies'}
        </div>
      )}
    </div>
  );
}
