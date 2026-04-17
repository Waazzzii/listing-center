/**
 * Weekly Public Scrape -- Entry Point
 *
 * Pulls every active (unit x OTA) from lc_listing_presence where
 *   streamline_distributed = true AND public_url IS NOT NULL
 * and runs the appropriate per-OTA public scraper against it.
 *
 * V1: only airbnb-public is implemented. VRBO + Booking added in later tasks.
 *
 * Usage:   npm run agent:public-scrape
 * Flags:   --limit=N   (debug: scrape at most N jobs)
 *          --unit=<id> (debug: scrape a single unit)
 */

import { config as loadEnv } from 'dotenv';
loadEnv({ path: '.env.local' });

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
    if (a.startsWith('--limit=')) {
      const raw = a.slice('--limit='.length);
      const n = parseInt(raw, 10);
      if (!Number.isFinite(n) || n <= 0) {
        throw new Error(`--limit requires a positive integer, got "${raw}"`);
      }
      out.limit = n;
    }
    if (a.startsWith('--unit=')) {
      const raw = a.slice('--unit='.length).trim();
      if (!raw) throw new Error('--unit requires a non-empty UUID');
      out.unit = raw;
    }
  }
  return out;
}

async function loadJobs(args: Args): Promise<ScrapeJob[]> {
  const supabase = getSupabase();

  // Paginate past PostgREST's 1000-row default. Today we have 1,036 airbnb
  // rows — already past the ceiling — and any new property added to
  // Streamline will push it further. Matches the seeder's pagination pattern.
  type Row = {
    unit_id: string;
    ota: string;
    public_url: string | null;
    extranet_listing_id: string | null;
  };
  const rows: Row[] = [];
  const PAGE = 1000;

  // For --unit or --limit, a single page is always sufficient.
  const singlePage = Boolean(args.unit) || (args.limit !== undefined && args.limit <= PAGE);

  for (let offset = 0; ; offset += PAGE) {
    let q = supabase
      .from('lc_listing_presence')
      .select('unit_id, ota, public_url, extranet_listing_id')
      .eq('streamline_distributed', true)
      .not('public_url', 'is', null)
      .order('unit_id', { ascending: true });

    if (args.unit) q = q.eq('unit_id', args.unit);

    if (args.limit) {
      // Cap the total fetched at args.limit.
      const remaining = args.limit - rows.length;
      if (remaining <= 0) break;
      const take = Math.min(PAGE, remaining);
      q = q.range(offset, offset + take - 1);
    } else {
      q = q.range(offset, offset + PAGE - 1);
    }

    const { data, error } = await q;
    if (error) throw new Error(`loadJobs failed (offset=${offset}): ${error.message}`);
    const page = (data ?? []) as Row[];
    rows.push(...page);
    if (page.length < PAGE || singlePage) break;
  }

  return rows.map((row) => ({
    unitId: row.unit_id,
    ota: row.ota as OTA,
    source: 'public' as const,
    publicUrl: row.public_url as string,
    extranetListingId: (row.extranet_listing_id ?? undefined) as string | undefined,
  }));
}

function dispatchScraper(job: ScrapeJob) {
  if (job.ota === 'airbnb') return scrapeAirbnbPublic(job);
  // TODO Task D-2: VRBO / Booking public scrapers wired here.
  // parse_error is non-retryable in _runner.NON_RETRYABLE — a missing
  // scraper is a permanent misconfiguration, not a transient failure.
  return Promise.resolve({
    job,
    ok: false,
    error: {
      code: 'parse_error' as const,
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

  // Single batch timestamp so all "not found" presence rows share one
  // coherent checked_at for this run — makes batch triage / diff queries easy.
  const batchCheckedAt = new Date();
  let ok = 0;
  let failed = 0;
  for (const r of results) {
    if (r.ok && r.snapshot) {
      // Log the extracted title so bot-block / redirect pages are visible in
      // run output without needing a DB round-trip. Real listings will show
      // the actual listing title; block pages show Airbnb's generic homepage
      // title, which is an immediate red flag.
      console.log(
        `  ok unit=${r.job.unitId} title=${JSON.stringify(r.snapshot.title)} rating=${r.snapshot.rating} reviews=${r.snapshot.reviewCount}`
      );
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
      const errMsg = r.error ? `${r.error.code}: ${r.error.message}` : 'unknown';
      console.log(`  fail unit=${r.job.unitId} error=${errMsg}`);
      try {
        await updatePresence({
          unitId: r.job.unitId,
          ota: r.job.ota,
          source: 'public',
          found: false,
          checkedAt: batchCheckedAt,
        });
      } catch (err) {
        console.error(`presence update failed for unit=${r.job.unitId}:`, err);
      }
      failed++;
    }
  }

  const finishedAt = new Date();
  console.log(
    `\nDone. ok=${ok} failed=${failed} duration=${(finishedAt.getTime() - startedAt.getTime()) / 1000}s`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
