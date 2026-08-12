'use client';

import React, { useState, useMemo } from 'react';
import type { ReviewUI } from '@/hooks/useReviews';

interface Props {
  reviews: ReviewUI[];
}

const SENTIMENT_COLORS: Record<string, string> = {
  positive: 'bg-health-green/15 text-health-green',
  neutral: 'bg-muted text-muted-foreground',
  negative: 'bg-destructive/15 text-destructive',
};

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-health-yellow/15 text-health-yellow',
  drafted: 'bg-secondary text-secondary-foreground',
  approved: 'bg-health-green/15 text-health-green',
  posted: 'bg-health-green/20 text-health-green',
  not_needed: 'bg-muted text-muted-foreground',
};

const CHANNELS = ['all', 'airbnb', 'vrbo', 'google'] as const;
const STATUSES = ['all', 'pending', 'drafted', 'approved', 'posted'] as const;

export default function ReviewResponseTracker({ reviews }: Props) {
  const [channelFilter, setChannelFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const filtered = useMemo(() => {
    return reviews.filter((r) => {
      if (channelFilter !== 'all' && r.channel !== channelFilter) return false;
      if (statusFilter !== 'all' && r.response_status !== statusFilter) return false;
      return true;
    });
  }, [reviews, channelFilter, statusFilter]);

  if (reviews.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p className="text-lg font-medium">No reviews to display</p>
      </div>
    );
  }

  return (
    <div>
      {/* Filters */}
      <div className="flex items-center gap-4 mb-4">
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">Channel</label>
          <select
            value={channelFilter}
            onChange={(e) => setChannelFilter(e.target.value)}
            className="border border-border rounded-md px-3 py-1.5 text-sm bg-card text-foreground"
          >
            {CHANNELS.map((ch) => (
              <option key={ch} value={ch}>{ch === 'all' ? 'All Channels' : ch.charAt(0).toUpperCase() + ch.slice(1)}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">Response Status</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="border border-border rounded-md px-3 py-1.5 text-sm bg-card text-foreground"
          >
            {STATUSES.map((st) => (
              <option key={st} value={st}>{st === 'all' ? 'All Statuses' : st.charAt(0).toUpperCase() + st.slice(1)}</option>
            ))}
          </select>
        </div>
        <div className="ml-auto text-sm text-muted-foreground">
          Showing {filtered.length} of {reviews.length}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-[var(--border)]">
          <thead className="bg-muted">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Guest</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Property</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Channel</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Rating</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Sentiment</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Response</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Date</th>
            </tr>
          </thead>
          <tbody className="bg-card divide-y divide-[var(--border)]">
            {filtered.map((review) => (
              <tr key={review.id} className="hover:bg-accent">
                <td className="px-4 py-3 text-sm font-medium text-foreground">{review.guest_name || '—'}</td>
                <td className="px-4 py-3 text-sm text-muted-foreground">{review.property_name || '—'}</td>
                <td className="px-4 py-3 text-sm text-muted-foreground capitalize">{review.channel}</td>
                <td className="px-4 py-3 text-sm text-muted-foreground">{review.rating ? `${review.rating}/5` : '—'}</td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${SENTIMENT_COLORS[review.sentiment] || 'bg-muted text-muted-foreground'}`}>
                    {review.sentiment || 'unknown'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[review.response_status] || 'bg-muted text-muted-foreground'}`}>
                    {review.response_status}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm text-muted-foreground">{review.review_date || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
