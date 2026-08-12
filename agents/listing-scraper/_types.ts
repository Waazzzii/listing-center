/**
 * Shared contract for every listing scraper module.
 * See docs/superpowers/specs/2026-04-15-listing-visibility-diagnostic-layer.md.
 */

export type OTA = 'airbnb' | 'vrbo' | 'booking';
export type ScrapeSource = 'public' | 'extranet';

const OTAS: readonly OTA[] = ['airbnb', 'vrbo', 'booking'];
const SCRAPE_SOURCES: readonly ScrapeSource[] = ['public', 'extranet'];

export function isOTA(value: unknown): value is OTA {
  return typeof value === 'string' && (OTAS as readonly string[]).includes(value);
}

export function isScrapeSource(value: unknown): value is ScrapeSource {
  return typeof value === 'string' && (SCRAPE_SOURCES as readonly string[]).includes(value);
}

export interface ScrapeJob {
  unitId: string;
  ota: OTA;
  source: ScrapeSource;
  publicUrl?: string;
  extranetListingId?: string;
}

export interface ContentSnapshot {
  unitId: string;
  ota: OTA;
  source: ScrapeSource;
  scrapedAt: Date;
  title: string | null;
  description: string | null;
  photoCount: number | null;
  primaryPhotoUrl: string | null;
  priceShown: number | null;
  rating: number | null;
  reviewCount: number | null;
  badges: string[];
  cancellationPolicyDisplay: string | null;
  instantBookEnabled: boolean | null;
  amenityCount: number | null;
  amenityHighlights: Record<string, unknown> | null;
  rawHtmlRef: string | null;
}

export interface ScrapeResult {
  job: ScrapeJob;
  ok: boolean;
  snapshot?: ContentSnapshot;
  error?: {
    code: 'http_error' | 'parse_error' | 'timeout' | 'blocked' | 'unknown';
    message: string;
    screenshotRef?: string;
    htmlRef?: string;
  };
  durationMs: number;
}

export const RATE_LIMITS: Record<OTA, { maxConcurrent: number; minDelayMs: number }> = {
  airbnb: { maxConcurrent: 2, minDelayMs: 1500 },
  vrbo: { maxConcurrent: 2, minDelayMs: 1500 },
  booking: { maxConcurrent: 2, minDelayMs: 2000 },
};
