'use client';

import { useState, useEffect, useCallback } from 'react';

export interface ScorecardUI {
  id: string;
  property_id: string;
  property_name?: string;
  market?: string;
  report_month: string;
  generated_at: string | null;
  generation_status: string;
  delivery_method: string | null;
  delivered_at: string | null;
}

interface ScorecardApiResponse {
  data: Array<{
    id: string;
    property_id: string;
    report_month: string;
    generated_at: string | null;
    generation_status: string;
    delivery_method: string | null;
    delivered_at: string | null;
    lc_properties: {
      property_name: string;
      market: string;
    } | null;
  }>;
}

export function useScorecards() {
  const [scorecards, setScorecards] = useState<ScorecardUI[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchScorecards = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/scorecards');
      if (!res.ok) throw new Error(`API error: ${res.status}`);
      const json: ScorecardApiResponse = await res.json();

      const mapped: ScorecardUI[] = (json.data || []).map((sc) => ({
        id: sc.id,
        property_id: sc.property_id,
        property_name: sc.lc_properties?.property_name,
        market: sc.lc_properties?.market,
        report_month: sc.report_month,
        generated_at: sc.generated_at,
        generation_status: sc.generation_status,
        delivery_method: sc.delivery_method,
        delivered_at: sc.delivered_at,
      }));

      setScorecards(mapped);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchScorecards();
  }, [fetchScorecards]);

  return { scorecards, isLoading, error, refresh: fetchScorecards };
}
