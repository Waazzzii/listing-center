-- 20260503000001_wipe_placeholders_add_airbnb_user_id.sql
-- Phase D-1 Revised: wipe placeholder data, prep for real Airbnb account import.
--
-- Context (per Jason, 2026-05-03):
--   - lc_airbnb_accounts currently has 5 placeholder rows (fake @acmehouse.com emails).
--   - lc_metric_snapshots has 2,379 rows of seed/placeholder data (no real session ever logged in).
--   - Decision B: wipe + re-seed with the 7 real Airbnb accounts from the xlsx + .env.local.
--   - Decision 2: also wipe the placeholder metric snapshots, opportunities, and scrape runs.
--
-- Safe to re-run: every statement is idempotent.

BEGIN;

-- 1. Add airbnb_user_id to lc_airbnb_accounts (nullable for now; a follow-up
--    migration will enforce NOT NULL + UNIQUE after the seed script populates).
ALTER TABLE lc_airbnb_accounts
  ADD COLUMN IF NOT EXISTS airbnb_user_id BIGINT;

CREATE INDEX IF NOT EXISTS idx_lc_airbnb_accounts_user_id
  ON lc_airbnb_accounts(airbnb_user_id);

-- 2. Wipe operational tables that reference airbnb_account_id by value.
--    No FK constraints exist, so order doesn't matter for integrity, but we
--    clear them BEFORE deleting accounts so nothing references stale account IDs.
TRUNCATE TABLE lc_metric_snapshots RESTART IDENTITY;
TRUNCATE TABLE lc_airbnb_opportunities RESTART IDENTITY;
TRUNCATE TABLE lc_scrape_runs RESTART IDENTITY;

-- 3. Null out airbnb_account_id on lc_properties (preserves the property rows;
--    they'll be re-linked to the new account IDs by the import script).
UPDATE lc_properties
  SET airbnb_account_id = NULL
  WHERE airbnb_account_id IS NOT NULL;

-- 4. Wipe the 5 placeholder accounts.
DELETE FROM lc_airbnb_accounts;

-- 5. Reset the SERIAL sequence so the seed script's INSERTs start at id=1 again.
ALTER SEQUENCE lc_airbnb_accounts_id_seq RESTART WITH 1;

COMMIT;

-- ============================================================
-- Post-migration verification (run separately):
-- ============================================================
--
-- SELECT COUNT(*) FROM lc_airbnb_accounts;       -- expect 0
-- SELECT COUNT(*) FROM lc_metric_snapshots;      -- expect 0
-- SELECT COUNT(*) FROM lc_airbnb_opportunities;  -- expect 0
-- SELECT COUNT(*) FROM lc_scrape_runs;           -- expect 0
-- SELECT COUNT(*) FROM lc_properties WHERE airbnb_account_id IS NOT NULL;  -- expect 0
-- SELECT column_name FROM information_schema.columns
--   WHERE table_name='lc_airbnb_accounts' AND column_name='airbnb_user_id';  -- expect 1 row
