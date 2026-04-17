import { chromium, Browser, BrowserContext, Page } from 'playwright';
import { getSupabase } from '@/lib/supabase';
import { validateMetricSnapshot } from './validation';
import {
  scrapeConversionPage,
  scrapeViewsPage,
  scrapeWishlistPage,
  scrapeQualityOverallPage,
  scrapeOccupancyPage,
  scrapeCancellationPage,
  scrapeOpportunitiesPage,
  scrapeIssuesPage,
  ParsedOpportunity,
  ParsedIssue,
} from './page-scrapers';
import { restoreSession, persistSession, detectSessionExpired } from './session-manager';
import { notifySlack, notifyScrapeComplete, notifyScrapeError, notifySessionExpired } from './slack-notifier';

// ============================================================
// TYPES
// ============================================================

export interface AirbnbAccount {
  id: number;
  account_name: string;
  account_email: string | null;
  listing_count: number | null;
  markets: string[];
  session_data: unknown; // Encrypted JSONB
  is_active: boolean;
}

export interface ScrapeRunConfig {
  /** 'weekly_full' or 'daily_spot_check' */
  run_type: 'weekly_full' | 'daily_spot_check';
  /** For spot checks: only scrape these listing IDs */
  target_listing_ids?: string[];
  /** Override snapshot date (defaults to current Monday for weekly, today for spot check) */
  snapshot_date?: string;
}

export interface ScrapeRunResult {
  scrape_run_id: string;
  accounts_processed: number;
  accounts_failed: number;
  properties_scraped: number;
  properties_expected: number;
  completeness_pct: number;
  errors: Array<{ account_id: number; page: string; error: string }>;
  duration_seconds: number;
}

// ============================================================
// CONSTANTS
// ============================================================

const TOTAL_PAGES = 8;
const MIN_DELAY_MS = 2000;
const MAX_DELAY_MS = 5000;
const PAGE_LOAD_TIMEOUT_MS = 30000;
const HTML_SNAPSHOT_RETENTION_DAYS = 7;

/** The 8 Airbnb Performance pages we scrape in order */
const SCRAPE_PAGES = [
  { name: 'conversion', path: '/performance/conversion/conversion_rate' },
  { name: 'views', path: '/performance/conversion/p3_impressions' },
  { name: 'wishlist', path: '/performance/conversion/wishlist' },
  { name: 'quality_overall', path: '/performance/quality/overall' },
  { name: 'occupancy', path: '/performance/occupancy/occupancy_rate' },
  { name: 'cancellation', path: '/performance/occupancy/cancellation_rate' },
  { name: 'opportunities', path: '/performance/opportunities' },
  { name: 'issues', path: '/performance/recent-issues' },
] as const;

// ============================================================
// HELPERS
// ============================================================

/**
 * Random delay between min and max ms to simulate human browsing.
 * Critical for avoiding Cloudflare detection.
 */
function randomDelay(min: number = MIN_DELAY_MS, max: number = MAX_DELAY_MS): Promise<void> {
  const delay = Math.floor(Math.random() * (max - min + 1)) + min;
  return new Promise(resolve => setTimeout(resolve, delay));
}

/**
 * Get the Monday of the current week as YYYY-MM-DD.
 * Weekly snapshots always use the Monday date as the snapshot_date.
 */
function getCurrentMonday(): string {
  const now = new Date();
  const day = now.getDay(); // 0 = Sunday, 1 = Monday, ...
  const diff = now.getDate() - day + (day === 0 ? -6 : 1); // Adjust for Sunday
  const monday = new Date(now.setDate(diff));
  return monday.toISOString().split('T')[0];
}

/**
 * Get today's date as YYYY-MM-DD.
 */
function getToday(): string {
  return new Date().toISOString().split('T')[0];
}

// ============================================================
// CORE SCRAPER
// ============================================================

/**
 * Scrape a single Airbnb account across all 8 pages.
 *
 * Returns an array of per-listing metric objects (one per listing found),
 * plus account-level opportunities and issues.
 *
 * The browser context is created with real Chrome, restored session cookies,
 * and a realistic viewport/user agent to avoid detection.
 */
export async function scrapeAirbnbAccount(
  account: AirbnbAccount,
  config: ScrapeRunConfig,
): Promise<{
  listings: Map<string, Record<string, unknown>>;
  opportunities: ParsedOpportunity[];
  issues: ParsedIssue[];
  pagesScraped: number;
  htmlSnapshots: Array<{ page: string; html: string; timestamp: string }>;
  errors: Array<{ page: string; error: string }>;
}> {
  const browser: Browser = await chromium.launch({
    headless: false,      // Real Chrome — required to avoid Cloudflare
    channel: 'chrome',    // Use installed Chrome, not bundled Chromium
  });

  // Restore session cookies from encrypted DB storage
  const cookies = await restoreSession(account.id);

  const context: BrowserContext = await browser.newContext({
    storageState: {
      cookies: cookies as Array<{
        name: string;
        value: string;
        domain: string;
        path: string;
        expires: number;
        httpOnly: boolean;
        secure: boolean;
        sameSite: 'Strict' | 'Lax' | 'None';
      }>,
      origins: [],
    },
    viewport: { width: 1920, height: 1080 },
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    locale: 'en-US',
    timezoneId: 'America/Los_Angeles',
  });

  const page: Page = await context.newPage();

  // Result accumulators
  const allListingData = new Map<string, Record<string, unknown>>();
  const allOpportunities: ParsedOpportunity[] = [];
  const allIssues: ParsedIssue[] = [];
  const htmlSnapshots: Array<{ page: string; html: string; timestamp: string }> = [];
  const errors: Array<{ page: string; error: string }> = [];
  let pagesScraped = 0;

  // Build URL suffix for spot checks
  const lidParam = config.run_type === 'daily_spot_check' && config.target_listing_ids?.length
    ? '?' + config.target_listing_ids.map(id => `lid%5B%5D=${id}`).join('&')
    : '';

  try {
    for (const scrapePage of SCRAPE_PAGES) {
      try {
        const url = `https://www.airbnb.com${scrapePage.path}${lidParam}`;

        await page.goto(url, { waitUntil: 'networkidle', timeout: PAGE_LOAD_TIMEOUT_MS });

        // Check for Cloudflare challenge
        const pageTitle = await page.title();
        if (pageTitle.includes('Just a moment') || await page.$('#challenge-running')) {
          throw new Error('Cloudflare challenge detected — manual intervention required');
        }

        // Check for session expiry (redirect to login)
        if (page.url().includes('/login') || page.url().includes('/authenticate')) {
          const expired = await detectSessionExpired(page);
          if (expired) {
            await notifySessionExpired(account.id, account.account_name);
            throw new Error(`Session expired for account ${account.account_name} — MFA required`);
          }
        }

        // Random delay to simulate human browsing
        await randomDelay();

        // Store HTML snapshot for debugging
        const html = await page.content();
        htmlSnapshots.push({
          page: scrapePage.name,
          html,
          timestamp: new Date().toISOString(),
        });

        // Dispatch to the appropriate page scraper
        switch (scrapePage.name) {
          case 'conversion': {
            const rows = await scrapeConversionPage(page);
            for (const row of rows) {
              const existing = allListingData.get(row.listing_id) || {};
              allListingData.set(row.listing_id, { ...existing, ...row.metrics });
            }
            break;
          }
          case 'views': {
            const rows = await scrapeViewsPage(page);
            for (const row of rows) {
              const existing = allListingData.get(row.listing_id) || {};
              allListingData.set(row.listing_id, { ...existing, ...row.metrics });
            }
            break;
          }
          case 'wishlist': {
            const rows = await scrapeWishlistPage(page);
            for (const row of rows) {
              const existing = allListingData.get(row.listing_id) || {};
              allListingData.set(row.listing_id, { ...existing, ...row.metrics });
            }
            break;
          }
          case 'quality_overall': {
            const rows = await scrapeQualityOverallPage(page);
            for (const row of rows) {
              const existing = allListingData.get(row.listing_id) || {};
              allListingData.set(row.listing_id, { ...existing, ...row.metrics });
            }
            break;
          }
          case 'occupancy': {
            const rows = await scrapeOccupancyPage(page);
            for (const row of rows) {
              const existing = allListingData.get(row.listing_id) || {};
              allListingData.set(row.listing_id, { ...existing, ...row.metrics });
            }
            break;
          }
          case 'cancellation': {
            const rows = await scrapeCancellationPage(page);
            for (const row of rows) {
              const existing = allListingData.get(row.listing_id) || {};
              allListingData.set(row.listing_id, { ...existing, ...row.metrics });
            }
            break;
          }
          case 'opportunities': {
            const opps = await scrapeOpportunitiesPage(page);
            allOpportunities.push(...opps);
            break;
          }
          case 'issues': {
            const iss = await scrapeIssuesPage(page);
            allIssues.push(...iss);
            break;
          }
        }

        pagesScraped++;
      } catch (pageError: unknown) {
        const errMsg = pageError instanceof Error ? pageError.message : String(pageError);
        errors.push({ page: scrapePage.name, error: errMsg });
        console.error(`[Account ${account.id}] Error scraping ${scrapePage.name}:`, errMsg);

        // If Cloudflare or session expired, stop this account entirely
        if (errMsg.includes('Cloudflare') || errMsg.includes('Session expired')) {
          break;
        }

        // Otherwise continue to next page — partial data is better than none
      }
    }
  } finally {
    // Always persist updated cookies and close browser
    try {
      const updatedCookies = await context.cookies();
      await persistSession(account.id, updatedCookies);
    } catch (cookieErr) {
      console.error(`Failed to persist cookies for account ${account.id}:`, cookieErr);
    }

    await browser.close();
  }

  return {
    listings: allListingData,
    opportunities: allOpportunities,
    issues: allIssues,
    pagesScraped,
    htmlSnapshots,
    errors,
  };
}

// ============================================================
// DATABASE OPERATIONS
// ============================================================

/**
 * Create a scrape run record. Called at the start of every scan.
 * Returns the UUID of the new lc_scrape_runs row.
 */
export async function createScrapeRun(
  runType: 'weekly_full' | 'daily_spot_check',
  expectedCount: number,
): Promise<string> {
  const supabase = getSupabase();

  const { data, error } = await supabase
    .from('lc_scrape_runs')
    .insert({
      run_date: getToday(),
      run_type: runType,
      properties_expected: expectedCount,
    })
    .select('id')
    .single();

  if (error) throw new Error(`Failed to create scrape run: ${error.message}`);
  return data.id;
}

/**
 * Update a scrape run record with final results.
 */
export async function completeScrapeRun(
  runId: string,
  result: Omit<ScrapeRunResult, 'scrape_run_id'>,
): Promise<void> {
  const supabase = getSupabase();

  const { error } = await supabase
    .from('lc_scrape_runs')
    .update({
      accounts_processed: result.accounts_processed,
      accounts_failed: result.accounts_failed,
      properties_scraped: result.properties_scraped,
      completeness_pct: result.completeness_pct,
      completed_at: new Date().toISOString(),
      duration_seconds: result.duration_seconds,
      errors: result.errors.length > 0 ? result.errors : null,
    })
    .eq('id', runId);

  if (error) throw new Error(`Failed to update scrape run: ${error.message}`);
}

/**
 * UPSERT a metric snapshot. Uses ON CONFLICT to handle retries.
 *
 * Key behavior: Only updates if the new data has equal or more pages_scraped
 * than the existing row. This prevents a partial retry from overwriting a
 * complete scrape.
 */
export async function upsertMetricSnapshot(
  propertyId: string,
  snapshotDate: string,
  snapshotSource: string,
  scrapeRunId: string,
  pagesScraped: number,
  metrics: Record<string, unknown>,
): Promise<void> {
  const supabase = getSupabase();

  const scrapeCompleteness = pagesScraped === TOTAL_PAGES ? 'complete'
    : pagesScraped > 0 ? 'partial'
    : 'failed';

  const row = {
    property_id: propertyId,
    snapshot_date: snapshotDate,
    snapshot_source: snapshotSource,
    scrape_run_id: scrapeRunId,
    scrape_completeness: scrapeCompleteness,
    pages_scraped: pagesScraped,
    // Spread all metric fields
    ...metrics,
  };

  // Supabase upsert with onConflict
  // The unique index is on (property_id, snapshot_date, snapshot_source)
  const { error } = await supabase
    .from('lc_metric_snapshots')
    .upsert(row, {
      onConflict: 'property_id,snapshot_date,snapshot_source',
    });

  if (error) {
    // If the built-in upsert doesn't support the WHERE clause we need,
    // fall back to raw SQL via RPC
    const { error: rpcError } = await supabase.rpc('upsert_metric_snapshot', {
      p_property_id: propertyId,
      p_snapshot_date: snapshotDate,
      p_snapshot_source: snapshotSource,
      p_scrape_run_id: scrapeRunId,
      p_pages_scraped: pagesScraped,
      p_scrape_completeness: scrapeCompleteness,
      p_metrics: metrics,
    });

    if (rpcError) {
      throw new Error(`Failed to upsert snapshot for property ${propertyId}: ${rpcError.message}`);
    }
  }
}

/**
 * Store opportunities for an account (delete old ones for this snapshot date first).
 */
export async function storeOpportunities(
  accountId: number,
  snapshotDate: string,
  opportunities: ParsedOpportunity[],
): Promise<void> {
  const supabase = getSupabase();

  // Delete existing for this account + date (idempotent)
  await supabase
    .from('lc_airbnb_opportunities')
    .delete()
    .eq('airbnb_account_id', accountId)
    .eq('snapshot_date', snapshotDate);

  if (opportunities.length === 0) return;

  const rows = opportunities.map(opp => ({
    airbnb_account_id: accountId,
    snapshot_date: snapshotDate,
    opportunity_name: opp.name,
    category: opp.category,
    completion_pct: opp.completion_pct,
    is_completed: opp.completion_pct >= 95,
  }));

  const { error } = await supabase
    .from('lc_airbnb_opportunities')
    .insert(rows);

  if (error) {
    console.error(`Failed to store opportunities for account ${accountId}:`, error.message);
  }
}

/**
 * Store HTML snapshots in a temporary storage bucket for debugging.
 * Retained for 7 days. Stored as JSON with page name and HTML content.
 */
export async function storeHtmlSnapshots(
  accountId: number,
  snapshots: Array<{ page: string; html: string; timestamp: string }>,
): Promise<void> {
  const supabase = getSupabase();
  const date = getToday();
  const fileName = `scrape-debug/${date}/account-${accountId}.json`;

  const { error } = await supabase.storage
    .from('listing-center')
    .upload(fileName, JSON.stringify(snapshots, null, 2), {
      contentType: 'application/json',
      upsert: true,
    });

  if (error) {
    console.error(`Failed to store HTML snapshots for account ${accountId}:`, error.message);
  }
}

/**
 * Refresh the lc_latest_snapshots materialized view.
 * Must be called after scrape completes so the dashboard sees fresh data.
 */
export async function refreshMaterializedView(): Promise<void> {
  const supabase = getSupabase();

  const { error } = await supabase.rpc('refresh_latest_snapshots');

  if (error) {
    throw new Error(`Failed to refresh materialized view: ${error.message}`);
  }
}

/**
 * Clean up HTML snapshots older than retention period.
 */
export async function cleanupOldHtmlSnapshots(): Promise<void> {
  const supabase = getSupabase();
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - HTML_SNAPSHOT_RETENTION_DAYS);
  const cutoffStr = cutoff.toISOString().split('T')[0];

  // List and delete old debug files
  const { data: files } = await supabase.storage
    .from('listing-center')
    .list('scrape-debug');

  if (files) {
    const oldDirs = files.filter(f => f.name < cutoffStr);
    for (const dir of oldDirs) {
      const { data: dirFiles } = await supabase.storage
        .from('listing-center')
        .list(`scrape-debug/${dir.name}`);

      if (dirFiles) {
        const paths = dirFiles.map(f => `scrape-debug/${dir.name}/${f.name}`);
        await supabase.storage.from('listing-center').remove(paths);
      }
    }
  }
}

// ============================================================
// ORCHESTRATION
// ============================================================

/**
 * Run the full scrape pipeline for all active accounts.
 *
 * This is the main entry point called by run-weekly-scan.ts and run-spot-check.ts.
 * It processes accounts sequentially (one browser at a time) to avoid
 * resource contention and reduce detection risk.
 */
export async function runScrape(config: ScrapeRunConfig): Promise<ScrapeRunResult> {
  const supabase = getSupabase();
  const startTime = Date.now();

  // 1. Load active accounts
  const { data: accounts, error: accountsError } = await supabase
    .from('lc_airbnb_accounts')
    .select('*')
    .eq('is_active', true)
    .order('id');

  if (accountsError || !accounts) {
    throw new Error(`Failed to load accounts: ${accountsError?.message}`);
  }

  // 2. Load property mapping (airbnb_listing_id -> property UUID)
  const { data: properties, error: propsError } = await supabase
    .from('lc_properties')
    .select('id, airbnb_listing_id, airbnb_account_id')
    .eq('is_active', true)
    .not('airbnb_listing_id', 'is', null);

  if (propsError || !properties) {
    throw new Error(`Failed to load properties: ${propsError?.message}`);
  }

  const listingToProperty = new Map<string, string>();
  for (const p of properties) {
    if (p.airbnb_listing_id) {
      listingToProperty.set(p.airbnb_listing_id, p.id);
    }
  }

  const expectedCount = config.target_listing_ids?.length || properties.length;

  // 3. Create scrape run tracking row
  const scrapeRunId = await createScrapeRun(config.run_type, expectedCount);

  const snapshotDate = config.snapshot_date
    || (config.run_type === 'weekly_full' ? getCurrentMonday() : getToday());

  const snapshotSource = config.run_type === 'weekly_full' ? 'weekly_full_scan' : 'daily_spot_check';

  // 4. Process each account sequentially
  let accountsProcessed = 0;
  let accountsFailed = 0;
  let propertiesScraped = 0;
  const allErrors: Array<{ account_id: number; page: string; error: string }> = [];

  for (const account of accounts) {
    try {
      console.log(`\n[Scraper] Processing account ${account.id}: ${account.account_name}`);

      const result = await scrapeAirbnbAccount(account as AirbnbAccount, config);

      // Store HTML snapshots for debugging
      if (result.htmlSnapshots.length > 0) {
        await storeHtmlSnapshots(account.id, result.htmlSnapshots);
      }

      // Collect errors
      for (const err of result.errors) {
        allErrors.push({ account_id: account.id, ...err });
      }

      // Store opportunities (account-level data)
      if (result.opportunities.length > 0) {
        await storeOpportunities(account.id, snapshotDate, result.opportunities);
      }

      // Process per-listing data: validate and upsert
      for (const [listingId, metrics] of Array.from(result.listings.entries())) {
        const propertyId = listingToProperty.get(listingId);
        if (!propertyId) {
          console.warn(`[Scraper] Unknown listing ID ${listingId} — skipping (not in lc_properties)`);
          continue;
        }

        // Mark issues on the property
        const hasIssues = result.issues.some(
          iss => iss.listing_id === listingId && iss.status === 'needs_attention'
        );

        const fullMetrics = {
          ...metrics,
          airbnb_has_issues: hasIssues,
        };

        // Validate before insert
        const validation = validateMetricSnapshot(fullMetrics);
        if (!validation.success) {
          console.warn(
            `[Scraper] Invalid metrics for listing ${listingId}:`,
            validation.error.issues.map(i => i.message).join(', ')
          );
          await notifySlack(
            `Invalid data for listing ${listingId} (account ${account.account_name}) — skipped. ` +
            `Errors: ${validation.error.issues.map(i => i.message).join(', ')}`
          );
          continue;
        }

        await upsertMetricSnapshot(
          propertyId,
          snapshotDate,
          snapshotSource,
          scrapeRunId,
          result.pagesScraped,
          fullMetrics,
        );

        propertiesScraped++;
      }

      // Update account last scrape info
      await supabase
        .from('lc_airbnb_accounts')
        .update({
          last_scrape_date: snapshotDate,
          last_scrape_status: result.pagesScraped === TOTAL_PAGES ? 'success'
            : result.pagesScraped > 0 ? 'partial'
            : 'failed',
        })
        .eq('id', account.id);

      accountsProcessed++;
    } catch (accountError: unknown) {
      accountsFailed++;
      const errMsg = accountError instanceof Error ? accountError.message : String(accountError);
      allErrors.push({ account_id: account.id, page: 'account_level', error: errMsg });
      console.error(`[Scraper] Account ${account.id} failed entirely:`, errMsg);
      await notifyScrapeError(account.id, account.account_name, errMsg);
    }
  }

  // 5. Calculate completeness
  const completenessPct = expectedCount > 0
    ? Math.round((propertiesScraped / expectedCount) * 10000) / 100
    : 0;

  const durationSeconds = Math.round((Date.now() - startTime) / 1000);

  // 6. Update scrape run record
  const runResult: ScrapeRunResult = {
    scrape_run_id: scrapeRunId,
    accounts_processed: accountsProcessed,
    accounts_failed: accountsFailed,
    properties_scraped: propertiesScraped,
    properties_expected: expectedCount,
    completeness_pct: completenessPct,
    errors: allErrors,
    duration_seconds: durationSeconds,
  };

  await completeScrapeRun(scrapeRunId, runResult);

  // 7. Refresh materialized view
  try {
    await refreshMaterializedView();
  } catch (mvError) {
    console.error('[Scraper] Failed to refresh materialized view:', mvError);
    allErrors.push({ account_id: 0, page: 'materialized_view', error: String(mvError) });
  }

  // 8. Clean up old HTML snapshots
  try {
    await cleanupOldHtmlSnapshots();
  } catch (cleanupErr) {
    console.error('[Scraper] Failed to clean up old snapshots:', cleanupErr);
  }

  // 9. Post completion notification
  await notifyScrapeComplete(runResult);

  // 10. Health alert if < 80% completeness
  if (completenessPct < 80) {
    await notifySlack(
      `SCRAPE HEALTH WARNING: Only ${completenessPct}% of properties scraped ` +
      `(${propertiesScraped}/${expectedCount}). ` +
      `${accountsFailed} accounts failed. Dashboard data may be stale.`,
      '#listing-center-alerts',
    );
  }

  return runResult;
}
