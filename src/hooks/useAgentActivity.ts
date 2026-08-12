'use client';

import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';

interface AgentExecution {
  id: string;
  agent_name: string;
  started_at: string;
  completed_at: string | null;
  status: 'running' | 'completed' | 'failed';
  summary: string | null;
  properties_processed: number | null;
  errors_count: number | null;
}

interface AgentActivityData {
  executions: AgentExecution[];
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useAgentActivity(agentName?: string, limit: number = 100): AgentActivityData {
  const [executions, setExecutions] = useState<AgentExecution[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const params: Record<string, string> = { limit: String(limit) };
      if (agentName) params.agent_name = agentName;

      const result = await api<{ data: AgentExecution[] }>('/agents', { params });
      setExecutions(result.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load agent activity');
    } finally {
      setIsLoading(false);
    }
  }, [agentName, limit]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { executions, isLoading, error, refetch: fetchData };
}
