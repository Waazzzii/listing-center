'use client';

import React, { useState, useEffect } from 'react';

interface ReviewStats {
  total_reviews: number;
  avg_rating: number;
  sentiment_breakdown: { positive: number; neutral: number; negative: number };
  response_rate: number;
  top_themes: Array<{ theme: string; count: number; sentiment: string }>;
  rating_trend: Array<{ month: string; avg_rating: number; count: number }>;
}

export default function ReviewAnalytics() {
  const [stats, setStats] = useState<ReviewStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchStats() {
      try {
        const res = await fetch('/api/reviews?view=analytics');
        if (res.ok) {
          const data = await res.json();
          setStats(data);
        }
      } catch {
        // Analytics are non-critical
      } finally {
        setIsLoading(false);
      }
    }
    fetchStats();
  }, []);

  if (isLoading) {
    return <div className="animate-pulse space-y-4">{[1, 2].map(i => <div key={i} className="h-32 bg-[var(--surface)] rounded-lg" />)}</div>;
  }

  if (!stats || stats.total_reviews === 0) {
    return (
      <div className="text-center py-12 text-[var(--text-muted)]">
        <p className="text-lg font-medium">Not enough data for analytics</p>
        <p className="mt-1 text-sm">Analytics will appear after 30+ reviews are collected.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Row */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-lg p-4 text-center">
          <div className="text-3xl font-bold text-[var(--text-primary)]">{stats.total_reviews}</div>
          <div className="text-sm text-[var(--text-muted)]">Total Reviews</div>
        </div>
        <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-lg p-4 text-center">
          <div className="text-3xl font-bold text-[var(--text-primary)]">{stats.avg_rating.toFixed(2)}</div>
          <div className="text-sm text-[var(--text-muted)]">Average Rating</div>
        </div>
        <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-lg p-4 text-center">
          <div className="text-3xl font-bold text-[var(--text-primary)]">{stats.response_rate}%</div>
          <div className="text-sm text-[var(--text-muted)]">Response Rate</div>
        </div>
        <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-lg p-4 text-center">
          <div className="text-3xl font-bold text-green-600">{stats.sentiment_breakdown.positive}</div>
          <div className="text-sm text-[var(--text-muted)]">Positive Reviews</div>
        </div>
      </div>

      {/* Sentiment Breakdown */}
      <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-lg p-6">
        <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-4">Sentiment Breakdown</h3>
        <div className="flex items-center space-x-4">
          {(['positive', 'neutral', 'negative'] as const).map((sentiment) => {
            const count = stats.sentiment_breakdown[sentiment];
            const pct = stats.total_reviews > 0 ? Math.round((count / stats.total_reviews) * 100) : 0;
            const colors: Record<string, string> = { positive: 'bg-green-500', neutral: 'bg-[var(--text-muted)]', negative: 'bg-red-500' };
            return (
              <div key={sentiment} className="flex-1">
                <div className="flex justify-between text-sm mb-1">
                  <span className="capitalize text-[var(--text-secondary)]">{sentiment}</span>
                  <span className="font-medium">{count} ({pct}%)</span>
                </div>
                <div className="w-full bg-[var(--surface)] rounded-full h-3">
                  <div className={`h-3 rounded-full ${colors[sentiment]}`} style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Top Themes */}
      {stats.top_themes.length > 0 && (
        <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-lg p-6">
          <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-4">Top Review Themes</h3>
          <div className="space-y-2">
            {stats.top_themes.slice(0, 10).map((theme) => (
              <div key={theme.theme} className="flex items-center justify-between py-2 border-b border-[var(--border)] last:border-0">
                <span className="text-sm text-[var(--text-secondary)] capitalize">{theme.theme}</span>
                <div className="flex items-center space-x-2">
                  <span className="text-sm font-medium text-[var(--text-primary)]">{theme.count}</span>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                    theme.sentiment === 'positive' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                  }`}>
                    {theme.sentiment}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Rating Trend */}
      {stats.rating_trend.length > 0 && (
        <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-lg p-6">
          <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-4">Rating Trend</h3>
          <div className="space-y-2">
            {stats.rating_trend.map((point) => (
              <div key={point.month} className="flex items-center justify-between py-2 border-b border-[var(--border)] last:border-0">
                <span className="text-sm text-[var(--text-secondary)]">{point.month}</span>
                <div className="flex items-center space-x-4">
                  <span className="text-sm font-medium text-[var(--text-primary)]">{point.avg_rating.toFixed(2)} avg</span>
                  <span className="text-sm text-[var(--text-muted)]">{point.count} reviews</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
