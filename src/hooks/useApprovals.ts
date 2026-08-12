'use client';

import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import type { LcRecommendation, RecommendationStatus } from '@/lib/types';

interface ApprovalsData {
  pendingCount: number;
  recommendations: LcRecommendation[];
  isLoading: boolean;
  error: string | null;
  updateStatus: (id: string, status: RecommendationStatus, extras?: Record<string, string>) => Promise<void>;
  refetch: () => void;
}

export function useApprovals(propertyId?: string): ApprovalsData {
  const [recommendations, setRecommendations] = useState<LcRecommendation[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const params: Record<string, string> = { status: 'pending' };
      if (propertyId) params.property_id = propertyId;

      const result = await api<{ data: LcRecommendation[]; pending_count: number }>('/recommendations', { params });
      setRecommendations(result.data || []);
      setPendingCount(result.pending_count || 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load approvals');
    } finally {
      setIsLoading(false);
    }
  }, [propertyId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const updateStatus = useCallback(async (
    id: string,
    status: RecommendationStatus,
    extras?: Record<string, string>
  ) => {
    await api(`/recommendations/${id}`, {
      method: 'PUT',
      body: { status, ...extras },
    });
    // Refetch after update
    fetchData();
  }, [fetchData]);

  return { pendingCount, recommendations, isLoading, error, updateStatus, refetch: fetchData };
}
