import * as React from 'react';
import { cn } from '@/lib/utils';
import { Card, CardContent } from './card';

export interface StatCardProps extends React.HTMLAttributes<HTMLDivElement> {
  label: string;
  value: React.ReactNode;
  delta?: string;
  deltaTone?: 'positive' | 'negative' | 'neutral';
  icon?: React.ReactNode;
}

export function StatCard({
  label,
  value,
  delta,
  deltaTone = 'neutral',
  icon,
  className,
  ...props
}: StatCardProps) {
  return (
    <Card className={cn('overflow-hidden', className)} {...props}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="space-y-1">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {label}
            </p>
            <p className="text-2xl font-semibold leading-tight text-foreground tabular-nums">
              {value}
            </p>
            {delta && (
              <p
                className={cn(
                  'text-xs',
                  deltaTone === 'positive' && 'text-health-green',
                  deltaTone === 'negative' && 'text-destructive',
                  deltaTone === 'neutral' && 'text-muted-foreground',
                )}
              >
                {delta}
              </p>
            )}
          </div>
          {icon && <div className="text-muted-foreground">{icon}</div>}
        </div>
      </CardContent>
    </Card>
  );
}
