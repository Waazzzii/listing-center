# D-1 Revised Handoff — Brendon

**From:** Jason Pratts
**Date:** 2026-05-12
**Status:** Foundation merged + committed to `staging`. Ready to execute. Not yet pushed to Supabase / scraped.
**Repo:** `listing-center` (this branch: `staging`)
**Supabase project ref:** `kwcwnaibioibwwmlywtt`

---

## TL;DR

Listing Center had a Phase D-1 plan to build a public-scrape + reconciliation layer for OTA listing data. While executing it, we discovered:

1. **The existing `agents/data-collection/airbnb-scraper.ts` is a full authenticated extranet scraper** that visits 8 Airbnb performance pages, persists encrypted sessions in `lc_airbnb_accounts.session_data`, and writes rich metrics to `lc_metric_snapshots` (~40 columns). D-1 unknowingly designed a parallel, less-good pipeline.
2. **The public scrape doesn't return useful data** — it just gets the Airbnb homepage redirect. D-1's `airbnb-public.ts` is essentially dead code we should retire.
3. **The DB was full of placeholder data** — 5 fake `lc_airbnb_accounts` rows with `@acmehouse.com` emails, 2,379 placeholder metric snapshots, no real sessions ever logged in.
4. **Jason has 7 real Airbnb host accounts** with credentials, listed in his `.env.local`, controlling 1,107 active listings across AZ and CA markets. The xlsx report at `~/Downloads/AirBnB Listings.xlsx` is the source of truth.

**The pivot:** wipe placeholders, import real account data + listing mappings, then run the existing authenticated scraper. Three artifacts are ready and committed; remaining work is execution + a smoke-test login script.

---

## What's done (committed to `staging`)

| Artifact | Path | Purpose |
|---|---|---|
| Migration | `supabase/migrations/20260503000001_wipe_placeholders_add_airbnb_user_id.sql` | Adds `airbnb_user_id` column; wipes 5 placeholder accounts, 2,379 placeholder snapshots, opportunities, scrape runs; nulls out `airbnb_account_id` on 1,036 properties |
| Seed script | `scripts/seed-real-airbnb-accounts.ts` | Inserts 7 real Airbnb accounts using emails from `.env.local` |
| Import script | `scripts/import-airbnb-listings-from-xlsx.ts` | Reads `AirBnB Listings.xlsx` (1,107 rows), matches by `airbnb_listing_id`, updates `lc_properties.airbnb_account_id`; unmatched written to CSV |
| npm scripts | `package.json` | `seed:real-airbnb-accounts`, `import:airbnb-listings` |
| Dep added | `package.json` | `xlsx@^0.18.5` |
| Original D-1 spec | `docs/superpowers/specs/2026-04-15-listing-visibility-diagnostic-layer.md` | Reference — the original public-scrape design (now partially superseded) |
| Original D-1 plan | `docs/superpowers/plans/2026-04-15-phase-d1-foundation.md` | Reference — task-by-task plan; tasks 1–8 are done (code exists on `staging`) |

Three commits on `staging` ahead of `origin/staging` (all pushed by this handoff).

---

## What's NOT done

1. ⏳ **Migration has not been applied to Supabase yet.** Pending — Jason or Brendon to paste into SQL Editor.
2. ⏳ **Seed not run** (depends on migration + `.env.local`).
3. ⏳ **Import not run** (depends on seed).
4. ⏳ **Smoke-test login script not written.** Stub plan below.
5. ⏳ **Existing `airbnb-public.ts` scraper not retired.** Still wired in `vercel.json` cron and `agents/listing-scraper/`. Should be retired or marked dormant once authenticated path works.
6. ⏳ **`airbnb_user_id NOT NULL UNIQUE` constraint** — added the column nullable; tighten after seed populates all 7 rows.
7. ⏳ **4 pre-existing TypeScript errors** in `__tests__/lib/slack.test.ts` and `src/components/property/ReviewSummary.tsx` — unrelated to this work but should be fixed eventually.

---

## Runbook — execute in this order

### Step 1: apply the migration

Open https://supabase.com/dashboard/project/kwcwnaibioibwwmlywtt/sql/new — paste contents of `supabase/migrations/20260503000001_wipe_placeholders_add_airbnb_user_id.sql` → Run.

⚠️ **Destructive:** wipes 2,379 metric snapshots, 5 accounts, all opportunities, all scrape runs, nulls 1,036 `airbnb_account_id` values. Properties themselves are preserved.

Run the post-migration verification block at the bottom of the SQL file. Expect 0 rows in 4 tables + 1 new column.

### Step 2: confirm `.env.local`

The file must exist at `listing-center/.env.local` (gitignored) with:

```
SUPABASE_URL=https://kwcwnaibioibwwmlywtt.supabase.co
SUPABASE_SERVICE_KEY=<service-role-key from Supabase dashboard → Settings → API>
AIRBNB_SESSION_ENCRYPTION_KEY=<openssl rand -hex 32>

AIRBNB_ACCT_137854275_EMAIL=reservations@acmehouseco.com
AIRBNB_ACCT_137854275_PASSWORD=<rotated>
AIRBNB_ACCT_162858310_EMAIL=Reservation@casagoarizona.com
AIRBNB_ACCT_162858310_PASSWORD=<rotated>
AIRBNB_ACCT_104930499_EMAIL=reservation+centralaz@casagoarizona.com
AIRBNB_ACCT_104930499_PASSWORD=<rotated>
AIRBNB_ACCT_122210813_EMAIL=reservation+casagoaz@casagoarizona.com
AIRBNB_ACCT_122210813_PASSWORD=<rotated>
AIRBNB_ACCT_131765587_EMAIL=reservation+coachella@casagosocal.com
AIRBNB_ACCT_131765587_PASSWORD=<rotated>
AIRBNB_ACCT_48722591_EMAIL=reservation+1@casagosocal.com
AIRBNB_ACCT_48722591_PASSWORD=<rotated>
AIRBNB_ACCT_6201646_EMAIL=reservation@casagosocal.com
AIRBNB_ACCT_6201646_PASSWORD=<rotated>
```

**⚠️ Credential hygiene:** the original passwords Jason provided are in conversation history with the AI agent and must be considered compromised. Confirm with Jason that all 7 have been rotated before proceeding. Never paste passwords into chat or commit them to git.

### Step 3: run the seed

```bash
cd "/Users/jasonpratts/D2C Internal/Code/Wazzi GitHub/listing-center"
npm install   # if you haven't already, picks up xlsx package
npm run seed:real-airbnb-accounts
```

Expected: 7 rows inserted into `lc_airbnb_accounts` with `airbnb_user_id` populated. Re-running is safe (upsert behavior).

Verify in SQL Editor:
```sql
SELECT id, airbnb_user_id, account_name, account_email, listing_count, is_active
FROM lc_airbnb_accounts ORDER BY airbnb_user_id;
-- Expect 7 rows
```

### Step 4: dry-run the import

```bash
npm run import:airbnb-listings -- --dry-run
```

Expected output:
- `1107 listings found in xlsx`
- `7 real Airbnb accounts in DB`
- `1036 active properties have airbnb_listing_id`
- `Matched (will update): ~1036`
- `Unmatched (skipped): ~71`
- Path to unmatched CSV in `/tmp/`

Review the unmatched CSV. These are the 71 listings in the xlsx that don't have a corresponding `lc_properties` row — per Decision 3, skipped for v1; future Streamline cron will reconcile.

### Step 5: real import

```bash
npm run import:airbnb-listings
```

Verify:
```sql
SELECT airbnb_account_id, COUNT(*)
FROM lc_properties
WHERE is_active = true AND airbnb_account_id IS NOT NULL
GROUP BY airbnb_account_id
ORDER BY airbnb_account_id;
-- Expect distribution roughly matching xlsx listing_count per account:
--   1 → ~261 (104930499 Casago Arizona Flannery)
--   2 → 0 (122210813 — not in xlsx)
--   3 → ~400 (131765587 Coachella)
--   4 → ~161 (137854275 ACME House Company)
--   5 → ~282 (162858310 Arizona Secondary)
--   6 → ~2 (48722591)
--   7 → ~1 (6201646)
-- Total ~1036 (= unique listings already in lc_properties)
```

### Step 6: write + run the smoke-test login script

**This is the one piece of code that still needs to be written.** Suggested location: `scripts/smoke-test-airbnb-login.ts`.

Design:
- Take `--user-id=<n>` arg (default to `6201646` — the 1-listing account, smallest blast radius)
- Read `AIRBNB_ACCT_<userid>_EMAIL` and `AIRBNB_ACCT_<userid>_PASSWORD` from env
- Look up the internal `lc_airbnb_accounts.id` via `airbnb_user_id`
- Launch Playwright (chromium, headless: false for first run so you can solve captchas / MFA)
- Navigate to `https://www.airbnb.com/login` — fill email + password — submit
- Wait for redirect; check `detectSessionExpired()` from `agents/data-collection/session-manager.ts`
- If logged in: get cookies via `context.cookies()` → pass to `persistSession(accountId, cookies)`
- Navigate to one performance page (e.g. `/performance/conversion/conversion_rate?listing_id=<id>`)
- Take a screenshot at `/tmp/airbnb-smoke-<userid>.png`
- Report success/failure

Reference existing code:
- `agents/data-collection/session-manager.ts` — encrypted session storage (DONE — use as-is)
- `agents/data-collection/airbnb-scraper.ts` — `scrapeAirbnbAccount` function — the auth context + scrape pattern you're replicating
- `agents/data-collection/page-scrapers.ts` — actual page parsers (you don't need to invoke; just confirm login works first)

Things to watch for:
- Airbnb MFA prompts on first login — may need `headless: false` so user can solve in browser
- Cloudflare challenges — Playwright stealth helpers may be needed if blocked
- The `last_successful_login` field gets updated by `persistSession()` — confirm it lands in DB

### Step 7: if smoke test works → wire up real scraping

Once one account logs in cleanly:
1. Repeat smoke test for the other 6 accounts (will need to be done interactively if MFA fires)
2. Run `npm run agent:weekly-scan` — this triggers the existing `airbnb-scraper.ts` pipeline against ALL 7 accounts and writes to `lc_metric_snapshots`
3. Verify with: `SELECT COUNT(*), COUNT(DISTINCT property_id), MAX(snapshot_date) FROM lc_metric_snapshots;`

### Step 8: retire the dead public-scrape path

Once authenticated scraping works:
1. Remove the `agent:public-scrape` cron entry from `vercel.json` (it currently runs weekly Sundays 3am)
2. Optionally `git mv agents/listing-scraper/airbnb-public.ts agents/listing-scraper/_deprecated/`
3. Mark `lc_listing_performance` table as deprecated in favor of `lc_metric_snapshots` (richer schema)
4. Keep `lc_listing_presence`, `lc_listing_content_snapshot`, `lc_listing_health_score` — they add value the existing pipeline doesn't have (reconciliation, content drift, composite health)

### Step 9: tighten the `airbnb_user_id` constraint

After seed populates all 7 accounts:
```sql
ALTER TABLE lc_airbnb_accounts
  ALTER COLUMN airbnb_user_id SET NOT NULL,
  ADD CONSTRAINT lc_airbnb_accounts_airbnb_user_id_unique UNIQUE (airbnb_user_id);
```

---

## Decisions log (so you don't have to re-litigate)

Per Jason on 2026-05-12:

1. **Wipe + re-seed (option B)** chosen over in-place update — clean slate since product isn't live yet.
2. **Wipe the 2,379 placeholder metric snapshots** — they're seed data, never came from a real scrape.
3. **Skip the 71 unmatched xlsx listings for v1** — defer to a future Streamline cron that pulls missing units.
4. **`.env.local` over Supabase Vault / Vercel env vars** — for v1; revisit when more team members need access.
5. **Existing authenticated scraper (`agents/data-collection/airbnb-scraper.ts`) is the path forward** — not the public scraper from D-1 spec.

---

## Open questions for Jason (parking lot)

1. **Where does `lc_properties` come from?** I assume it's seeded from Streamline. Find the Streamline import script (or cron) — it owns the lifecycle for the 71 missing listings.
2. **What's the right cadence?** Existing `agent:weekly-scan` cron isn't in `vercel.json` yet. When to flip it on?
3. **Should `122210813` (the 7th account with 0 listings in current xlsx) be `is_active = false` until it has listings?** Currently set `is_active = true` in seed.
4. **The 15 active properties in `lc_properties` without an `airbnb_listing_id`** — are those VRBO-only? Or just missing data?
5. **Phase D-2 (VRBO public scrape)** and **Phase D-3 (Wazzi component)** are still in the original spec. With this pivot, do they still make sense, or should we accelerate the VRBO equivalent of `airbnb-scraper.ts`?

---

## Reference: the xlsx that started the pivot

- **Local path:** `/Users/jasonpratts/Downloads/AirBnB Listings.xlsx` (Jason's machine; not in repo)
- **Sheet:** `Listing Details`, 1,107 rows, 5 columns
- **Columns:** `Airbnb User Id (Admin/Owner)`, `Account Name`, `Airbnb Listing ID`, `Listing Title`, `Listing Geo`
- **CSV dump available at `/tmp/airbnb_listings.csv`** (Jason's machine; regenerate from xlsx if needed via the import script's xlsx loader)

---

## Key files to read first

1. This document
2. `docs/superpowers/specs/2026-04-15-listing-visibility-diagnostic-layer.md` — original D-1 spec (context only; superseded in parts)
3. `agents/data-collection/airbnb-scraper.ts` — the production-ready authenticated scraper
4. `agents/data-collection/session-manager.ts` — encrypted session pattern (read this before writing smoke-test)
5. `supabase/migrations/20260503000001_wipe_placeholders_add_airbnb_user_id.sql` — the migration to apply
6. `scripts/seed-real-airbnb-accounts.ts` — the seed
7. `scripts/import-airbnb-listings-from-xlsx.ts` — the import

---

## Contact

- **Jason** for: decisions, credentials, Streamline access, business context
- **Casago corporate** for: Streamline production access if needed
- **This handoff doc** lives at `docs/handoff/2026-05-12-d1-revised-brendon.md` — update it as you complete steps so the next person picking this up has a current state.

Good luck — most of the heavy lifting is done. Steps 1–5 should take <1 hour. Step 6 (smoke test) is the only unknown — budget half a day in case Airbnb MFA / Cloudflare gets in the way.
