'use client';

import { useState, useEffect, useCallback } from 'react';

export interface ABTest {
  id: string;
  property_id: string;
  property_name?: string;
  market?: string;
  test_type: string;
  thesis: string;
  target_metric: string;
  status: 'pending' | 'active' | 'snapshot_due' | 'completed' | 'cancelled';
  before_snapshot_date: string | null;
  before_metrics: Record<string, number> | null;
  change_description: string;
  change_executed_date: string | null;
  after_snapshot_due_date: string | null;
  after_snapshot_date: string | null;
  after_metrics: Record<string, number> | null;
  result: 'positive' | 'negative' | 'no_change' | null;
  metric_lift: number | null;
  result_summary: string | null;
  decision: string | null;
  soak_period_days: number;
  created_at: string;
  updated_at: string;
  // Joined from lc_properties
  lc_properties?: {
    property_name: string;
    market: string;
  };
}

interface UseABTestsResult {
  activeTests: ABTest[];
  completedTests: ABTest[];
  isLoading: boolean;
  error: string | null;
  refresh: () => void;
}

/**
 * Normalize test data — flatten joined property info for easier display.
 */
function normalizeTest(test: ABTest): ABTest {
  return {
    ...test,
    property_name: test.lc_properties?.property_name ?? test.property_name,
    market: test.lc_properties?.market ?? test.market,
  };
}

export function useABTests(): UseABTestsResult {
  const [activeTests, setActiveTests] = useState<ABTest[]>([]);
  const [completedTests, setCompletedTests] = useState<ABTest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTests = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/ab-tests');
      if (!res.ok) throw new Error(`API error: ${res.status}`);
      const json = await res.json();

      // API returns { data: ABTest[], active_count: number }
      const tests: ABTest[] = (json.data || []).map(normalizeTest);

      const active = tests.filter((t) =>
        ['pending', 'active', 'snapshot_due'].includes(t.status)
      );
      const completed = tests.filter((t) =>
        ['completed', 'cancelled'].includes(t.status)
      );

      setActiveTests(active);
      setCompletedTests(completed);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTests();
  }, [fetchTests]);

  return { activeTests, completedTests, isLoading, error, refresh: fetchTests };
}
