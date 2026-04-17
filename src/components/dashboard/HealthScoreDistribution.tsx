'use client';

import { scoreToGrade, scoreColor } from '@/lib/utils';
import type { CommandGridSummary } from '@/lib/types';

interface HealthScoreDistributionProps {
  summary: CommandGridSummary | null;
  onGradeClick: (grade: string) => void;
  activeGrade: string | null;
}

interface GradeSegment {
  grade: string;
  count: number;
  color: string;
  bgColor: string;
  label: string;
}

export default function HealthScoreDistribution({
  summary,
  onGradeClick,
  activeGrade,
}: HealthScoreDistributionProps) {
  if (!summary) return null;

  const segments: GradeSegment[] = [
    { grade: 'A', count: summary.grade_a_count, color: 'text-health-green', bgColor: 'bg-health-green', label: 'A (80+)' },
    { grade: 'B', count: summary.grade_b_count, color: 'text-health-yellow', bgColor: 'bg-health-yellow', label: 'B (60-79)' },
    { grade: 'C', count: summary.grade_c_count, color: 'text-health-orange', bgColor: 'bg-health-orange', label: 'C (40-59)' },
    { grade: 'D', count: summary.grade_d_count, color: 'text-health-red', bgColor: 'bg-health-red', label: 'D/F (<40)' },
    { grade: 'unscored', count: summary.unscored_count, color: 'text-[var(--text-muted)]', bgColor: 'bg-gray-300', label: 'Unscored' },
  ];

  const total = segments.reduce((sum, s) => sum + s.count, 0);
  if (total === 0) {
    return (
      <div className="bg-[var(--card-bg)] rounded-lg border border-lc-border p-6 text-center text-[var(--text-muted)]">
        No health score data available
      </div>
    );
  }

  const avgScore = summary.avg_health_score;
  const avgGrade = scoreToGrade(avgScore);
  const avgColor = scoreColor(avgScore);

  // Hex colors for the bar segments
  const segmentHexColors: Record<string, string> = {
    A: '#22C55E',
    B: '#EAB308',
    C: '#F97316',
    D: '#EF4444',
    unscored: '#D1D5DB',
  };

  return (
    <div className="bg-[var(--card-bg)] rounded-lg border border-lc-border p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-[var(--text-secondary)]">Health Score Distribution</h3>
        <div className="flex items-center gap-2">
          <span className="text-xs text-[var(--text-muted)]">Avg Score</span>
          <span className={`text-2xl font-bold ${avgColor}`}>
            {avgScore !== null ? avgScore.toFixed(0) : '\u2014'}
          </span>
          <span className={`text-sm font-semibold ${avgColor}`}>{avgGrade}</span>
        </div>
      </div>

      {/* Stacked horizontal bar */}
      <div className="w-full h-6 rounded-full overflow-hidden flex bg-[var(--surface)]">
        {segments
          .filter((s) => s.count > 0)
          .map((segment) => {
            const widthPct = (segment.count / total) * 100;
            const isActive = activeGrade === segment.grade;
            const isInactive = activeGrade !== null && !isActive;
            return (
              <button
                key={segment.grade}
                className="h-full transition-opacity cursor-pointer hover:opacity-80"
                style={{
                  width: `${widthPct}%`,
                  backgroundColor: segmentHexColors[segment.grade],
                  opacity: isInactive ? 0.3 : 1,
                }}
                onClick={() => onGradeClick(segment.grade)}
                title={`${segment.label}: ${segment.count} properties`}
              />
            );
          })}
      </div>

      {/* Grade counts below the bar */}
      <div className="flex items-center gap-3 mt-3 flex-wrap">
        {segments.map((segment) => (
          <button
            key={segment.grade}
            onClick={() => onGradeClick(segment.grade)}
            className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-left transition-all ${
              activeGrade === segment.grade
                ? 'bg-[var(--surface)] ring-1 ring-[var(--border)]'
                : 'hover:bg-[var(--surface)]'
            } ${activeGrade !== null && activeGrade !== segment.grade ? 'opacity-50' : ''}`}
          >
            <span
              className="w-2.5 h-2.5 rounded-full flex-shrink-0"
              style={{ backgroundColor: segmentHexColors[segment.grade] }}
            />
            <span className="text-xs font-medium text-[var(--text-secondary)]">{segment.label}</span>
            <span className="text-xs font-bold text-[var(--text-primary)]">{segment.count}</span>
          </button>
        ))}
        {activeGrade && (
          <button
            onClick={() => onGradeClick(activeGrade)}
            className="text-xs text-lc-primary hover:underline ml-1"
          >
            Clear filter
          </button>
        )}
      </div>
    </div>
  );
}
