'use client';

import React, { useState } from 'react';
import { useReviews } from '@/hooks/useReviews';
import PendingRatingsQueue from '@/components/reviews/PendingRatingsQueue';
import ReviewResponseTracker from '@/components/reviews/ReviewResponseTracker';
import ReviewAnalytics from '@/components/reviews/ReviewAnalytics';

export default function ReviewsPage() {
  const { pendingRatings, reviews, isLoading, error, refresh } = useReviews();
  const [activeTab, setActiveTab] = useState<'ratings' | 'responses' | 'analytics'>('ratings');

  const urgentCount = pendingRatings.filter(r => r.is_urgent).length;

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">Review Management</h1>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            Guest ratings, review responses, and sentiment tracking.
          </p>
        </div>
        <button onClick={refresh} className="px-4 py-2 bg-[var(--card-bg)] border border-[var(--border)] rounded-md text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--table-row-hover)]">
          Refresh
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-lg p-4">
          <div className="text-2xl font-bold text-[var(--text-primary)]">{pendingRatings.length}</div>
          <div className="text-sm text-[var(--text-muted)]">Pending Ratings</div>
        </div>
        <div className={`border rounded-lg p-4 ${urgentCount > 0 ? 'bg-red-50 border-red-200' : 'bg-[var(--card-bg)] border-[var(--border)]'}`}>
          <div className={`text-2xl font-bold ${urgentCount > 0 ? 'text-red-600' : 'text-[var(--text-primary)]'}`}>{urgentCount}</div>
          <div className="text-sm text-[var(--text-muted)]">Urgent (2 days or less)</div>
        </div>
        <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-lg p-4">
          <div className="text-2xl font-bold text-[var(--text-primary)]">{reviews.filter(r => r.response_status === 'pending').length}</div>
          <div className="text-sm text-[var(--text-muted)]">Reviews Needing Response</div>
        </div>
        <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-lg p-4">
          <div className="text-2xl font-bold text-[var(--text-primary)]">{reviews.filter(r => r.response_status === 'posted').length}</div>
          <div className="text-sm text-[var(--text-muted)]">Responses Posted</div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-[var(--border)] mb-6">
        <nav className="flex space-x-8">
          {(['ratings', 'responses', 'analytics'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`py-3 px-1 border-b-2 text-sm font-medium ${
                activeTab === tab
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
              }`}
            >
              {tab === 'ratings' && `Pending Ratings (${pendingRatings.length})`}
              {tab === 'responses' && `Review Responses (${reviews.length})`}
              {tab === 'analytics' && 'Analytics'}
            </button>
          ))}
        </nav>
      </div>

      {isLoading && <div className="space-y-4">{[1, 2, 3].map(i => <div key={i} className="h-16 bg-[var(--surface)] rounded-lg animate-pulse" />)}</div>}
      {error && <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-6"><p className="text-sm text-red-700">{error}</p></div>}

      {!isLoading && !error && (
        <>
          {activeTab === 'ratings' && <PendingRatingsQueue ratings={pendingRatings} />}
          {activeTab === 'responses' && <ReviewResponseTracker reviews={reviews} />}
          {activeTab === 'analytics' && <ReviewAnalytics />}
        </>
      )}
    </div>
  );
}
