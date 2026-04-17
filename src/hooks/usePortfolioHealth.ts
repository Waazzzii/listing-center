'use client';

import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import type { LcLatestSnapshot, HealthStatus, Market, QualityTier } from '@/lib/types';

interface PortfolioSummary {
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

interface PortfolioHealthData {
  properties: LcLatestSnapshot[];
  summary: PortfolioSummary | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

interface PortfolioFilters {
  market?: Market;
  quality_tier?: QualityTier;
  health_status?: HealthStatus;
  sort_by?: string;
  sort_dir?: 'asc' | 'desc';
}

export function usePortfolioHealth(filters: PortfolioFilters = {}): PortfolioHealthData {
  const [properties, setProperties] = useState<LcLatestSnapshot[]>([]);
  const [summary, setSummary] = useState<PortfolioSummary | null>(null);
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
      if (filters.sort_by) params.sort_by = filters.sort_by;
      if (filters.sort_dir) params.sort_dir = filters.sort_dir;

      const result = await api<{ data: LcLatestSnapshot[]; summary: PortfolioSummary }>('/snapshots/latest', { params });
      setProperties(result.data || []);
      setSummary(result.summary || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load portfolio data');
    } finally {
      setIsLoading(false);
    }
  }, [filters.market, filters.quality_tier, filters.health_status, filters.sort_by, filters.sort_dir]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { properties, summary, isLoading, error, refetch: fetchData };
}
