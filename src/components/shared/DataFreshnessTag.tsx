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
      <span className="inline-flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
        <span className="w-2 h-2 rounded-full bg-[var(--text-muted)]" />
        No scan data
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 text-xs ${
        isStale ? 'text-amber-600 font-medium' : 'text-[var(--text-muted)]'
      }`}
    >
      <span
        className={`w-2 h-2 rounded-full ${
          isStale ? 'bg-amber-500 animate-pulse' : 'bg-green-400'
        }`}
      />
      Last scan: {formatDate(lastScanDate)}
      {isStale && ` (${days}d ago \u2014 stale)`}
    </span>
  );
}
