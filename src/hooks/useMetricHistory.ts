'use client';

import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import type { LcMetricSnapshot } from '@/lib/types';

interface MetricHistoryData {
  snapshots: LcMetricSnapshot[];
  weeksAvailable: number;
  isLoading: boolean;
  error: string | null;
}

export function useMetricHistory(propertyId: string | null, weeks: number = 12): MetricHistoryData {
  const [snapshots, setSnapshots] = useState<LcMetricSnapshot[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!propertyId) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);

    try {
      // Calculate "since" date (weeks ago from now)
      const since = new Date();
      since.setDate(since.getDate() - weeks * 7);
      const sinceStr = since.toISOString().split('T')[0];

      const result = await api<{ data: LcMetricSnapshot[] }>('/snapshots', {
        params: { property_id: propertyId, since: sinceStr, limit: String(weeks) },
      });

      // Sort ascending by date for charts
      const sorted = (result.data || []).sort(
        (a, b) => new Date(a.snapshot_date).getTime() - new Date(b.snapshot_date).getTime()
      );
      setSnapshots(sorted);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load metric history');
    } finally {
      setIsLoading(false);
    }
  }, [propertyId, weeks]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return {
    snapshots,
    weeksAvailable: snapshots.length,
    isLoading,
    error,
  };
}
