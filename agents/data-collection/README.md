# Data Collection Agent

**Type:** Monitor
**Authority:** Observe (read-only -- no changes to listings)
**Cadence:** Weekly full scan (Sunday night) + daily spot-checks (Red/Orange properties)

## Purpose

Scrapes Airbnb Performance dashboard for all 6-8 host accounts, collecting conversion funnel metrics, quality scores, occupancy data, opportunities, and issues for every managed listing. Enriches with Streamline property data. Stores validated snapshots in `lc_metric_snapshots`.

## Input

- `lc_airbnb_accounts` -- Active accounts with encrypted session cookies
- `lc_properties` -- Property list with Airbnb listing ID mapping

## Output

- `lc_metric_snapshots` rows (one per property per snapshot date)
- `lc_airbnb_opportunities` rows (account-level opportunity tracking)
- `lc_scrape_runs` row (operational tracking)
- `lc_properties` updates (Streamline enrichment: beds, baths, occupancy, type)
- Refreshed `lc_latest_snapshots` materialized view
- Slack notifications on completion and errors

## Process

1. Create `lc_scrape_runs` row (status: running)
2. For each active Airbnb account (sequential):
   a. Restore session cookies to Playwright browser context
   b. Scrape 8 pages (conversion, views, wishlist, quality, occupancy, cancellation, opportunities, issues)
   c. Random 2-5 second delays between pages (human-like pacing)
   d. Parse per-listing tables, extract metrics by listing ID
   e. Validate each snapshot with `validateMetricSnapshot`
   f. UPSERT to `lc_metric_snapshots` (ON CONFLICT: only update if new data >= existing pages_scraped)
   g. Save updated session cookies back to DB
   h. Store HTML snapshots for debugging (7-day retention)
3. Run Streamline enrichment pipeline (max 10 concurrent, 200ms between batches)
4. Update `lc_scrape_runs` with completion stats
5. Refresh materialized view: `REFRESH MATERIALIZED VIEW CONCURRENTLY lc_latest_snapshots`
6. Post completion summary to Slack
7. If completeness < 80%, post alert to `#listing-center-alerts`

## Runtime

~30-50 minutes for full portfolio scan (6-8 accounts x 8 pages x 2-5s delays)

## Error Handling

| Error | Detection | Response |
|-------|-----------|----------|
| Cloudflare challenge | Page title contains "Just a moment" or challenge div present | Pause, Slack alert, skip account |
| Session expired | URL redirects to `/login` | Attempt cookie refresh, Slack alert for MFA if needed |
| Rate limiting | HTTP 429 or page load > 30s | Exponential backoff (5s, 10s, 20s), retry up to 3 times |
| Missing listing data | Expected table elements not found | Log skip, mark partial, continue to next page |
| Page structure change | CSS selectors return empty results | Store HTML snapshot, Slack alert to engineer |
| < 80% completeness | `completeness_pct < 80` after run | Immediate Slack alert to `#listing-center-alerts` |

## Entry Points

- `run-weekly-scan.ts` -- Full portfolio scan (all accounts, all pages)
- `run-spot-check.ts` -- Targeted scan (Red/Orange properties only, per-listing mode)
