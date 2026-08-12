# Listing Scraper

Public and extranet scrapers for the Listing Visibility & Performance Diagnostic Layer
(Phase D -- see `docs/superpowers/specs/2026-04-15-listing-visibility-diagnostic-layer.md`).

## Modules

- `_types.ts`         -- Shared types (OTA, ScrapeJob, ScrapeResult) and rate limits.
- `_runner.ts`        -- Job queue with concurrency, retries, rate-limit pacing.
- `_storage.ts`       -- DB writers (insert content snapshot, update presence).
- `airbnb-public.ts`  -- Anonymous Airbnb public listing scraper (V1).
- `run-public-scrape.ts` -- Entry point for weekly public scrape run.

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
