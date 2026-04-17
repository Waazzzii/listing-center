import type { TrendDirection } from '@/lib/utils';

interface TrendArrowProps {
  direction: TrendDirection;
  size?: 'sm' | 'md';
  /** When true, "up" is good (green). When false, "up" is bad (red). Default true. */
  upIsGood?: boolean;
}

const ARROW_CONFIG = {
  up: {
    symbol: '\u2191',
    goodColor: 'text-green-600',
    badColor: 'text-red-600',
  },
  down: {
    symbol: '\u2193',
    goodColor: 'text-red-600',
    badColor: 'text-green-600',
  },
  flat: {
    symbol: '\u2192',
    goodColor: 'text-[var(--text-muted)]',
    badColor: 'text-[var(--text-muted)]',
  },
};

export default function TrendArrow({ direction, size = 'sm', upIsGood = true }: TrendArrowProps) {
  const config = ARROW_CONFIG[direction];
  const color = upIsGood ? config.goodColor : config.badColor;
  const fontSize = size === 'sm' ? 'text-sm' : 'text-base';

  return (
    <span className={`${color} ${fontSize} font-bold`} aria-label={`Trend: ${direction}`}>
      {config.symbol}
    </span>
  );
}
