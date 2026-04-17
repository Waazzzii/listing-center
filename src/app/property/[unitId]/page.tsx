'use client';

import { useParams } from 'next/navigation';
import { usePropertyDetail } from '@/hooks/usePropertyDetail';
import { useMetricHistory } from '@/hooks/useMetricHistory';
import { useApprovals } from '@/hooks/useApprovals';
import PropertyHeader from '@/components/property/PropertyHeader';
import SixNumberCards from '@/components/property/SixNumberCards';
import FunnelVisualization from '@/components/property/FunnelVisualization';
import MetricHistoryCharts from '@/components/property/MetricHistoryCharts';
import RecommendationCards from '@/components/property/RecommendationCards';
import ABTestHistory from '@/components/property/ABTestHistory';
import ReviewSummary from '@/components/property/ReviewSummary';
import ListingContentAudit from '@/components/property/ListingContentAudit';
import { DashboardSkeleton } from '@/components/shared/LoadingStates';

export default function PropertyDetailPage() {
  const params = useParams();
  const unitId = params.unitId as string;

  const {
    property,
    latestSnapshot,
    recommendations,
    abTests,
    reviews,
    isLoading: detailLoading,
    error,
  } = usePropertyDetail(unitId);

  const {
    snapshots: metricHistory,
    isLoading: historyLoading,
  } = useMetricHistory(property?.id || null, 12);

  const {
    updateStatus,
  } = useApprovals(property?.id);

  // Error state
  if (error) {
    return (
      <div className="p-8 text-center">
        <h2 className="text-lg font-semibold text-[var(--text-primary)]">Property Not Found</h2>
        <p className="text-sm text-[var(--text-muted)] mt-1">{error}</p>
      </div>
    );
  }

  // Loading state
  if (detailLoading && !property) {
    return <DashboardSkeleton />;
  }

  if (!property) {
    return (
      <div className="p-8 text-center text-[var(--text-muted)]">No property data available.</div>
    );
  }

  return (
    <div className="flex flex-col">
      {/* Property Header (sticky-ish) */}
      <PropertyHeader
        property={property}
        healthStatus={latestSnapshot?.health_status || 'unknown'}
      />

      {/* Main content */}
      <div className="p-6 space-y-6">
        {/* Row 1: Six metric cards */}
        <SixNumberCards
          snapshot={latestSnapshot}
          isLoading={detailLoading}
        />

        {/* Row 2: Funnel + Metric History side by side */}
        <div className="grid grid-cols-12 gap-6">
          <div className="col-span-4">
            <FunnelVisualization snapshot={latestSnapshot} />
          </div>
          <div className="col-span-8">
            <MetricHistoryCharts
              snapshots={metricHistory}
              isLoading={historyLoading}
            />
          </div>
        </div>

        {/* Row 3: Recommendations + A/B Tests */}
        <div className="grid grid-cols-2 gap-6">
          <RecommendationCards
            recommendations={recommendations}
            onApprove={(id) => updateStatus(id, 'approved')}
            onReject={(id, reason) => updateStatus(id, 'rejected', { rejection_reason: reason })}
            onDefer={(id) => updateStatus(id, 'deferred')}
            isLoading={detailLoading}
          />
          <ABTestHistory
            tests={abTests}
            isLoading={detailLoading}
          />
        </div>

        {/* Row 4: Reviews + Content Audit */}
        <div className="grid grid-cols-2 gap-6">
          <ReviewSummary
            reviews={reviews}
            overallRating={latestSnapshot?.airbnb_overall_rating ?? null}
            reviewCount={latestSnapshot?.airbnb_review_count ?? null}
            isLoading={detailLoading}
          />
          <ListingContentAudit
            isLoading={detailLoading}
            // These will be populated when content audit data is available
            // from the Content Optimizer agent (Plan 4+)
          />
        </div>
      </div>
    </div>
  );
}
