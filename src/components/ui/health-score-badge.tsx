import * as React from 'react';
import { ArrowUp, ArrowDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { scoreToGrade, scoreColor } from '@/lib/utils';

interface HealthScoreBadgeProps {
  score: number | null;
  delta?: number | null;
  size?: 'sm' | 'md';
  className?: string;
}

const RING_FROM_COLOR: Record<string, string> = {
  'text-health-green': 'border-health-green/40 bg-health-green/10',
  'text-health-yellow': 'border-health-yellow/40 bg-health-yellow/10',
  'text-health-orange': 'border-health-orange/40 bg-health-orange/10',
  'text-health-red': 'border-destructive/40 bg-destructive/10',
  'text-muted-foreground': 'border-border bg-muted',
};

export function HealthScoreBadge({
  score,
  delta = null,
  size = 'md',
  className,
}: HealthScoreBadgeProps) {
  if (score === null || score === undefined) {
    return <span className="text-muted-foreground text-xs">—</span>;
  }
  const grade = scoreToGrade(score);
  const colorClass = scoreColor(score);
  const ring = RING_FROM_COLOR[colorClass] ?? RING_FROM_COLOR['text-muted-foreground'];
  const dim = size === 'sm' ? 'h-8 w-8' : 'h-9 w-9';

  return (
    <div className={cn('inline-flex items-center gap-1.5', className)}>
      <div
        className={cn(
          'flex flex-col items-center justify-center rounded-full border leading-none',
          dim,
          ring,
        )}
      >
        <span className={cn('text-xs font-semibold tabular-nums', colorClass)}>
          {score}
        </span>
        <span className={cn('text-[9px] font-semibold', colorClass)}>{grade}</span>
      </div>
      {delta !== null && delta !== undefined && delta !== 0 && (
        <span
          className={cn(
            'inline-flex items-center text-[10px] font-medium tabular-nums',
            delta > 0 ? 'text-health-green' : 'text-destructive',
          )}
        >
          {delta > 0 ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
          {Math.abs(delta)}
        </span>
      )}
    </div>
  );
}
