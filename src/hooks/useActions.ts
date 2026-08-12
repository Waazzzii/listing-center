'use client';

import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import type { ActionQueueRow, ActionCategory, ActionStatus } from '@/lib/types';

interface UseActionsFilters {
  status?: ActionStatus;
  category?: ActionCategory;
  agent?: string;
  property_id?: string;
  priority?: string;
  batch_id?: string;
  limit?: number;
}

interface UseActionsData {
  actions: ActionQueueRow[];
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
  approveAction: (id: string, approvedBy?: string) => Promise<void>;
  rejectAction: (id: string, reason?: string) => Promise<void>;
  cancelAction: (id: string) => Promise<void>;
  revertAction: (id: string, reason?: string) => Promise<void>;
}

export function useActions(filters: UseActionsFilters = {}): UseActionsData {
  const [actions, setActions] = useState<ActionQueueRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const params: Record<string, string> = {};
      if (filters.status) params.status = filters.status;
      if (filters.category) params.category = filters.category;
      if (filters.agent) params.agent = filters.agent;
      if (filters.property_id) params.property_id = filters.property_id;
      if (filters.priority) params.priority = filters.priority;
      if (filters.batch_id) params.batch_id = filters.batch_id;
      if (filters.limit) params.limit = String(filters.limit);

      const result = await api<{ data: ActionQueueRow[] }>('/actions', { params });
      setActions(result.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load actions');
    } finally {
      setIsLoading(false);
    }
  }, [filters.status, filters.category, filters.agent, filters.property_id, filters.priority, filters.batch_id, filters.limit]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const mutateAction = async (id: string, operation: string, body: Record<string, unknown> = {}) => {
    await api(`/actions/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ operation, ...body }),
    });
    fetchData(); // Refresh after mutation
  };

  return {
    actions,
    isLoading,
    error,
    refetch: fetchData,
    approveAction: (id, approvedBy) => mutateAction(id, 'approve', { approved_by: approvedBy }),
    rejectAction: (id, reason) => mutateAction(id, 'reject', { reason }),
    cancelAction: (id) => mutateAction(id, 'cancel'),
    revertAction: (id, reason) => mutateAction(id, 'revert', { reason }),
  };
}
