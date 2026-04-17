import { HEALTH_STATUS_CONFIG } from '@/lib/constants';
import type { HealthStatus } from '@/lib/types';

interface StatusBadgeProps {
  status: HealthStatus;
  size?: 'sm' | 'md';
  showLabel?: boolean;
}

export default function StatusBadge({ status, size = 'md', showLabel = true }: StatusBadgeProps) {
  const config = HEALTH_STATUS_CONFIG[status] || HEALTH_STATUS_CONFIG.unknown;

  const dotSize = size === 'sm' ? 'w-2 h-2' : 'w-2.5 h-2.5';
  const textSize = size === 'sm' ? 'text-xs' : 'text-sm';
  const padding = size === 'sm' ? 'px-1.5 py-0.5' : 'px-2 py-1';

  return (
    <span className={`inline-flex items-center gap-1.5 ${padding} rounded-full ${textSize} font-medium`}>
      <span className={`${dotSize} rounded-full ${config.bgColor} flex-shrink-0`} />
      {showLabel && <span className={config.color}>{config.label}</span>}
    </span>
  );
}
