# Phase D-1 Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the data layer for the Listing Visibility & Performance Diagnostic Layer — 4 new Supabase tables, a seed script that populates listing presence from Streamline distribution data, a shared scraper runner skeleton, and the first public (anonymous) Airbnb scraper end-to-end into `lc_listing_content_snapshot`.

**Architecture:** Four new tables (`lc_listing_presence`, `lc_listing_content_snapshot`, `lc_listing_performance`, `lc_listing_health_score`) track per-unit-per-OTA state across 3 sources (Streamline, public scrape, extranet scrape). A shared runner module (`agents/listing-scraper/_runner.ts`) orchestrates scrape jobs with rate limits, retries, and failure capture. First implementation target is `airbnb-public.ts` — an anonymous Playwright scraper that reads the public Airbnb listing URL and writes a content snapshot. Seed script backfills `lc_listing_presence` rows from existing `lc_properties.airbnb_listing_id` / `vrbo_listing_id` columns so downstream scrapers have targets.

**Tech Stack:** Next.js 14 App Router, TypeScript, Supabase (Postgres + RLS), Playwright, Vitest, Zod, tsx for script running. Uses existing `@/lib/supabase` helper and Slack notifier patterns from `agents/data-collection/`.

**Reference Spec:** `docs/superpowers/specs/2026-04-15-listing-visibility-diagnostic-layer.md`

---

## File Structure

### New files

```
supabase/migrations/
  20260415000001_listing_diagnostic_tables.sql    # 4 tables, indexes, RLS

scripts/
  seed-listing-presence.ts                         # Backfill lc_listing_presence from lc_properties

agents/listing-scraper/
  README.md                                        # Brief module docs
  _types.ts                                        # ScrapeJob, ScrapeResult, OTA, ScrapeSource types
  _runner.ts                                       # runScrape(), queue + retries + failure capture
  _storage.ts                                      # upsertContentSnapshot(), updatePresence() DB writers
  airbnb-public.ts                                 # Anonymous Airbnb public listing scraper
  run-public-scrape.ts                             # Entry point for weekly public scrape cron

__tests__/agents/listing-scraper/
  types.test.ts                                    # Type-guard tests for _types.ts helpers
  runner.test.ts                                   # Runner retry + rate-limit unit tests
  airbnb-public.test.ts                            # Scraper HTML parsing unit tests (with fixtures)

__tests__/fixtures/listing-scraper/
  airbnb-listing-sample.html                       # Real Airbnb listing HTML snapshot (sanitized)
```

### Modified files

```
package.json                                       # Add agent:public-scrape script
src/lib/types.ts                                   # Export OTA + ScrapeSource enums if needed UI-side
```

### Why this split

- `_types.ts` and `_runner.ts` stay small and are the shared contract every future scraper (`vrbo-public.ts`, `airbnb-extranet.ts`, etc.) implements.
- `_storage.ts` isolates all DB writes so scrapers stay pure-ish and unit-testable without mocking Supabase inside each scraper.
- `airbnb-public.ts` owns only the "how to parse an Airbnb page" logic — scheduling/retries/DB I/O are delegated to the runner and storage modules.
- Tests mirror the module structure so a failing test points at one file.

---

## Task 1: Write and apply the migration for 4 diagnostic tables

**Files:**
- Create: `supabase/migrations/20260415000001_listing_diagnostic_tables.sql`

- [ ] **Step 1: Write the migration SQL**

Create `supabase/migrations/20260415000001_listing_diagnostic_tables.sql`:

```sql
-- 20260415000001_listing_diagnostic_tables.sql
-- Phase D-1: Listing Visibility & Performance Diagnostic Layer

-- ============================================================
-- lc_listing_presence
-- One row per unit × OTA. Answers: "is this live where it should be?"
-- ============================================================
CREATE TABLE lc_listing_presence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id UUID NOT NULL REFERENCES lc_properties(id) ON DELETE CASCADE,
  ota TEXT NOT NULL CHECK (ota IN ('airbnb', 'vrbo', 'booking')),
  streamline_distributed BOOLEAN NOT NULL DEFAULT false,
  publicly_found BOOLEAN,
  extranet_active BOOLEAN,
  public_url TEXT,
  extranet_listing_id TEXT,
  last_public_check_at TIMESTAMPTZ,
  last_extranet_check_at TIMESTAMPTZ,
  mismatch_flags TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (unit_id, ota)
);

CREATE INDEX idx_lc_listing_presence_unit ON lc_listing_presence(unit_id);
CREATE INDEX idx_lc_listing_presence_ota ON lc_listing_presence(ota);
CREATE INDEX idx_lc_listing_presence_mismatch
  ON lc_listing_presence USING GIN(mismatch_flags)
  WHERE array_length(mismatch_flags, 1) > 0;

-- ============================================================
-- lc_listing_content_snapshot
-- Time-series: what guests see on each OTA.
-- ============================================================
CREATE TABLE lc_listing_content_snapshot (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id UUID NOT NULL REFERENCES lc_properties(id) ON DELETE CASCADE,
  ota TEXT NOT NULL CHECK (ota IN ('airbnb', 'vrbo', 'booking')),
  source TEXT NOT NULL CHECK (source IN ('public', 'extranet')),
  scraped_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  title TEXT,
  description TEXT,
  photo_count INT,
  primary_photo_url TEXT,
  price_shown NUMERIC(10, 2),
  rating NUMERIC(3, 2),
  review_count INT,
  badges TEXT[] NOT NULL DEFAULT '{}',
  cancellation_policy_display TEXT,
  instant_book_enabled BOOLEAN,
  amenity_count INT,
  amenity_highlights JSONB,
  raw_html_ref TEXT
);

CREATE INDEX idx_lc_content_snapshot_unit_ota_time
  ON lc_listing_content_snapshot(unit_id, ota, scraped_at DESC);
CREATE INDEX idx_lc_content_snapshot_source
  ON lc_listing_content_snapshot(source, scraped_at DESC);

-- ============================================================
-- lc_listing_performance
-- One row per unit × OTA × day — traffic + conversion from extranet.
-- ============================================================
CREATE TABLE lc_listing_performance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id UUID NOT NULL REFERENCES lc_properties(id) ON DELETE CASCADE,
  ota TEXT NOT NULL CHECK (ota IN ('airbnb', 'vrbo', 'booking')),
  date DATE NOT NULL,
  impressions INT,
  clicks INT,
  ctr NUMERIC(6, 4),
  conversions INT,
  cvr NUMERIC(6, 4),
  revenue NUMERIC(10, 2),
  search_rank_median INT,
  saves INT,
  quote_requests INT,
  scraped_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (unit_id, ota, date)
);

CREATE INDEX idx_lc_performance_unit_date
  ON lc_listing_performance(unit_id, date DESC);
CREATE INDEX idx_lc_performance_ota_date
  ON lc_listing_performance(ota, date DESC);

-- ============================================================
-- lc_listing_health_score
-- One row per unit × period — composite + component scores.
-- ============================================================
CREATE TABLE lc_listing_health_score (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id UUID NOT NULL REFERENCES lc_properties(id) ON DELETE CASCADE,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  composite_score INT NOT NULL CHECK (composite_score BETWEEN 0 AND 100),
  presence_score INT NOT NULL CHECK (presence_score BETWEEN 0 AND 100),
  content_score INT NOT NULL CHECK (content_score BETWEEN 0 AND 100),
  traffic_score INT NOT NULL CHECK (traffic_score BETWEEN 0 AND 100),
  conversion_score INT NOT NULL CHECK (conversion_score BETWEEN 0 AND 100),
  bucket TEXT NOT NULL CHECK (bucket IN ('red', 'yellow', 'green')),
  trend_vs_prior INT,
  calculated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (unit_id, period_end)
);

CREATE INDEX idx_lc_health_unit_period
  ON lc_listing_health_score(unit_id, period_end DESC);
CREATE INDEX idx_lc_health_bucket
  ON lc_listing_health_score(bucket, period_end DESC);

-- ============================================================
-- updated_at trigger for presence
-- ============================================================
CREATE OR REPLACE FUNCTION lc_listing_presence_touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_lc_listing_presence_touch
  BEFORE UPDATE ON lc_listing_presence
  FOR EACH ROW
  EXECUTE FUNCTION lc_listing_presence_touch_updated_at();

-- ============================================================
-- RLS — match existing lc_properties posture (service role only)
-- ============================================================
ALTER TABLE lc_listing_presence ENABLE ROW LEVEL SECURITY;
ALTER TABLE lc_listing_content_snapshot ENABLE ROW LEVEL SECURITY;
ALTER TABLE lc_listing_performance ENABLE ROW LEVEL SECURITY;
ALTER TABLE lc_listing_health_score ENABLE ROW LEVEL SECURITY;
```

- [ ] **Step 2: Apply the migration via Supabase Management API**

Run the SQL in the Supabase SQL Editor for the `listing-center` project. Open the Chrome MCP session (or use `supabase db push` if CLI is wired up) and execute the file contents in one shot. If you have `supabase/config.toml` pointed at the right project:

Run: `supabase db push`

Expected: `Applying migration 20260415000001_listing_diagnostic_tables.sql...` then `Finished`.

If using the SQL Editor browser path, paste the file contents and click Run. Expected: four `CREATE TABLE` success messages.

- [ ] **Step 3: Verify tables exist with schema check**

Run this verification query in the SQL Editor:

```sql
SELECT table_name, column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name LIKE 'lc_listing_%'
ORDER BY table_name, ordinal_position;
```

Expected: 40+ rows spanning `lc_listing_presence`, `lc_listing_content_snapshot`, `lc_listing_performance`, `lc_listing_health_score`.

- [ ] **Step 4: Commit the migration**

```bash
cd "/Users/jasonpratts/D2C Internal/Code/listing-center"
git add supabase/migrations/20260415000001_listing_diagnostic_tables.sql
git commit -m "feat(db): add 4 listing diagnostic tables (presence, content snapshot, performance, health score)"
```

---

## Task 2: Shared scraper types module

**Files:**
- Create: `agents/listing-scraper/_types.ts`
- Create: `__tests__/agents/listing-scraper/types.test.ts`

- [ ] **Step 1: Write the failing test**

Create `__tests__/agents/listing-scraper/types.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { isOTA, isScrapeSource, RATE_LIMITS } from '../../../agents/listing-scraper/_types';

describe('isOTA', () => {
  it('accepts known OTAs', () => {
    expect(isOTA('airbnb')).toBe(true);
    expect(isOTA('vrbo')).toBe(true);
    expect(isOTA('booking')).toBe(true);
  });

  it('rejects unknown OTAs', () => {
    expect(isOTA('expedia')).toBe(false);
    expect(isOTA('')).toBe(false);
    expect(isOTA(null)).toBe(false);
    expect(isOTA(undefined)).toBe(false);
  });
});

describe('isScrapeSource', () => {
  it('accepts public and extranet', () => {
    expect(isScrapeSource('public')).toBe(true);
    expect(isScrapeSource('extranet')).toBe(true);
  });

  it('rejects other values', () => {
    expect(isScrapeSource('api')).toBe(false);
    expect(isScrapeSource(null)).toBe(false);
  });
});

describe('RATE_LIMITS', () => {
  it('has per-OTA concurrency + delay caps', () => {
    expect(RATE_LIMITS.airbnb.maxConcurrent).toBe(2);
    expect(RATE_LIMITS.airbnb.minDelayMs).toBeGreaterThanOrEqual(1500);
    expect(RATE_LIMITS.vrbo.maxConcurrent).toBe(2);
    expect(RATE_LIMITS.booking.maxConcurrent).toBe(2);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run __tests__/agents/listing-scraper/types.test.ts`

Expected: FAIL with `Cannot find module '../../../agents/listing-scraper/_types'`.

- [ ] **Step 3: Write the types module**

Create `agents/listing-scraper/_types.ts`:

```typescript
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run __tests__/agents/listing-scraper/types.test.ts`

Expected: PASS (3 suites, 7+ tests).

- [ ] **Step 5: Commit**

```bash
git add agents/listing-scraper/_types.ts __tests__/agents/listing-scraper/types.test.ts
git commit -m "feat(listing-scraper): add shared types and rate-limit constants"
```

---

## Task 3: Storage module — DB writers

**Files:**
- Create: `agents/listing-scraper/_storage.ts`
- Create: `__tests__/agents/listing-scraper/storage.test.ts`

- [ ] **Step 1: Write the failing test**

Create `__tests__/agents/listing-scraper/storage.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { buildContentSnapshotRow, buildPresenceUpdate } from '../../../agents/listing-scraper/_storage';
import type { ContentSnapshot } from '../../../agents/listing-scraper/_types';

describe('buildContentSnapshotRow', () => {
  it('maps camelCase ContentSnapshot to snake_case DB row', () => {
    const snap: ContentSnapshot = {
      unitId: '11111111-1111-1111-1111-111111111111',
      ota: 'airbnb',
      source: 'public',
      scrapedAt: new Date('2026-04-15T10:00:00Z'),
      title: 'Sunny Desert Retreat',
      description: 'Lovely pool home.',
      photoCount: 24,
      primaryPhotoUrl: 'https://x/img.jpg',
      priceShown: 289.5,
      rating: 4.92,
      reviewCount: 118,
      badges: ['superhost', 'guest_favorite'],
      cancellationPolicyDisplay: 'Moderate',
      instantBookEnabled: true,
      amenityCount: 32,
      amenityHighlights: { pool: true, wifi: true },
      rawHtmlRef: 's3://bucket/ref',
    };

    const row = buildContentSnapshotRow(snap);

    expect(row.unit_id).toBe(snap.unitId);
    expect(row.ota).toBe('airbnb');
    expect(row.source).toBe('public');
    expect(row.scraped_at).toBe(snap.scrapedAt.toISOString());
    expect(row.title).toBe('Sunny Desert Retreat');
    expect(row.photo_count).toBe(24);
    expect(row.primary_photo_url).toBe('https://x/img.jpg');
    expect(row.price_shown).toBe(289.5);
    expect(row.badges).toEqual(['superhost', 'guest_favorite']);
    expect(row.cancellation_policy_display).toBe('Moderate');
    expect(row.instant_book_enabled).toBe(true);
    expect(row.amenity_highlights).toEqual({ pool: true, wifi: true });
    expect(row.raw_html_ref).toBe('s3://bucket/ref');
  });

  it('handles null-like fields', () => {
    const row = buildContentSnapshotRow({
      unitId: 'u',
      ota: 'airbnb',
      source: 'public',
      scrapedAt: new Date('2026-04-15T00:00:00Z'),
      title: null,
      description: null,
      photoCount: null,
      primaryPhotoUrl: null,
      priceShown: null,
      rating: null,
      reviewCount: null,
      badges: [],
      cancellationPolicyDisplay: null,
      instantBookEnabled: null,
      amenityCount: null,
      amenityHighlights: null,
      rawHtmlRef: null,
    });

    expect(row.title).toBeNull();
    expect(row.photo_count).toBeNull();
    expect(row.badges).toEqual([]);
  });
});

describe('buildPresenceUpdate', () => {
  it('sets publicly_found + last_public_check_at when source=public', () => {
    const update = buildPresenceUpdate({
      source: 'public',
      found: true,
      checkedAt: new Date('2026-04-15T10:00:00Z'),
    });
    expect(update.publicly_found).toBe(true);
    expect(update.last_public_check_at).toBe('2026-04-15T10:00:00.000Z');
    expect(update).not.toHaveProperty('extranet_active');
  });

  it('sets extranet_active + last_extranet_check_at when source=extranet', () => {
    const update = buildPresenceUpdate({
      source: 'extranet',
      found: false,
      checkedAt: new Date('2026-04-15T10:00:00Z'),
    });
    expect(update.extranet_active).toBe(false);
    expect(update.last_extranet_check_at).toBe('2026-04-15T10:00:00.000Z');
    expect(update).not.toHaveProperty('publicly_found');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run __tests__/agents/listing-scraper/storage.test.ts`

Expected: FAIL with `Cannot find module '../../../agents/listing-scraper/_storage'`.

- [ ] **Step 3: Write the storage module**

Create `agents/listing-scraper/_storage.ts`:

```typescript
import { getSupabase } from '@/lib/supabase';
import type { ContentSnapshot, ScrapeSource } from './_types';

export interface ContentSnapshotRow {
  unit_id: string;
  ota: string;
  source: string;
  scraped_at: string;
  title: string | null;
  description: string | null;
  photo_count: number | null;
  primary_photo_url: string | null;
  price_shown: number | null;
  rating: number | null;
  review_count: number | null;
  badges: string[];
  cancellation_policy_display: string | null;
  instant_book_enabled: boolean | null;
  amenity_count: number | null;
  amenity_highlights: Record<string, unknown> | null;
  raw_html_ref: string | null;
}

export function buildContentSnapshotRow(snap: ContentSnapshot): ContentSnapshotRow {
  return {
    unit_id: snap.unitId,
    ota: snap.ota,
    source: snap.source,
    scraped_at: snap.scrapedAt.toISOString(),
    title: snap.title,
    description: snap.description,
    photo_count: snap.photoCount,
    primary_photo_url: snap.primaryPhotoUrl,
    price_shown: snap.priceShown,
    rating: snap.rating,
    review_count: snap.reviewCount,
    badges: snap.badges,
    cancellation_policy_display: snap.cancellationPolicyDisplay,
    instant_book_enabled: snap.instantBookEnabled,
    amenity_count: snap.amenityCount,
    amenity_highlights: snap.amenityHighlights,
    raw_html_ref: snap.rawHtmlRef,
  };
}

export interface PresenceUpdate {
  publicly_found?: boolean;
  extranet_active?: boolean;
  last_public_check_at?: string;
  last_extranet_check_at?: string;
}

export function buildPresenceUpdate(args: {
  source: ScrapeSource;
  found: boolean;
  checkedAt: Date;
}): PresenceUpdate {
  const iso = args.checkedAt.toISOString();
  if (args.source === 'public') {
    return { publicly_found: args.found, last_public_check_at: iso };
  }
  return { extranet_active: args.found, last_extranet_check_at: iso };
}

export async function insertContentSnapshot(snap: ContentSnapshot): Promise<void> {
  const supabase = getSupabase();
  const row = buildContentSnapshotRow(snap);
  const { error } = await supabase.from('lc_listing_content_snapshot').insert(row);
  if (error) throw new Error(`insertContentSnapshot failed: ${error.message}`);
}

export async function updatePresence(args: {
  unitId: string;
  ota: string;
  source: ScrapeSource;
  found: boolean;
  checkedAt: Date;
}): Promise<void> {
  const supabase = getSupabase();
  const update = buildPresenceUpdate({
    source: args.source,
    found: args.found,
    checkedAt: args.checkedAt,
  });
  const { error } = await supabase
    .from('lc_listing_presence')
    .update(update)
    .eq('unit_id', args.unitId)
    .eq('ota', args.ota);
  if (error) throw new Error(`updatePresence failed: ${error.message}`);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run __tests__/agents/listing-scraper/storage.test.ts`

Expected: PASS (2 suites, 4 tests).

- [ ] **Step 5: Commit**

```bash
git add agents/listing-scraper/_storage.ts __tests__/agents/listing-scraper/storage.test.ts
git commit -m "feat(listing-scraper): add storage module with DB write helpers"
```

---

## Task 4: Scraper runner — queue + retries + rate limit

**Files:**
- Create: `agents/listing-scraper/_runner.ts`
- Create: `__tests__/agents/listing-scraper/runner.test.ts`

- [ ] **Step 1: Write the failing test**

Create `__tests__/agents/listing-scraper/runner.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { runScrapeJobs } from '../../../agents/listing-scraper/_runner';
import type { ScrapeJob, ScrapeResult } from '../../../agents/listing-scraper/_types';

function job(i: number): ScrapeJob {
  return { unitId: `u${i}`, ota: 'airbnb', source: 'public', publicUrl: `https://x/${i}` };
}

describe('runScrapeJobs', () => {
  it('runs all jobs and returns a result for each', async () => {
    const scrape = vi.fn(
      async (j: ScrapeJob): Promise<ScrapeResult> => ({ job: j, ok: true, durationMs: 10 })
    );

    const results = await runScrapeJobs([job(1), job(2), job(3)], {
      scrape,
      maxConcurrent: 1,
      minDelayMs: 0,
    });

    expect(results).toHaveLength(3);
    expect(scrape).toHaveBeenCalledTimes(3);
    expect(results.every((r) => r.ok)).toBe(true);
  });

  it('retries up to 3 times on transient failure', async () => {
    let calls = 0;
    const scrape = async (j: ScrapeJob): Promise<ScrapeResult> => {
      calls++;
      if (calls < 3) {
        return { job: j, ok: false, error: { code: 'timeout', message: 't' }, durationMs: 5 };
      }
      return { job: j, ok: true, durationMs: 5 };
    };

    const results = await runScrapeJobs([job(1)], {
      scrape,
      maxConcurrent: 1,
      minDelayMs: 0,
      maxRetries: 3,
    });

    expect(calls).toBe(3);
    expect(results[0].ok).toBe(true);
  });

  it('stops retrying on blocked error', async () => {
    let calls = 0;
    const scrape = async (j: ScrapeJob): Promise<ScrapeResult> => {
      calls++;
      return { job: j, ok: false, error: { code: 'blocked', message: 'captcha' }, durationMs: 5 };
    };

    const results = await runScrapeJobs([job(1)], {
      scrape,
      maxConcurrent: 1,
      minDelayMs: 0,
      maxRetries: 3,
    });

    expect(calls).toBe(1);
    expect(results[0].ok).toBe(false);
    expect(results[0].error?.code).toBe('blocked');
  });

  it('respects maxConcurrent', async () => {
    let active = 0;
    let maxActive = 0;
    const scrape = async (j: ScrapeJob): Promise<ScrapeResult> => {
      active++;
      maxActive = Math.max(maxActive, active);
      await new Promise((r) => setTimeout(r, 10));
      active--;
      return { job: j, ok: true, durationMs: 10 };
    };

    await runScrapeJobs([job(1), job(2), job(3), job(4), job(5)], {
      scrape,
      maxConcurrent: 2,
      minDelayMs: 0,
    });

    expect(maxActive).toBeLessThanOrEqual(2);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run __tests__/agents/listing-scraper/runner.test.ts`

Expected: FAIL with `Cannot find module '../../../agents/listing-scraper/_runner'`.

- [ ] **Step 3: Write the runner**

Create `agents/listing-scraper/_runner.ts`:

```typescript
import type { ScrapeJob, ScrapeResult } from './_types';

export interface RunOptions {
  scrape: (job: ScrapeJob) => Promise<ScrapeResult>;
  maxConcurrent: number;
  minDelayMs: number;
  maxRetries?: number;
}

const NON_RETRYABLE = new Set(['blocked', 'parse_error']);

async function sleep(ms: number): Promise<void> {
  if (ms > 0) await new Promise((r) => setTimeout(r, ms));
}

async function runWithRetries(
  job: ScrapeJob,
  scrape: RunOptions['scrape'],
  maxRetries: number
): Promise<ScrapeResult> {
  let last: ScrapeResult | null = null;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const res = await scrape(job);
    last = res;
    if (res.ok) return res;
    if (res.error && NON_RETRYABLE.has(res.error.code)) return res;
    const backoff = Math.min(2 ** (attempt - 1) * 500, 8000);
    await sleep(backoff);
  }
  return last as ScrapeResult;
}

export async function runScrapeJobs(
  jobs: ScrapeJob[],
  opts: RunOptions
): Promise<ScrapeResult[]> {
  const maxRetries = opts.maxRetries ?? 3;
  const results: ScrapeResult[] = [];
  const queue = [...jobs];
  const inFlight = new Set<Promise<void>>();

  const launch = (job: ScrapeJob): Promise<void> => {
    const p = (async () => {
      const res = await runWithRetries(job, opts.scrape, maxRetries);
      results.push(res);
      await sleep(opts.minDelayMs);
    })();
    inFlight.add(p);
    p.finally(() => inFlight.delete(p));
    return p;
  };

  while (queue.length > 0 || inFlight.size > 0) {
    while (queue.length > 0 && inFlight.size < opts.maxConcurrent) {
      const j = queue.shift();
      if (j) launch(j);
    }
    if (inFlight.size > 0) {
      await Promise.race(inFlight);
    }
  }

  return results;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run __tests__/agents/listing-scraper/runner.test.ts`

Expected: PASS (1 suite, 4 tests).

- [ ] **Step 5: Commit**

```bash
git add agents/listing-scraper/_runner.ts __tests__/agents/listing-scraper/runner.test.ts
git commit -m "feat(listing-scraper): add runner with concurrency, retries, and rate limits"
```

---

## Task 5: Seed `lc_listing_presence` from existing property data

**Files:**
- Create: `scripts/seed-listing-presence.ts`
- Modify: `package.json` (add script)

- [ ] **Step 1: Add the npm script**

In `package.json`, add to the `"scripts"` object (alphabetical within existing agent/seed scripts):

```json
"seed:listing-presence": "tsx scripts/seed-listing-presence.ts",
```

- [ ] **Step 2: Write the seeder**

Create `scripts/seed-listing-presence.ts`:

```typescript
/**
 * Phase D-1 Seeder: Backfill lc_listing_presence from lc_properties.
 *
 * Creates one row per (active property, OTA) where OTA is determined by
 * presence of the corresponding listing id column on lc_properties:
 *   - airbnb_listing_id → ota=airbnb, streamline_distributed=true
 *   - vrbo_listing_id   → ota=vrbo,   streamline_distributed=true
 *   - booking_property_id → ota=booking, streamline_distributed=true
 *
 * Idempotent: uses upsert on (unit_id, ota). Safe to re-run.
 *
 * Usage:  npm run seed:listing-presence
 */

import 'dotenv/config';
import { getSupabase } from '@/lib/supabase';

const OTA_COLUMNS: Array<{ ota: 'airbnb' | 'vrbo' | 'booking'; column: string }> = [
  { ota: 'airbnb', column: 'airbnb_listing_id' },
  { ota: 'vrbo', column: 'vrbo_listing_id' },
  { ota: 'booking', column: 'booking_property_id' },
];

interface PropertyRow {
  id: string;
  airbnb_listing_id: string | null;
  vrbo_listing_id: string | null;
  booking_property_id: string | null;
}

function buildPublicUrl(ota: 'airbnb' | 'vrbo' | 'booking', listingId: string): string | null {
  if (!listingId) return null;
  if (ota === 'airbnb') return `https://www.airbnb.com/rooms/${listingId}`;
  if (ota === 'vrbo') return `https://www.vrbo.com/${listingId}`;
  if (ota === 'booking') return `https://www.booking.com/hotel/${listingId}.html`;
  return null;
}

async function main(): Promise<void> {
  const supabase = getSupabase();

  console.log('Fetching active properties…');
  const { data: properties, error } = await supabase
    .from('lc_properties')
    .select('id, airbnb_listing_id, vrbo_listing_id, booking_property_id')
    .eq('is_active', true);

  if (error) throw new Error(`fetch lc_properties failed: ${error.message}`);
  const rows = (properties ?? []) as PropertyRow[];
  console.log(`Loaded ${rows.length} active properties`);

  const upserts: Array<{
    unit_id: string;
    ota: string;
    streamline_distributed: boolean;
    public_url: string | null;
  }> = [];

  for (const p of rows) {
    for (const { ota, column } of OTA_COLUMNS) {
      const listingId = (p as unknown as Record<string, string | null>)[column];
      if (listingId) {
        upserts.push({
          unit_id: p.id,
          ota,
          streamline_distributed: true,
          public_url: buildPublicUrl(ota, listingId),
        });
      }
    }
  }

  console.log(`Prepared ${upserts.length} presence rows. Upserting in batches of 500…`);

  const BATCH = 500;
  for (let i = 0; i < upserts.length; i += BATCH) {
    const batch = upserts.slice(i, i + BATCH);
    const { error: upErr } = await supabase
      .from('lc_listing_presence')
      .upsert(batch, { onConflict: 'unit_id,ota', ignoreDuplicates: false });
    if (upErr) throw new Error(`upsert batch ${i} failed: ${upErr.message}`);
    console.log(`  Upserted ${Math.min(i + BATCH, upserts.length)} / ${upserts.length}`);
  }

  console.log('Done.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

- [ ] **Step 3: Run the seeder**

Run: `npm run seed:listing-presence`

Expected output:
```
Fetching active properties…
Loaded 1051 active properties
Prepared 2100+ presence rows. Upserting in batches of 500…
  Upserted 500 / 2100
  Upserted 1000 / 2100
  Upserted 1500 / 2100
  Upserted 2000 / 2100
  Upserted 2100 / 2100
Done.
```
Exact row counts will vary by how many properties have each OTA id populated.

- [ ] **Step 4: Verify via SQL**

Run in SQL Editor:

```sql
SELECT ota, COUNT(*) AS rows, COUNT(*) FILTER (WHERE streamline_distributed) AS distributed
FROM lc_listing_presence
GROUP BY ota
ORDER BY ota;
```

Expected: three rows (airbnb, booking, vrbo) with `distributed` > 0.

- [ ] **Step 5: Commit**

```bash
git add scripts/seed-listing-presence.ts package.json
git commit -m "feat(seed): backfill lc_listing_presence from lc_properties OTA columns"
```

---

## Task 6: Fixture — sanitized Airbnb listing HTML

**Files:**
- Create: `__tests__/fixtures/listing-scraper/airbnb-listing-sample.html`

- [ ] **Step 1: Capture a real Airbnb listing for a known unit**

Use Chrome (or Playwright headless) to save the public HTML of one of our actual listings. Pick a unit that is live and well-populated. Sanitize: remove obvious PII (host name, guest reviews, exact address).

The fixture should contain at minimum the following elements (we're parsing from DOM attributes / embedded JSON, not just text):

- `<meta property="og:title" content="…">` — for title fallback
- `<meta property="og:description" content="…">` — for description fallback
- `<script id="data-deferred-state" type="application/json">…</script>` — embedded JSON payload containing price, rating, reviewCount, photoUrls, amenities, instantBook, cancellationPolicy, badges. Airbnb uses a nested structure; capture the real shape.

- [ ] **Step 2: Save the fixture**

Save at `__tests__/fixtures/listing-scraper/airbnb-listing-sample.html`. Target size < 500 KB — strip `<style>` and `<script>` blocks that aren't the data payload.

- [ ] **Step 3: Commit**

```bash
git add __tests__/fixtures/listing-scraper/airbnb-listing-sample.html
git commit -m "test(listing-scraper): add sanitized Airbnb public listing HTML fixture"
```

---

## Task 7: Airbnb public scraper — parsing function (pure, unit-tested)

**Files:**
- Create: `agents/listing-scraper/airbnb-public.ts`
- Create: `__tests__/agents/listing-scraper/airbnb-public.test.ts`

- [ ] **Step 1: Write the failing test**

Create `__tests__/agents/listing-scraper/airbnb-public.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { parseAirbnbPublicHtml } from '../../../agents/listing-scraper/airbnb-public';

const FIXTURE = readFileSync(
  join(__dirname, '..', '..', 'fixtures', 'listing-scraper', 'airbnb-listing-sample.html'),
  'utf-8'
);

describe('parseAirbnbPublicHtml', () => {
  it('extracts title from og:title meta', () => {
    const parsed = parseAirbnbPublicHtml(FIXTURE);
    expect(parsed.title).toBeTruthy();
    expect(typeof parsed.title).toBe('string');
    expect(parsed.title!.length).toBeGreaterThan(5);
  });

  it('extracts description', () => {
    const parsed = parseAirbnbPublicHtml(FIXTURE);
    expect(parsed.description).toBeTruthy();
    expect(parsed.description!.length).toBeGreaterThan(20);
  });

  it('extracts rating and review count', () => {
    const parsed = parseAirbnbPublicHtml(FIXTURE);
    if (parsed.rating !== null) {
      expect(parsed.rating).toBeGreaterThan(0);
      expect(parsed.rating).toBeLessThanOrEqual(5);
    }
    if (parsed.reviewCount !== null) {
      expect(parsed.reviewCount).toBeGreaterThanOrEqual(0);
    }
  });

  it('extracts primary photo URL', () => {
    const parsed = parseAirbnbPublicHtml(FIXTURE);
    if (parsed.primaryPhotoUrl) {
      expect(parsed.primaryPhotoUrl).toMatch(/^https?:\/\//);
    }
  });

  it('returns null fields (not undefined) when data is missing', () => {
    const parsed = parseAirbnbPublicHtml('<html><head></head><body></body></html>');
    expect(parsed.title).toBeNull();
    expect(parsed.description).toBeNull();
    expect(parsed.rating).toBeNull();
    expect(parsed.reviewCount).toBeNull();
    expect(parsed.photoCount).toBeNull();
    expect(parsed.priceShown).toBeNull();
    expect(parsed.badges).toEqual([]);
  });

  it('never throws on malformed HTML', () => {
    expect(() => parseAirbnbPublicHtml('<<<not html>>>')).not.toThrow();
    expect(() => parseAirbnbPublicHtml('')).not.toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run __tests__/agents/listing-scraper/airbnb-public.test.ts`

Expected: FAIL with `Cannot find module '../../../agents/listing-scraper/airbnb-public'`.

- [ ] **Step 3: Write the scraper module (parsing function only — no Playwright yet)**

Create `agents/listing-scraper/airbnb-public.ts`:

```typescript
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
  const regex = new RegExp(
    `<meta\\s+property=["']${property}["']\\s+content=["']([^"']+)["']`,
    'i'
  );
  const m = html.match(regex);
  return m ? decodeHtml(m[1]) : null;
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

function deepFindKey(obj: unknown, key: string, depth = 0): unknown {
  if (depth > 8 || obj == null) return null;
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

  const cancellationPolicyDisplay =
    (deepFindKey(deferred, 'cancellationPolicy') as string | null) ?? null;

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
    cancellationPolicyDisplay: typeof cancellationPolicyDisplay === 'string'
      ? cancellationPolicyDisplay
      : null,
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
    const code = msg.toLowerCase().includes('timeout') ? 'timeout' : 'unknown';
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run __tests__/agents/listing-scraper/airbnb-public.test.ts`

Expected: PASS (1 suite, 6 tests).

If some extracted fields come back `null` from the real fixture, that's fine — the test only asserts "if rating is present, it's in range" etc. The critical tests are: title present, description present, no throws on bad input, null-safe on empty HTML.

- [ ] **Step 5: Commit**

```bash
git add agents/listing-scraper/airbnb-public.ts __tests__/agents/listing-scraper/airbnb-public.test.ts
git commit -m "feat(listing-scraper): add Airbnb public scraper with pure parser + Playwright fetcher"
```

---

## Task 8: Entry-point script for weekly public scrape

**Files:**
- Create: `agents/listing-scraper/run-public-scrape.ts`
- Create: `agents/listing-scraper/README.md`
- Modify: `package.json` (add `agent:public-scrape` script)

- [ ] **Step 1: Add npm script**

In `package.json`, add to `"scripts"` (after existing `agent:*` entries):

```json
"agent:public-scrape": "tsx agents/listing-scraper/run-public-scrape.ts",
```

- [ ] **Step 2: Write the entry point**

Create `agents/listing-scraper/run-public-scrape.ts`:

```typescript
/**
 * Weekly Public Scrape — Entry Point
 *
 * Pulls every active (unit × OTA) from lc_listing_presence where
 *   streamline_distributed = true AND public_url IS NOT NULL
 * and runs the appropriate per-OTA public scraper against it.
 *
 * V1: only airbnb-public is implemented. VRBO + Booking added in later tasks.
 *
 * Usage:   npm run agent:public-scrape
 * Flags:   --limit=N   (debug: scrape at most N jobs)
 *          --unit=<id> (debug: scrape a single unit)
 */

import 'dotenv/config';
import { getSupabase } from '@/lib/supabase';
import { RATE_LIMITS, type ScrapeJob, type OTA } from './_types';
import { runScrapeJobs } from './_runner';
import { scrapeAirbnbPublic } from './airbnb-public';
import { insertContentSnapshot, updatePresence } from './_storage';

interface Args {
  limit?: number;
  unit?: string;
}

function parseArgs(): Args {
  const out: Args = {};
  for (const a of process.argv.slice(2)) {
    if (a.startsWith('--limit=')) out.limit = parseInt(a.split('=')[1], 10);
    if (a.startsWith('--unit=')) out.unit = a.split('=')[1];
  }
  return out;
}

async function loadJobs(args: Args): Promise<ScrapeJob[]> {
  const supabase = getSupabase();
  let q = supabase
    .from('lc_listing_presence')
    .select('unit_id, ota, public_url, extranet_listing_id')
    .eq('streamline_distributed', true)
    .not('public_url', 'is', null);

  if (args.unit) q = q.eq('unit_id', args.unit);
  if (args.limit) q = q.limit(args.limit);

  const { data, error } = await q;
  if (error) throw new Error(`loadJobs failed: ${error.message}`);

  return (data ?? []).map((row) => ({
    unitId: row.unit_id as string,
    ota: row.ota as OTA,
    source: 'public' as const,
    publicUrl: row.public_url as string,
    extranetListingId: row.extranet_listing_id as string | undefined,
  }));
}

function dispatchScraper(job: ScrapeJob) {
  if (job.ota === 'airbnb') return scrapeAirbnbPublic(job);
  // TODO Task B-2: VRBO / Booking public scrapers wired here
  return Promise.resolve({
    job,
    ok: false,
    error: {
      code: 'unknown' as const,
      message: `no public scraper for ota=${job.ota}`,
    },
    durationMs: 0,
  });
}

async function main(): Promise<void> {
  const args = parseArgs();
  const startedAt = new Date();

  const allJobs = await loadJobs(args);
  const jobs = allJobs.filter((j) => j.ota === 'airbnb');
  console.log(
    `Loaded ${allJobs.length} total presence rows (${jobs.length} airbnb in V1 scope)`
  );

  if (jobs.length === 0) {
    console.log('Nothing to scrape. Exiting.');
    return;
  }

  const limits = RATE_LIMITS.airbnb;
  const results = await runScrapeJobs(jobs, {
    scrape: dispatchScraper,
    maxConcurrent: limits.maxConcurrent,
    minDelayMs: limits.minDelayMs,
  });

  let ok = 0;
  let failed = 0;
  for (const r of results) {
    if (r.ok && r.snapshot) {
      try {
        await insertContentSnapshot(r.snapshot);
        await updatePresence({
          unitId: r.job.unitId,
          ota: r.job.ota,
          source: 'public',
          found: true,
          checkedAt: r.snapshot.scrapedAt,
        });
        ok++;
      } catch (err) {
        console.error(`DB write failed for unit=${r.job.unitId}:`, err);
        failed++;
      }
    } else {
      try {
        await updatePresence({
          unitId: r.job.unitId,
          ota: r.job.ota,
          source: 'public',
          found: false,
          checkedAt: new Date(),
        });
      } catch (err) {
        console.error(`presence update failed for unit=${r.job.unitId}:`, err);
      }
      failed++;
    }
  }

  const finishedAt = new Date();
  console.log(`\nDone. ok=${ok} failed=${failed} duration=${(finishedAt.getTime() - startedAt.getTime()) / 1000}s`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

- [ ] **Step 3: Write the README**

Create `agents/listing-scraper/README.md`:

```markdown
# Listing Scraper

Public and extranet scrapers for the Listing Visibility & Performance Diagnostic Layer
(Phase D — see `docs/superpowers/specs/2026-04-15-listing-visibility-diagnostic-layer.md`).

## Modules

- `_types.ts`         — Shared types (OTA, ScrapeJob, ScrapeResult) and rate limits.
- `_runner.ts`        — Job queue with concurrency, retries, rate-limit pacing.
- `_storage.ts`       — DB writers (insert content snapshot, update presence).
- `airbnb-public.ts`  — Anonymous Airbnb public listing scraper (V1).
- `run-public-scrape.ts` — Entry point for weekly public scrape run.

## Run

```bash
# Scrape all airbnb public URLs for active properties
npm run agent:public-scrape

# Debug: limit to 5 jobs
npm run agent:public-scrape -- --limit=5

# Debug: scrape a single unit
npm run agent:public-scrape -- --unit=<uuid>
```

## Roadmap

- D-2: `vrbo-public.ts`, weekly cron wiring, failure-screenshot capture
- D-3: `airbnb-extranet.ts` / `vrbo-extranet.ts` via Wazzi component
- D-4: health score + `/listings` UI

## Rate limits

Per `_types.ts RATE_LIMITS`:
- Airbnb: 2 concurrent, 1500ms min delay between job completions
- VRBO: same
- Booking: 2 concurrent, 2000ms
```

- [ ] **Step 4: Smoke test against 1 unit**

Pick an active unit with a known Airbnb listing id (check `lc_properties.airbnb_listing_id`). Run:

```bash
npm run agent:public-scrape -- --unit=<uuid> --limit=1
```

Expected output:
```
Loaded 1 total presence rows (1 airbnb in V1 scope)
Done. ok=1 failed=0 duration=<N>s
```

Then verify in SQL Editor:

```sql
SELECT unit_id, ota, title, rating, review_count, photo_count, scraped_at
FROM lc_listing_content_snapshot
ORDER BY scraped_at DESC
LIMIT 5;
```

Expected: at least one row with non-null `title` for the unit you scraped.

Also:

```sql
SELECT unit_id, ota, publicly_found, last_public_check_at, public_url
FROM lc_listing_presence
WHERE unit_id = '<uuid>';
```

Expected: `publicly_found = true`, `last_public_check_at` within the last minute.

- [ ] **Step 5: Commit**

```bash
git add agents/listing-scraper/run-public-scrape.ts agents/listing-scraper/README.md package.json
git commit -m "feat(listing-scraper): add entry point + README; smoke-tested against live unit"
```

---

## Task 9: Final verification and phase checkpoint

- [ ] **Step 1: Full test suite**

Run: `npm test -- __tests__/agents/listing-scraper`

Expected: all listing-scraper tests PASS. No regressions in existing suites.

- [ ] **Step 2: TypeScript check**

Run: `npx tsc --noEmit`

Expected: no new TypeScript errors. Pre-existing errors in unrelated files are acceptable but document them in the commit message if you see any.

- [ ] **Step 3: Checkpoint commit (tag Phase D-1 complete)**

```bash
git tag phase-d1-foundation
git push origin phase-d1-foundation   # optional — confirm with Jason before pushing tags
```

Then open the spec and verify each D-1 deliverable:
- [x] SQL migration for 4 new tables (Task 1)
- [x] Seed `lc_listing_presence` from Streamline distribution data (Task 5)
- [x] `_runner.ts` + `_types.ts` skeletons (Tasks 2, 4)
- [x] `airbnb-public.ts` first end-to-end path (Tasks 6, 7, 8)

Phase D-1 is complete. Next up: D-2 (`vrbo-public.ts`, weekly cron, failure capture) — requires a new plan document.
