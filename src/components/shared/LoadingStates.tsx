/** Generic skeleton bar */
export function SkeletonBar({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse bg-[var(--border)] rounded ${className}`} />;
}

/** Skeleton for MetricCard */
export function MetricCardSkeleton() {
  return (
    <div className="bg-card rounded-lg border border-border p-4">
      <SkeletonBar className="h-3 w-20 mb-3" />
      <SkeletonBar className="h-7 w-24 mb-2" />
      <SkeletonBar className="h-3 w-28" />
    </div>
  );
}

/** Skeleton for a table row */
export function TableRowSkeleton({ columns = 9 }: { columns?: number }) {
  return (
    <tr>
      {Array.from({ length: columns }).map((_, i) => (
        <td key={i} className="px-4 py-3">
          <SkeletonBar className="h-4 w-full" />
        </td>
      ))}
    </tr>
  );
}

/** Skeleton for the full portfolio summary bar */
export function SummaryBarSkeleton() {
  return (
    <div className="bg-card border-b border-border px-6 py-3 flex items-center gap-8">
      {Array.from({ length: 7 }).map((_, i) => (
        <div key={i} className="flex flex-col gap-1">
          <SkeletonBar className="h-3 w-16" />
          <SkeletonBar className="h-5 w-12" />
        </div>
      ))}
    </div>
  );
}

/** Skeleton for a chart area */
export function ChartSkeleton({ height = 'h-64' }: { height?: string }) {
  return (
    <div className={`animate-pulse bg-muted rounded-lg border border-border ${height} flex items-center justify-center`}>
      <div className="text-muted-foreground text-sm">Loading chart...</div>
    </div>
  );
}

/** Full dashboard skeleton */
export function DashboardSkeleton() {
  return (
    <div className="space-y-6 p-6">
      <SummaryBarSkeleton />
      <div className="grid grid-cols-2 gap-6">
        <ChartSkeleton />
        <ChartSkeleton />
      </div>
      <div className="bg-card rounded-lg border border-border p-4">
        <table className="w-full">
          <tbody>
            {Array.from({ length: 8 }).map((_, i) => (
              <TableRowSkeleton key={i} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
