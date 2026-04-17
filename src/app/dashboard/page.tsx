'use client';

import { useState } from 'react';
import { useCommandGrid } from '@/hooks/useCommandGrid';
// Old imports kept for easy revert
// import { usePortfolioHealth } from '@/hooks/usePortfolioHealth';
// import { useAgentActivity } from '@/hooks/useAgentActivity';
// import { useApprovals } from '@/hooks/useApprovals';
// import PortfolioSummaryBar from '@/components/dashboard/PortfolioSummaryBar';
// import HealthDistribution from '@/components/dashboard/HealthDistribution';
// import PropertyTable from '@/components/dashboard/PropertyTable';
// import TrendCharts from '@/components/dashboard/TrendCharts';
// import AgentActivityFeed from '@/components/dashboard/AgentActivityFeed';
import CommandSummaryBar from '@/components/dashboard/CommandSummaryBar';
import HealthScoreDistribution from '@/components/dashboard/HealthScoreDistribution';
import RevenuePaceCards from '@/components/dashboard/RevenuePaceCards';
import CommandGrid from '@/components/dashboard/CommandGrid';
import { DashboardSkeleton } from '@/components/shared/LoadingStates';

export default function DashboardPage() {
  const [healthGradeFilter, setHealthGradeFilter] = useState<string | null>(null);
  const [paceStatusFilter, setPaceStatusFilter] = useState<string | null>(null);

  const { rows, summary, isLoading } = useCommandGrid();

  const handleGradeClick = (grade: string) => {
    setHealthGradeFilter((prev) => (prev === grade ? null : grade));
  };

  const handlePaceClick = (status: string) => {
    setPaceStatusFilter((prev) => (prev === status ? null : status));
  };

  // Get data freshness from first row's snapshot_date
  const dataDate = rows.length > 0 ? rows[0].snapshot_date : null;

  if (isLoading && !summary) {
    return <DashboardSkeleton />;
  }

  return (
    <div className="flex flex-col">
      {/* Sticky Summary Bar */}
      <CommandSummaryBar
        summary={summary}
        dataDate={dataDate}
        isLoading={isLoading}
      />

      {/* Main Content */}
      <div className="p-6 space-y-6">
        {/* Row 1: Health Score Distribution + Revenue Pace Cards */}
        <div className="grid grid-cols-12 gap-6">
          <div className="col-span-5">
            <HealthScoreDistribution
              summary={summary}
              onGradeClick={handleGradeClick}
              activeGrade={healthGradeFilter}
            />
          </div>
          <div className="col-span-7">
            <RevenuePaceCards
              summary={summary}
              onPaceClick={handlePaceClick}
              activePace={paceStatusFilter}
            />
          </div>
        </div>

        {/* Row 2: Command Grid (full width) */}
        <CommandGrid
          data={rows}
          isLoading={isLoading}
          healthGradeFilter={healthGradeFilter}
          paceStatusFilter={paceStatusFilter}
        />
      </div>
    </div>
  );
}
