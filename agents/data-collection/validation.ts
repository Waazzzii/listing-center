import { z } from 'zod';

// Re-export core validator from lib so all agent code imports from one place
export { validateMetricSnapshot } from '@/lib/validators';

// ============================================================
// RAW VALUE PARSERS
// ============================================================

/**
 * Parse a raw string from Airbnb's UI into a number or null.
 * Handles: "1,234" -> 1234, "$250.00" -> 250, "N/A" -> null, "--" -> null
 */
export function parseNumericValue(raw: string | null | undefined): number | null {
  if (raw == null) return null;

  const trimmed = String(raw).trim();

  // Known null indicators
  if (trimmed === '' || trimmed === 'N/A' || trimmed === '--' || trimmed === '-') {
    return null;
  }

  // Strip currency symbols, commas, whitespace
  const cleaned = trimmed.replace(/[$,\s]/g, '');

  const parsed = parseFloat(cleaned);
  if (isNaN(parsed)) return null;

  return parsed;
}

/**
 * Parse a percentage string. Strips trailing % if present.
 * "55.2%" -> 55.2, "55.2" -> 55.2, "N/A" -> null
 */
export function parsePercentValue(raw: string | null | undefined): number | null {
  if (raw == null) return null;

  const trimmed = String(raw).trim();

  if (trimmed === '' || trimmed === 'N/A' || trimmed === '--' || trimmed === '-') {
    return null;
  }

  // Strip percent sign
  const cleaned = trimmed.replace(/%/g, '').trim();

  const parsed = parseFloat(cleaned);
  if (isNaN(parsed)) return null;

  return parsed;
}

// ============================================================
// PARSED VALUE VALIDATORS
// ============================================================

type MetricType = 'percent' | 'count' | 'rating' | 'currency' | 'days';

/**
 * Validate a single parsed metric value against expected range.
 * Use this AFTER parsing but BEFORE building the full snapshot object.
 */
export function validateParsedMetric(
  value: number | null,
  type: MetricType,
): boolean {
  if (value === null) return true; // Null is always valid (missing data)

  switch (type) {
    case 'percent':
      return value >= 0 && value <= 100;
    case 'count':
      return value >= 0 && Number.isFinite(value);
    case 'rating':
      return value >= 0 && value <= 5;
    case 'currency':
      return value >= 0 && Number.isFinite(value);
    case 'days':
      return value >= 0 && Number.isFinite(value);
    default:
      return false;
  }
}

// ============================================================
// OPPORTUNITY VALIDATION
// ============================================================

const OPPORTUNITY_CATEGORIES = ['appealing', 'flexible_booking', 'pricing'] as const;

const opportunitySchema = z.object({
  airbnb_account_id: z.number().int().positive(),
  snapshot_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  opportunity_name: z.string().min(1),
  category: z.enum(OPPORTUNITY_CATEGORIES),
  completion_pct: z.number().min(0).max(100),
  is_completed: z.boolean(),
});

export function validateOpportunity(data: unknown) {
  return opportunitySchema.safeParse(data);
}

// ============================================================
// ISSUE VALIDATION
// ============================================================

const ISSUE_STATUSES = ['needs_attention', 'deleted'] as const;

const issueSchema = z.object({
  airbnb_listing_id: z.string().min(1),
  issue_description: z.string().min(1),
  issue_status: z.enum(ISSUE_STATUSES),
});

export function validateIssue(data: unknown) {
  return issueSchema.safeParse(data);
}
