'use client';

import { useState } from 'react';
import { useCommandGrid } from '@/hooks/useCommandGrid';
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

  const dataDate = rows.length > 0 ? rows[0].snapshot_date : null;

  if (isLoading && !summary) {
    return <DashboardSkeleton />;
  }

  return (
    <div className="flex flex-col">
      <CommandSummaryBar summary={summary} dataDate={dataDate} isLoading={isLoading} />

      <div className="px-6 py-6 space-y-6">
        <div className="grid grid-cols-12 gap-6">
          <div className="col-span-12 lg:col-span-5">
            <HealthScoreDistribution
              summary={summary}
              onGradeClick={handleGradeClick}
              activeGrade={healthGradeFilter}
            />
          </div>
          <div className="col-span-12 lg:col-span-7">
            <RevenuePaceCards
              summary={summary}
              onPaceClick={handlePaceClick}
              activePace={paceStatusFilter}
            />
          </div>
        </div>

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
