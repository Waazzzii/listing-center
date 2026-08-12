/**
 * Airbnb public listing scraper.
 *
 * Two-layer: a pure parsing function (parseAirbnbPublicHtml) for fast unit tests,
 * and a Playwright fetcher (scrapeAirbnbPublic) for end-to-end runs.
 */

import type { ContentSnapshot, ScrapeJob, ScrapeResult } from './_types';

export interface ParsedAirbnbPublic {
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
}

function extractMeta(html: string, property: string): string | null {
  // Two-pass: find the meta tag by property, then extract content. Robust to
  // attribute ordering (<meta property="..." content="..."> vs. reversed),
  // extra whitespace, and unrelated attributes between them. HTML spec does
  // not mandate attribute order, and minifiers / CDNs can reorder.
  const tagRegex = new RegExp(
    `<meta\\s+[^>]*property=["']${property}["'][^>]*>`,
    'i'
  );
  const tag = html.match(tagRegex)?.[0];
  if (!tag) return null;
  const contentMatch = tag.match(/content=["']([^"']+)["']/i);
  return contentMatch ? decodeHtml(contentMatch[1]) : null;
}

function decodeHtml(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function extractDeferredState(html: string): unknown | null {
  const m = html.match(
    /<script[^>]+id=["']data-deferred-state[^"']*["'][^>]*>([\s\S]*?)<\/script>/i
  );
  if (!m) return null;
  try {
    return JSON.parse(m[1]);
  } catch {
    return null;
  }
}

// Airbnb's deferred state nests matching fields 10–14 levels deep
// (niobeMinimalClientData → [listingId, payload] → data → presentation →
//  stayProductDetailPage → sections → sections[] → section → ...fields).
// Cap at 20 to handle realistic nesting with headroom while still bounding
// recursion against pathological or adversarial input.
const MAX_SEARCH_DEPTH = 20;

function deepFindKey(obj: unknown, key: string, depth = 0): unknown {
  if (depth > MAX_SEARCH_DEPTH || obj == null) return null;
  if (typeof obj !== 'object') return null;
  if (Array.isArray(obj)) {
    for (const item of obj) {
      const found = deepFindKey(item, key, depth + 1);
      if (found != null) return found;
    }
    return null;
  }
  const rec = obj as Record<string, unknown>;
  if (key in rec && rec[key] != null) return rec[key];
  for (const v of Object.values(rec)) {
    const found = deepFindKey(v, key, depth + 1);
    if (found != null) return found;
  }
  return null;
}

function asNumber(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string') {
    const cleaned = v.replace(/[^0-9.-]/g, '');
    const n = parseFloat(cleaned);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function asInt(v: unknown): number | null {
  const n = asNumber(v);
  return n == null ? null : Math.round(n);
}

function asBool(v: unknown): boolean | null {
  if (typeof v === 'boolean') return v;
  return null;
}

function asString(v: unknown): string | null {
  return typeof v === 'string' ? v : null;
}

export function parseAirbnbPublicHtml(html: string): ParsedAirbnbPublic {
  const title = extractMeta(html, 'og:title');
  const description = extractMeta(html, 'og:description');
  const primaryPhotoUrl = extractMeta(html, 'og:image');

  const deferred = extractDeferredState(html);

  const rating = asNumber(deepFindKey(deferred, 'starRating'));
  const reviewCount = asInt(deepFindKey(deferred, 'visibleReviewCount')) ??
    asInt(deepFindKey(deferred, 'reviewCount'));
  const photoCount = asInt(deepFindKey(deferred, 'photoCount'));
  const priceShown =
    asNumber(deepFindKey(deferred, 'priceItemForDisplay')) ??
    asNumber(deepFindKey(deferred, 'amount'));
  const instantBookEnabled = asBool(deepFindKey(deferred, 'isInstantBookEnabled'));

  const badgesRaw = deepFindKey(deferred, 'badges');
  const badges: string[] = Array.isArray(badgesRaw)
    ? badgesRaw
        .map((b) => {
          if (typeof b === 'string') return b;
          if (b && typeof b === 'object') {
            const label = (b as Record<string, unknown>).label;
            return typeof label === 'string' ? label : null;
          }
          return null;
        })
        .filter((v): v is string => typeof v === 'string')
    : [];

  // Narrow to string via helper — deepFindKey returns unknown, and this key
  // can also appear as a nested object (cancellationPolicyForDisplay), which
  // we deliberately ignore here.
  const cancellationPolicyDisplay = asString(
    deepFindKey(deferred, 'cancellationPolicy')
  );

  const amenitiesRaw = deepFindKey(deferred, 'amenities');
  const amenityCount = Array.isArray(amenitiesRaw) ? amenitiesRaw.length : null;
  const amenityHighlights =
    amenitiesRaw && typeof amenitiesRaw === 'object'
      ? (amenitiesRaw as Record<string, unknown>)
      : null;

  return {
    title: title ?? null,
    description: description ?? null,
    photoCount,
    primaryPhotoUrl: primaryPhotoUrl ?? null,
    priceShown,
    rating,
    reviewCount,
    badges,
    cancellationPolicyDisplay,
    instantBookEnabled,
    amenityCount,
    amenityHighlights,
  };
}

export async function scrapeAirbnbPublic(job: ScrapeJob): Promise<ScrapeResult> {
  const { chromium } = await import('playwright');
  const started = Date.now();

  if (!job.publicUrl) {
    return {
      job,
      ok: false,
      error: { code: 'parse_error', message: 'job.publicUrl is missing' },
      durationMs: 0,
    };
  }

  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({
      userAgent:
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 13_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      viewport: { width: 1280, height: 800 },
    });
    const page = await context.newPage();
    const resp = await page.goto(job.publicUrl, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    if (!resp || !resp.ok()) {
      return {
        job,
        ok: false,
        error: {
          code: 'http_error',
          message: `HTTP ${resp?.status() ?? 'unknown'}`,
        },
        durationMs: Date.now() - started,
      };
    }

    const html = await page.content();
    const parsed = parseAirbnbPublicHtml(html);

    const snapshot: ContentSnapshot = {
      unitId: job.unitId,
      ota: 'airbnb',
      source: 'public',
      scrapedAt: new Date(),
      title: parsed.title,
      description: parsed.description,
      photoCount: parsed.photoCount,
      primaryPhotoUrl: parsed.primaryPhotoUrl,
      priceShown: parsed.priceShown,
      rating: parsed.rating,
      reviewCount: parsed.reviewCount,
      badges: parsed.badges,
      cancellationPolicyDisplay: parsed.cancellationPolicyDisplay,
      instantBookEnabled: parsed.instantBookEnabled,
      amenityCount: parsed.amenityCount,
      amenityHighlights: parsed.amenityHighlights,
      rawHtmlRef: null,
    };

    return { job, ok: true, snapshot, durationMs: Date.now() - started };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const code: 'timeout' | 'unknown' =
      msg.toLowerCase().includes('timeout') ? 'timeout' : 'unknown';
    return {
      job,
      ok: false,
      error: { code, message: msg },
      durationMs: Date.now() - started,
    };
  } finally {
    await browser.close();
  }
}
