'use client';

import { useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { useReviews } from '@/hooks/useReviews';
import PendingRatingsQueue from '@/components/reviews/PendingRatingsQueue';
import ReviewResponseTracker from '@/components/reviews/ReviewResponseTracker';
import ReviewAnalytics from '@/components/reviews/ReviewAnalytics';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export default function ReviewsPage() {
  const { pendingRatings, reviews, isLoading, error, refresh } = useReviews();
  const [activeTab, setActiveTab] = useState<'ratings' | 'responses' | 'analytics'>('ratings');

  const urgentCount = pendingRatings.filter((r) => r.is_urgent).length;
  const reviewsNeedingResponse = reviews.filter((r) => r.response_status === 'pending').length;
  const responsesPosted = reviews.filter((r) => r.response_status === 'posted').length;

  const tabs = [
    { key: 'ratings' as const, label: `Pending Ratings`, count: pendingRatings.length },
    { key: 'responses' as const, label: `Review Responses`, count: reviews.length },
    { key: 'analytics' as const, label: 'Analytics', count: null as number | null },
  ];

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Review Management
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Guest ratings, review responses, and sentiment tracking.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={refresh}>
          <RefreshCw className="h-3.5 w-3.5" />
          Refresh
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-semibold tabular-nums text-foreground">
              {pendingRatings.length}
            </div>
            <div className="text-xs uppercase tracking-wide text-muted-foreground mt-1">
              Pending ratings
            </div>
          </CardContent>
        </Card>
        <Card className={cn(urgentCount > 0 && 'border-destructive/40 bg-destructive/5')}>
          <CardContent className="p-4">
            <div
              className={cn(
                'text-2xl font-semibold tabular-nums',
                urgentCount > 0 ? 'text-destructive' : 'text-foreground',
              )}
            >
              {urgentCount}
            </div>
            <div className="text-xs uppercase tracking-wide text-muted-foreground mt-1">
              Urgent (2 days or less)
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-semibold tabular-nums text-foreground">
              {reviewsNeedingResponse}
            </div>
            <div className="text-xs uppercase tracking-wide text-muted-foreground mt-1">
              Needing response
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-semibold tabular-nums text-foreground">
              {responsesPosted}
            </div>
            <div className="text-xs uppercase tracking-wide text-muted-foreground mt-1">
              Responses posted
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="border-b border-border">
        <nav className="flex gap-6">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                'py-2.5 px-1 border-b-2 text-sm font-medium transition-colors',
                activeTab === tab.key
                  ? 'border-foreground text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground',
              )}
            >
              {tab.label}
              {tab.count !== null && (
                <span className="ml-1.5 text-xs text-muted-foreground tabular-nums">
                  ({tab.count})
                </span>
              )}
            </button>
          ))}
        </nav>
      </div>

      {isLoading && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 bg-muted rounded-md animate-pulse" />
          ))}
        </div>
      )}
      {error && (
        <Card className="border-destructive/40 bg-destructive/5">
          <CardContent className="p-4">
            <p className="text-sm text-destructive">{error}</p>
          </CardContent>
        </Card>
      )}

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
