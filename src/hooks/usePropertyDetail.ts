'use client';

import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import type { LcProperty, LcMetricSnapshot, LcRecommendation, LcABTest, LcReview, LcChangeLog } from '@/lib/types';

interface PropertyDetailData {
  property: LcProperty | null;
  latestSnapshot: LcMetricSnapshot | null;
  recommendations: LcRecommendation[];
  abTests: LcABTest[];
  reviews: LcReview[];
  changeLogs: LcChangeLog[];
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

export function usePropertyDetail(unitId: string): PropertyDetailData {
  const [property, setProperty] = useState<LcProperty | null>(null);
  const [latestSnapshot, setLatestSnapshot] = useState<LcMetricSnapshot | null>(null);
  const [recommendations, setRecommendations] = useState<LcRecommendation[]>([]);
  const [abTests, setAbTests] = useState<LcABTest[]>([]);
  const [reviews, setReviews] = useState<LcReview[]>([]);
  const [changeLogs] = useState<LcChangeLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!unitId) return;
    setIsLoading(true);
    setError(null);

    try {
      // Fetch property by unitId (we query by streamline_unit_id)
      const propResult = await api<{ data: LcProperty[] }>('/properties', {
        params: { streamline_unit_id: unitId },
      });
      const prop = propResult.data?.[0] || null;
      setProperty(prop);

      if (!prop) {
        setError('Property not found');
        setIsLoading(false);
        return;
      }

      // Parallel fetch all related data
      const [snapshotRes, recsRes, testsRes, reviewsRes] = await Promise.all([
        api<{ data: LcMetricSnapshot[] }>('/snapshots', {
          params: { property_id: prop.id, limit: '1' },
        }),
        api<{ data: LcRecommendation[] }>('/recommendations', {
          params: { property_id: prop.id },
        }),
        api<{ data: LcABTest[] }>('/ab-tests', {
          params: { property_id: prop.id },
        }),
        api<{ data: LcReview[] }>('/reviews', {
          params: { property_id: prop.id, limit: '10' },
        }),
      ]);

      setLatestSnapshot(snapshotRes.data?.[0] || null);
      setRecommendations(recsRes.data || []);
      setAbTests(testsRes.data || []);
      setReviews(reviewsRes.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load property data');
    } finally {
      setIsLoading(false);
    }
  }, [unitId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { property, latestSnapshot, recommendations, abTests, reviews, changeLogs, isLoading, error, refetch: fetchData };
}
