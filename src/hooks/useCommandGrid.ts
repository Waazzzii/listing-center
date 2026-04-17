'use client';

import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import type { CommandGridRow, CommandGridSummary, Market, QualityTier, PaceStatus } from '@/lib/types';

interface CommandGridData {
  rows: CommandGridRow[];
  summary: CommandGridSummary | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

interface CommandGridFilters {
  market?: Market;
  quality_tier?: QualityTier;
  health_status?: string;
  health_grade?: string;
  pace_status?: PaceStatus;
}

export function useCommandGrid(filters: CommandGridFilters = {}): CommandGridData {
  const [rows, setRows] = useState<CommandGridRow[]>([]);
  const [summary, setSummary] = useState<CommandGridSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const params: Record<string, string> = {};
      if (filters.market) params.market = filters.market;
      if (filters.quality_tier) params.quality_tier = filters.quality_tier;
      if (filters.health_status) params.health_status = filters.health_status;
      if (filters.health_grade) params.health_grade = filters.health_grade;
      if (filters.pace_status) params.pace_status = filters.pace_status;

      const result = await api<{ data: CommandGridRow[]; summary: CommandGridSummary }>(
        '/command-grid',
        { params }
      );
      setRows(result.data || []);
      setSummary(result.summary || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load command grid data');
    } finally {
      setIsLoading(false);
    }
  }, [filters.market, filters.quality_tier, filters.health_status, filters.health_grade, filters.pace_status]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { rows, summary, isLoading, error, refetch: fetchData };
}
