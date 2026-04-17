'use client';

import { useMemo } from 'react';
import { formatDate } from '@/lib/utils';
import type { LcReview } from '@/lib/types';

interface ReviewSummaryProps {
  reviews: LcReview[];
  overallRating: number | null;
  reviewCount: number | null;
  isLoading: boolean;
}

export default function ReviewSummary({ reviews, overallRating, reviewCount, isLoading }: ReviewSummaryProps) {
  // Compute rating distribution from available reviews
  const ratingDistribution = useMemo(() => {
    const dist: Record<number, number> = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    reviews.forEach((r) => {
      if (r.rating && r.rating >= 1 && r.rating <= 5) {
        dist[Math.round(r.rating)]++;
      }
    });
    return dist;
  }, [reviews]);

  // Extract unique sentiment tags
  const sentimentTags = useMemo(() => {
    const tags = new Map<string, number>();
    reviews.forEach((r) => {
      const themes = Array.isArray(r.themes)
        ? r.themes
        : typeof r.themes === 'string'
          ? (() => {
              try {
                const parsed = JSON.parse(r.themes);
                return Array.isArray(parsed) ? parsed : [];
              } catch {
                return r.themes.split(',').map((t) => t.trim()).filter(Boolean);
              }
            })()
          : [];
      themes.forEach((tag: string) => {
        tags.set(tag, (tags.get(tag) || 0) + 1);
      });
    });
    return Array.from(tags.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8);
  }, [reviews]);

  const maxDist = Math.max(...Object.values(ratingDistribution), 1);

  if (isLoading) {
    return (
      <div className="bg-[var(--card-bg)] rounded-lg border border-lc-border p-6">
        <h3 className="text-sm font-semibold text-[var(--text-secondary)] mb-4">Reviews</h3>
        <div className="animate-pulse h-32 bg-[var(--surface)] rounded" />
      </div>
    );
  }

  return (
    <div className="bg-[var(--card-bg)] rounded-lg border border-lc-border p-6">
      <h3 className="text-sm font-semibold text-[var(--text-secondary)] mb-4">Reviews</h3>

      <div className="grid grid-cols-12 gap-6">
        {/* Overall rating */}
        <div className="col-span-3 text-center">
          <p className="text-4xl font-bold text-[var(--text-primary)]">
            {overallRating !== null ? overallRating.toFixed(2) : '\u2014'}
          </p>
          <p className="text-xs text-[var(--text-muted)] mt-1">
            {reviewCount !== null ? `${reviewCount} reviews` : 'No reviews'}
          </p>
          {/* Star visualization */}
          <div className="flex justify-center mt-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <svg
                key={i}
                className={`w-4 h-4 ${
                  overallRating !== null && i < Math.round(overallRating)
                    ? 'text-amber-400'
                    : 'text-[var(--text-muted)]'
                }`}
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
            ))}
          </div>
        </div>

        {/* Rating distribution */}
        <div className="col-span-4 space-y-1">
          {[5, 4, 3, 2, 1].map((star) => {
            const count = ratingDistribution[star];
            const widthPct = (count / maxDist) * 100;

            return (
              <div key={star} className="flex items-center gap-2">
                <span className="text-xs text-[var(--text-muted)] w-3">{star}</span>
                <div className="flex-1 h-3 bg-[var(--surface)] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-amber-400 rounded-full"
                    style={{ width: `${widthPct}%` }}
                  />
                </div>
                <span className="text-xs text-[var(--text-muted)] w-4 text-right">{count}</span>
              </div>
            );
          })}
        </div>

        {/* Sentiment tags */}
        <div className="col-span-5">
          <p className="text-xs text-[var(--text-muted)] mb-2">Common Themes</p>
          <div className="flex flex-wrap gap-1.5">
            {sentimentTags.length === 0 ? (
              <span className="text-xs text-[var(--text-muted)]">No themes extracted yet</span>
            ) : (
              sentimentTags.map(([tag, count]) => (
                <span
                  key={tag}
                  className="px-2 py-0.5 bg-[var(--surface)] text-[var(--text-secondary)] rounded-full text-xs"
                >
                  {tag} ({count})
                </span>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Recent reviews */}
      {reviews.length > 0 && (
        <div className="mt-4 pt-4 border-t border-[var(--border)] space-y-3">
          <p className="text-xs font-medium text-[var(--text-muted)]">Recent Reviews</p>
          {reviews.slice(0, 3).map((review) => (
            <div key={review.id} className="text-sm">
              <div className="flex items-center gap-2">
                <span className="font-medium text-[var(--text-secondary)]">{review.guest_name || 'Guest'}</span>
                <span className="text-amber-500 text-xs">
                  {'*'.repeat(review.rating || 0)}
                </span>
                <span className="text-xs text-[var(--text-muted)]">{formatDate(review.review_date)}</span>
                <span className={`text-xs px-1.5 py-0.5 rounded ${
                  review.response_status === 'responded' ? 'bg-green-100 text-green-600' :
                  review.response_status === 'pending' ? 'bg-amber-100 text-amber-600' :
                  'bg-[var(--surface)] text-[var(--text-muted)]'
                }`}>
                  {review.response_status}
                </span>
              </div>
              {review.review_text && (
                <p className="text-xs text-[var(--text-muted)] mt-0.5 line-clamp-2">{review.review_text}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
