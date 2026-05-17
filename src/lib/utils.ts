import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Merge Tailwind classes with conflict resolution.
 * Standard shadcn/ui helper used by all UI primitives.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/**
 * Format a number as a percentage string.
 * formatPct(50.9) => "50.9%"
 * formatPct(null) => "\u2014"
 */
export function formatPct(value: number | null | undefined, decimals: number = 1): string {
  if (value === null || value === undefined) return '\u2014';
  return `${value.toFixed(decimals)}%`;
}

/**
 * Format a number with comma separators.
 * formatNumber(1234) => "1,234"
 * formatNumber(null) => "\u2014"
 */
export function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined) return '\u2014';
  return value.toLocaleString();
}

/**
 * Format a date string to a short display format.
 * formatDate("2026-03-30") => "Mar 30"
 * formatDate("2026-03-30", true) => "Mar 30, 2026"
 */
export function formatDate(dateStr: string | null | undefined, includeYear: boolean = false): string {
  if (!dateStr) return '\u2014';
  const date = new Date(dateStr + 'T00:00:00');
  const options: Intl.DateTimeFormatOptions = {
    month: 'short',
    day: 'numeric',
    ...(includeYear ? { year: 'numeric' } : {}),
  };
  return date.toLocaleDateString('en-US', options);
}

/**
 * Calculate days between a date and now.
 * Positive = date is in the past.
 */
export function daysSince(dateStr: string | null | undefined): number | null {
  if (!dateStr) return null;
  const date = new Date(dateStr + 'T00:00:00');
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * Compute trend direction from two values.
 * Returns 'up', 'down', or 'flat'.
 * Threshold: +/- 0.5% considered flat.
 */
export type TrendDirection = 'up' | 'down' | 'flat';

export function computeTrend(
  current: number | null | undefined,
  previous: number | null | undefined,
  threshold: number = 0.5
): TrendDirection {
  if (current === null || current === undefined || previous === null || previous === undefined) {
    return 'flat';
  }
  const delta = current - previous;
  if (Math.abs(delta) < threshold) return 'flat';
  return delta > 0 ? 'up' : 'down';
}

/**
 * Clamp a value between min and max.
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Format a number as currency.
 * formatCurrency(1234.56) => "$1,235"
 * formatCurrency(1234.56, true) => "$1,234.56"
 */
export function formatCurrency(value: number | null | undefined, showCents: boolean = false): string {
  if (value === null || value === undefined) return '\u2014';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: showCents ? 2 : 0,
    maximumFractionDigits: showCents ? 2 : 0,
  }).format(value);
}

/**
 * Format a health score as letter grade with color hint.
 */
export function scoreToGrade(score: number | null | undefined): string {
  if (score === null || score === undefined) return '\u2014';
  if (score >= 80) return 'A';
  if (score >= 60) return 'B';
  if (score >= 40) return 'C';
  if (score >= 20) return 'D';
  return 'F';
}

/**
 * Get color class for health score.
 */
export function scoreColor(score: number | null | undefined): string {
  if (score === null || score === undefined) return 'text-muted-foreground';
  if (score >= 80) return 'text-health-green';
  if (score >= 60) return 'text-health-yellow';
  if (score >= 40) return 'text-health-orange';
  return 'text-health-red';
}

/**
 * Get color class for pace status.
 */
export function paceColor(status: string | null | undefined): string {
  switch (status) {
    case 'ahead': return 'text-health-green';
    case 'on_track': return 'text-health-green';
    case 'behind': return 'text-health-orange';
    case 'at_risk': return 'text-health-red';
    default: return 'text-muted-foreground';
  }
}

/**
 * Format pace status label.
 */
export function paceLabel(status: string | null | undefined): string {
  switch (status) {
    case 'ahead': return 'Ahead';
    case 'on_track': return 'On Track';
    case 'behind': return 'Behind';
    case 'at_risk': return 'At Risk';
    default: return '\u2014';
  }
}
