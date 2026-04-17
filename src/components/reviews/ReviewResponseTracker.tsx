'use client';

import React, { useState, useMemo } from 'react';
import type { ReviewUI } from '@/hooks/useReviews';

interface Props {
  reviews: ReviewUI[];
}

const SENTIMENT_COLORS: Record<string, string> = {
  positive: 'bg-green-100 text-green-700',
  neutral: 'bg-[var(--surface)] text-[var(--text-secondary)]',
  negative: 'bg-red-100 text-red-700',
};

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-700',
  drafted: 'bg-[var(--badge-blue-bg)] text-[var(--badge-blue-text)]',
  approved: 'bg-green-100 text-green-700',
  posted: 'bg-green-200 text-green-800',
  not_needed: 'bg-[var(--surface)] text-[var(--text-muted)]',
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
      <div className="text-center py-12 text-[var(--text-muted)]">
        <p className="text-lg font-medium">No reviews to display</p>
      </div>
    );
  }

  return (
    <div>
      {/* Filters */}
      <div className="flex items-center gap-4 mb-4">
        <div>
          <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">Channel</label>
          <select
            value={channelFilter}
            onChange={(e) => setChannelFilter(e.target.value)}
            className="border border-[var(--border)] rounded-md px-3 py-1.5 text-sm bg-[var(--card-bg)] text-[var(--text-primary)]"
          >
            {CHANNELS.map((ch) => (
              <option key={ch} value={ch}>{ch === 'all' ? 'All Channels' : ch.charAt(0).toUpperCase() + ch.slice(1)}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">Response Status</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="border border-[var(--border)] rounded-md px-3 py-1.5 text-sm bg-[var(--card-bg)] text-[var(--text-primary)]"
          >
            {STATUSES.map((st) => (
              <option key={st} value={st}>{st === 'all' ? 'All Statuses' : st.charAt(0).toUpperCase() + st.slice(1)}</option>
            ))}
          </select>
        </div>
        <div className="ml-auto text-sm text-[var(--text-muted)]">
          Showing {filtered.length} of {reviews.length}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-[var(--border)]">
          <thead className="bg-[var(--surface)]">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-[var(--text-muted)] uppercase">Guest</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-[var(--text-muted)] uppercase">Property</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-[var(--text-muted)] uppercase">Channel</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-[var(--text-muted)] uppercase">Rating</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-[var(--text-muted)] uppercase">Sentiment</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-[var(--text-muted)] uppercase">Response</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-[var(--text-muted)] uppercase">Date</th>
            </tr>
          </thead>
          <tbody className="bg-[var(--card-bg)] divide-y divide-[var(--border)]">
            {filtered.map((review) => (
              <tr key={review.id} className="hover:bg-[var(--table-row-hover)]">
                <td className="px-4 py-3 text-sm font-medium text-[var(--text-primary)]">{review.guest_name || '—'}</td>
                <td className="px-4 py-3 text-sm text-[var(--text-secondary)]">{review.property_name || '—'}</td>
                <td className="px-4 py-3 text-sm text-[var(--text-secondary)] capitalize">{review.channel}</td>
                <td className="px-4 py-3 text-sm text-[var(--text-secondary)]">{review.rating ? `${review.rating}/5` : '—'}</td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${SENTIMENT_COLORS[review.sentiment] || 'bg-[var(--surface)] text-[var(--text-secondary)]'}`}>
                    {review.sentiment || 'unknown'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[review.response_status] || 'bg-[var(--surface)] text-[var(--text-secondary)]'}`}>
                    {review.response_status}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm text-[var(--text-muted)]">{review.review_date || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
