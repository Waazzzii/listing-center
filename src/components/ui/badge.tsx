import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-primary text-primary-foreground',
        secondary: 'border-transparent bg-secondary text-secondary-foreground',
        destructive: 'border-transparent bg-destructive/15 text-destructive',
        outline: 'border-border text-foreground',
        success: 'border-transparent bg-health-green/15 text-health-green',
        warning: 'border-transparent bg-health-orange/15 text-health-orange',
        danger: 'border-transparent bg-health-red/15 text-health-red',
        info: 'border-transparent bg-chart-2/15 text-chart-2',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {
  dot?: boolean;
}

function Badge({ className, variant, dot, children, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props}>
      {dot && (
        <span
          className={cn(
            'inline-block h-1.5 w-1.5 rounded-full',
            variant === 'success' && 'bg-health-green',
            variant === 'warning' && 'bg-health-orange',
            variant === 'danger' && 'bg-health-red',
            variant === 'info' && 'bg-chart-2',
            (!variant || variant === 'default') && 'bg-primary-foreground',
            variant === 'secondary' && 'bg-secondary-foreground',
            variant === 'destructive' && 'bg-destructive',
            variant === 'outline' && 'bg-foreground',
          )}
        />
      )}
      {children}
    </div>
  );
}

export { Badge, badgeVariants };
