import { formatDate, daysSince } from '@/lib/utils';
import { STALE_DATA_THRESHOLD_DAYS } from '@/lib/constants';

interface DataFreshnessTagProps {
  lastScanDate: string | null;
}

export default function DataFreshnessTag({ lastScanDate }: DataFreshnessTagProps) {
  const days = daysSince(lastScanDate);
  const isStale = days !== null && days > STALE_DATA_THRESHOLD_DAYS;

  if (!lastScanDate) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
        <span className="w-2 h-2 rounded-full bg-muted-foreground" />
        No scan data
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 text-xs ${
        isStale ? 'text-health-orange font-medium' : 'text-muted-foreground'
      }`}
    >
      <span
        className={`w-2 h-2 rounded-full ${
          isStale ? 'bg-health-orange animate-pulse' : 'bg-health-green'
        }`}
      />
      Last scan: {formatDate(lastScanDate)}
      {isStale && ` (${days}d ago \u2014 stale)`}
    </span>
  );
}
