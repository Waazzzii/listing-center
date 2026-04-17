# Listing Visibility & Performance Diagnostic Layer

**Phase:** D
**Status:** Approved for implementation
**Date:** 2026-04-15
**Author:** Jason Pratts (COO, ACME House Company)
**Previous brainstorm:** Streamline Playwright execution → pivoted to diagnostic-first approach

---

## Problem

We're running 4 optimization agents (pricing, discount, revenue-pacer, content) and a Testing Engine that proposes actions, but we can't answer basic diagnostic questions about our listings today:

- Is this unit live on every OTA it should be distributed to?
- How is each listing actually performing per OTA (impressions, clicks, conversion)?
- What's the composite health of this listing vs. our portfolio?
- Where is there drift between what Streamline says we're distributing and what's actually visible to guests?

Without this foundation, every optimization agent is operating on partial data. We need the diagnostic layer before we meaningfully scale execution.

## Goal

Build a Listing Visibility & Performance Diagnostic Layer that, for every managed unit × OTA, reconciles three sources of truth:

1. **Streamline says** → what should be distributed (source of truth for intent)
2. **Public scrape says** → what guests actually see (independent audit)
3. **Extranet says** → how it's actually performing (performance reality)

Any mismatch becomes an action item. Any performance decay becomes an alert. Any listing outside health thresholds surfaces for human review.

## Non-Goals (V1)

- Automated execution of fixes (Streamline Playwright deferred to Phase E)
- The 4 Opportunity Agents — Image/Content Seasonality, Event Opportunities, Pricing Anomalies, Fee Optimization (parked for Phase F)
- Booking.com — not in V1 (only Airbnb + VRBO for V1, Booking in V2)
- KeyData integration — not in V1 (may complement performance data in V2)

## Scope

**OTAs in V1:** Airbnb, VRBO (Booking.com deferred to V2)

**Authentication model:** All extranet (authenticated) scraping runs through Wazzi's embedded component. Listing Center never stores or touches OTA credentials directly.

**Units in scope:** All active properties in Streamline (~1,060 across 9 area names).

## Architecture

### Data Model — 4 new tables

#### `lc_listing_presence`
One row per unit × OTA. Answers: "is this live where it should be?"

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `unit_id` | bigint | FK to lc properties |
| `ota` | text | `airbnb` \| `vrbo` |
| `streamline_distributed` | boolean | From Streamline distribution config |
| `publicly_found` | boolean | Did public scraper find a live listing? |
| `extranet_active` | boolean | Does extranet show listing as active? |
| `public_url` | text | Canonical public listing URL if found |
| `extranet_listing_id` | text | OTA's internal ID from extranet |
| `last_public_check_at` | timestamptz | |
| `last_extranet_check_at` | timestamptz | |
| `mismatch_flags` | text[] | e.g. `['streamline_on_public_off', 'stale_content']` |
| `created_at`, `updated_at` | timestamptz | |

**Unique:** `(unit_id, ota)`

#### `lc_listing_content_snapshot`
One row per unit × OTA × scrape run. Tracks content as seen by guests.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `unit_id` | bigint | |
| `ota` | text | |
| `source` | text | `public` \| `extranet` |
| `scraped_at` | timestamptz | |
| `title` | text | |
| `description` | text | |
| `photo_count` | int | |
| `primary_photo_url` | text | |
| `price_shown` | numeric | Displayed nightly rate for default dates |
| `rating` | numeric | |
| `review_count` | int | |
| `badges` | text[] | e.g. `['superhost', 'guest_favorite', 'rare_find']` |
| `cancellation_policy_display` | text | |
| `instant_book_enabled` | boolean | |
| `amenity_count` | int | |
| `amenity_highlights` | jsonb | Top-level amenity list shown |
| `raw_html_ref` | text | Optional — ref to stored HTML snapshot for diffing |

**Index:** `(unit_id, ota, scraped_at DESC)`

#### `lc_listing_performance`
One row per unit × OTA × day. Traffic and conversion metrics from extranet.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `unit_id` | bigint | |
| `ota` | text | |
| `date` | date | |
| `impressions` | int | |
| `clicks` | int | |
| `ctr` | numeric | clicks / impressions |
| `conversions` | int | Bookings originated in period |
| `cvr` | numeric | conversions / clicks |
| `revenue` | numeric | |
| `search_rank_median` | int | Median position in relevant searches |
| `saves` | int | Wishlist / save count |
| `quote_requests` | int | VRBO-specific |
| `scraped_at` | timestamptz | |

**Unique:** `(unit_id, ota, date)`

#### `lc_listing_health_score`
One row per unit × period. Composite health + component scores.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `unit_id` | bigint | |
| `period_start`, `period_end` | date | Rolling 7-day window |
| `composite_score` | int | 0-100 |
| `presence_score` | int | % expected OTAs where live |
| `content_score` | int | Photos, desc length, amenities vs market median |
| `traffic_score` | int | Impressions vs market peer rank |
| `conversion_score` | int | CVR vs market peer median |
| `bucket` | text | `red` \| `yellow` \| `green` |
| `trend_vs_prior` | int | Delta vs prior period composite |
| `calculated_at` | timestamptz | |

**Unique:** `(unit_id, period_end)`

### Scrapers — Per-OTA modules, shared runner

```
scrapers/
  _runner.ts               # Queue orchestration, retries, rate limits, failure screenshots
  _types.ts                # ScrapeJob, ScrapeResult, AuthContext shared interfaces
  airbnb-public.ts         # Anonymous scrape of public listing URL
  airbnb-extranet.ts       # Authenticated Airbnb Partner dashboard (via Wazzi component)
  vrbo-public.ts           # Anonymous scrape of public VRBO URL
  vrbo-extranet.ts         # Authenticated VRBO Owner dashboard (via Wazzi component)
```

**Shared runner responsibilities:**
- Job queueing (respect per-OTA rate limits — e.g. max 2 concurrent Airbnb requests)
- Exponential backoff + retry (3 attempts before marking failure)
- Failure capture (screenshot + HTML dump to Supabase storage for diagnosis)
- Metrics emission (scrape duration, success rate, captcha encounters per OTA)
- Rotating user-agents for public scrapers

**Public scrapers** (anonymous):
- Accept `public_url` from `lc_listing_presence`
- Extract: title, description, photo count, displayed price, rating, review count, badges, cancellation display, amenity list
- Write to `lc_listing_content_snapshot` with `source='public'`
- Update `lc_listing_presence.publicly_found` + `last_public_check_at`

**Extranet scrapers** (authenticated via Wazzi):
- Invoke Wazzi's embedded component with auth context for the target OTA
- Extract: full performance metrics (impressions, clicks, CVR, rank, saves), extranet-visible content, active/paused state
- Write to `lc_listing_performance` (per day) + `lc_listing_content_snapshot` with `source='extranet'`
- Update `lc_listing_presence.extranet_active` + `last_extranet_check_at`

### Cadence

| Source | Frequency | Vercel cron slot |
|---|---|---|
| Streamline fetch | Daily (existing) | existing |
| Public scrape | Weekly (Sundays 3am) | new `0 3 * * 0` |
| Extranet scrape | Daily (4am staggered by OTA) | new `0 4 * * *` Airbnb, `30 4 * * *` VRBO |
| Health score recompute | Daily 5am (after all sources land) | new `0 5 * * *` |

### Health Score Formula (V1 — tunable)

```
composite_score =
  0.25 * presence_score    # % of expected OTAs where listing is live & active
+ 0.20 * content_score     # Photo count + desc length + amenity count vs market median
+ 0.25 * traffic_score     # Impressions percentile within market peer group (7d)
+ 0.30 * conversion_score  # CVR percentile within market peer group (7d)
```

Component scoring:
- **Presence:** `(#live_ota / #expected_ota) * 100`. Penalty of -10 per mismatch flag active.
- **Content:** weighted sum of (photo_count ≥ 20 ? 40 : photo_count * 2), (desc_length ≥ 1500 ? 30 : desc_length / 50), (amenities ≥ median ? 30 : pro-rated).
- **Traffic:** percentile rank of 7-day impression sum within same market + property type.
- **Conversion:** percentile rank of 7-day CVR within same market + property type.

Buckets: `green` ≥ 75, `yellow` 50-74, `red` < 50.

Trend: `composite_this_period - composite_prior_period`. Alert threshold: drop ≥ 10 points.

### UI — New `/listings` Route

**Table view (primary):**
- Columns: Unit name, Market, OTA presence (✅/⚠️/❌ per OTA), Health score (color-coded), 7d trend arrow, Impressions (7d), CVR (7d), Last scraped
- Filters: Market, OTA, presence status, health bucket (red/yellow/green), trend direction
- Saved views:
  - "Missing from VRBO" → `streamline_distributed=true AND publicly_found=false AND ota='vrbo'`
  - "Low CTR" → `ctr < 0.015 (bottom quartile)`
  - "Red bucket this week" → `bucket='red'`
  - "Dropped 10+ points" → `trend_vs_prior <= -10`

**Drill-down view (per listing):**
- Unit header: name, market, property type, expected OTAs
- Three-column reconciliation panel:
  - Streamline says (distributed, last synced)
  - Public scrape says (URL, title, price shown, badges)
  - Extranet says (listing ID, active state, 7d performance)
- Mismatch flags callout
- 30-day trend chart: impressions, CVR, health score
- Content snapshot timeline (title/description/price changes over time)

## Wazzi Component Integration

Per user confirmation, Wazzi ships an embeddable agent-builder component that Listing Center imports. For Phase D, the integration points are:

1. **Extranet auth & navigation** — Wazzi component handles login, session persistence, and cookie/token management for each OTA. Listing Center never stores OTA credentials.
2. **Component invocation** — extranet scrapers call `wazzi.scrape({ platform, intent: 'fetch_performance', listing_id, date_range })` (exact contract TBD when component lands).
3. **Output** — Wazzi returns structured JSON; scrapers map to our schema and write to `lc_listing_performance` / `lc_listing_content_snapshot`.
4. **Failure handling** — Wazzi component reports failure mode (auth expired, captcha, DOM change, timeout); runner decides retry vs. alert.

## Phase Plan

### D-1: Foundation (Week 1)
- SQL migration for 4 new tables + indexes + RLS policies
- Seed `lc_listing_presence` rows from existing Streamline distribution data (one row per unit × OTA × active distribution)
- `_runner.ts` and `_types.ts` skeletons
- Public scraper: `airbnb-public.ts` (first end-to-end path)

### D-2: Public Scraping Complete (Week 2)
- `vrbo-public.ts`
- Weekly cron job `/api/cron/scrape-public`
- Failure capture to Supabase storage bucket
- Presence reconciliation job (compares Streamline vs. public scrape, writes mismatch flags)

### D-3: Extranet via Wazzi (Week 3)
- Wazzi component integration (blocked on component delivery)
- `airbnb-extranet.ts` + `vrbo-extranet.ts` using Wazzi contract
- Daily cron `/api/cron/scrape-extranet`
- `lc_listing_performance` population

### D-4: Health Score + UI (Week 4)
- Health score calculator + daily cron
- `/listings` route: table view with filters and saved views
- Drill-down view with 3-column reconciliation
- 30-day trend charts

## Success Criteria

- 100% of active units have at least one row in `lc_listing_presence` for each expected OTA
- Weekly public scrape completes with ≥ 95% success rate per OTA
- Daily extranet scrape completes with ≥ 90% success rate per OTA (once Wazzi component lands)
- Health score recompute runs in < 10 minutes for full portfolio
- `/listings` table loads in < 2 seconds with filters applied
- At least 3 mismatches surfaced in first week of operation (validates the audit has teeth)

## Risks & Open Questions

- **Wazzi component delivery timing** — D-3 is blocked until component is available. Fallback: build extranet scrapers ourselves with stored credentials (requires Jason's approval).
- **Airbnb / VRBO anti-scraping** — public scraping may trigger captchas or IP blocks. Mitigations: rotate user-agents, respect robots.txt, limit concurrency, fall back to residential proxy if blocked repeatedly.
- **Public URL discovery** — for units where `lc_listing_presence.public_url` is null, we need a discovery step (search OTA for unit address or known ID). TBD in D-2.
- **Rate scraping accuracy** — public price shown depends on dates queried. V1 uses "default dates" (30 days out, 2-night stay) for consistency; this may underrepresent actual booking flow prices.
- **Extranet schema drift** — OTAs update dashboards frequently. Scrapers need health checks that alert when expected fields go missing.

## What's Parked (Back-Pocket)

Per user direction, the following are deferred until this diagnostic layer is operational:

**Phase E candidate:** Streamline Playwright Execution — Wazzi component-driven updates to Streamline per-property settings (discounts, content, cancellation policies) using the Hybrid action taxonomy (generic `action_type` + `streamline_field` routing key).

**Phase F candidates:** The 4 Opportunity Agents
1. Image/Content Seasonality — swap hero images + descriptions based on market_type + date
2. Event Opportunities — title/description refresh for upcoming local events (Phoenix Open, Coachella, BNP Paribas)
3. Pricing Anomaly Detector — flag Wheelhouse vs. KeyData comp set deviations
4. Fee Optimization — cleaning/pet/extra-guest fees tuned to seasonality and demand

**Phase G candidate:** Booking.com extranet + public scraping (completing Big 3 coverage).
