'use client';

import { scoreToGrade, scoreColor, cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { CommandGridSummary } from '@/lib/types';

interface HealthScoreDistributionProps {
  summary: CommandGridSummary | null;
  onGradeClick: (grade: string) => void;
  activeGrade: string | null;
}

interface GradeSegment {
  grade: string;
  count: number;
  fillClass: string;
  label: string;
}

export default function HealthScoreDistribution({
  summary,
  onGradeClick,
  activeGrade,
}: HealthScoreDistributionProps) {
  if (!summary) return null;

  const segments: GradeSegment[] = [
    { grade: 'A', count: summary.grade_a_count, fillClass: 'bg-health-green', label: 'A (80+)' },
    { grade: 'B', count: summary.grade_b_count, fillClass: 'bg-health-yellow', label: 'B (60-79)' },
    { grade: 'C', count: summary.grade_c_count, fillClass: 'bg-health-orange', label: 'C (40-59)' },
    { grade: 'D', count: summary.grade_d_count, fillClass: 'bg-health-red', label: 'D/F (<40)' },
    { grade: 'unscored', count: summary.unscored_count, fillClass: 'bg-muted-foreground/40', label: 'Unscored' },
  ];

  const total = segments.reduce((sum, s) => sum + s.count, 0);

  const avgScore = summary.avg_health_score;
  const avgGrade = scoreToGrade(avgScore);
  const avgColor = scoreColor(avgScore);

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-3">
        <div>
          <CardTitle>Health Score Distribution</CardTitle>
          <p className="text-xs text-muted-foreground mt-1">{total.toLocaleString()} properties</p>
        </div>
        <div className="flex items-baseline gap-1.5">
          <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Avg</span>
          <span className={cn('text-2xl font-semibold tabular-nums', avgColor)}>
            {avgScore !== null ? avgScore.toFixed(0) : '—'}
          </span>
          <span className={cn('text-sm font-semibold', avgColor)}>{avgGrade}</span>
        </div>
      </CardHeader>
      <CardContent>
        {total === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">
            No health score data available
          </p>
        ) : (
          <>
            <div className="w-full h-2.5 rounded-full overflow-hidden flex bg-muted">
              {segments
                .filter((s) => s.count > 0)
                .map((segment) => {
                  const widthPct = (segment.count / total) * 100;
                  const isInactive = activeGrade !== null && activeGrade !== segment.grade;
                  return (
                    <button
                      key={segment.grade}
                      type="button"
                      className={cn(
                        'h-full transition-opacity hover:opacity-80',
                        segment.fillClass,
                        isInactive && 'opacity-30',
                      )}
                      style={{ width: `${widthPct}%` }}
                      onClick={() => onGradeClick(segment.grade)}
                      title={`${segment.label}: ${segment.count} properties`}
                    />
                  );
                })}
            </div>

            <div className="flex items-center gap-2 mt-4 flex-wrap">
              {segments.map((segment) => {
                const isActive = activeGrade === segment.grade;
                const isDim = activeGrade !== null && !isActive;
                return (
                  <button
                    key={segment.grade}
                    type="button"
                    onClick={() => onGradeClick(segment.grade)}
                    className={cn(
                      'flex items-center gap-1.5 px-2 py-1 rounded-md text-left transition-all',
                      isActive
                        ? 'bg-accent ring-1 ring-border'
                        : 'hover:bg-accent',
                      isDim && 'opacity-50',
                    )}
                  >
                    <span className={cn('w-2 h-2 rounded-full', segment.fillClass)} />
                    <span className="text-xs font-medium text-muted-foreground">{segment.label}</span>
                    <span className="text-xs font-semibold text-foreground tabular-nums">
                      {segment.count}
                    </span>
                  </button>
                );
              })}
              {activeGrade && (
                <button
                  type="button"
                  onClick={() => onGradeClick(activeGrade)}
                  className="text-xs text-primary hover:underline ml-1"
                >
                  Clear filter
                </button>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
