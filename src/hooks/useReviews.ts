'use client';

import { useState, useEffect, useCallback } from 'react';

export interface PendingRatingUI {
  id: string;
  property_id: string;
  guest_name: string;
  checkout_date: string;
  rating_deadline: string;
  days_until_deadline: number;
  is_urgent: boolean;
  submission_status: string;
  property_name?: string;
  market?: string;
}

export interface ReviewUI {
  id: string;
  property_id: string;
  channel: string;
  guest_name: string;
  review_date: string;
  rating: number;
  review_text: string;
  response_status: string;
  response_text: string | null;
  sentiment: string;
  property_name?: string;
  market?: string;
}

export function useReviews() {
  const [pendingRatings, setPendingRatings] = useState<PendingRatingUI[]>([]);
  const [reviews, setReviews] = useState<ReviewUI[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [ratingsRes, reviewsRes] = await Promise.all([
        fetch('/api/reviews/ratings'),
        fetch('/api/reviews'),
      ]);

      if (!ratingsRes.ok) throw new Error(`Ratings API error: ${ratingsRes.status}`);
      if (!reviewsRes.ok) throw new Error(`Reviews API error: ${reviewsRes.status}`);

      const ratingsJson = await ratingsRes.json();
      const reviewsJson = await reviewsRes.json();

      // API returns { data, urgent_count } for ratings
      const ratingsData = ratingsJson.data || ratingsJson || [];
      // API returns { data } for reviews
      const reviewsData = reviewsJson.data || reviewsJson || [];

      // Map API data to UI shape, pulling property_name from joined data
      setPendingRatings(ratingsData.map((r: Record<string, unknown>) => ({
        ...r,
        property_name: (r.lc_properties as Record<string, unknown>)?.property_name || undefined,
        market: (r.lc_properties as Record<string, unknown>)?.market || undefined,
      })));
      setReviews(reviewsData.map((r: Record<string, unknown>) => ({
        ...r,
        property_name: (r.lc_properties as Record<string, unknown>)?.property_name || undefined,
        market: (r.lc_properties as Record<string, unknown>)?.market || undefined,
      })));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load review data');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  return { pendingRatings, reviews, isLoading, error, refresh: fetchAll };
}
