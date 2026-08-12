/**
 * Import Airbnb listings from the xlsx report into lc_properties.
 *
 * Source: /Users/jasonpratts/Downloads/AirBnB Listings.xlsx
 *   (or set AIRBNB_LISTINGS_XLSX env var to override the path)
 *
 * What it does:
 *   1. Loads the 7 real accounts from lc_airbnb_accounts (keyed by airbnb_user_id).
 *   2. For each xlsx row, finds the matching lc_properties row by airbnb_listing_id.
 *   3. If matched: UPDATE lc_properties SET airbnb_account_id = <internal id>.
 *   4. If unmatched: write to /tmp/airbnb-listings-unmatched-<timestamp>.csv for review.
 *
 * Per Jason's Decision 3 (2026-05-03): unmatched listings are SKIPPED in v1.
 * Future cron will pull missing units from Streamline and reconcile.
 *
 * Idempotent: re-running just refreshes the airbnb_account_id mappings.
 *
 * Usage:  npm run import:airbnb-listings
 *         npm run import:airbnb-listings -- --dry-run   (preview without writing)
 */

import 'dotenv/config';
import * as XLSX from 'xlsx';
import { writeFileSync } from 'fs';
import { join } from 'path';
import { getSupabase } from '@/lib/supabase';

interface XlsxRow {
  airbnb_user_id: number;
  account_name: string;
  airbnb_listing_id: string;
  listing_title: string;
  listing_geo: string;
}

interface AccountRow {
  id: number;
  airbnb_user_id: number;
  account_name: string;
}

interface PropertyRow {
  id: string;
  airbnb_listing_id: string;
  airbnb_account_id: number | null;
  property_name: string;
}

interface Args {
  dryRun: boolean;
  xlsxPath: string;
}

function parseArgs(): Args {
  const dryRun = process.argv.includes('--dry-run');
  const xlsxPath =
    process.env.AIRBNB_LISTINGS_XLSX ??
    '/Users/jasonpratts/Downloads/AirBnB Listings.xlsx';
  return { dryRun, xlsxPath };
}

function readXlsx(path: string): XlsxRow[] {
  const wb = XLSX.readFile(path);
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const raw: Array<Record<string, unknown>> = XLSX.utils.sheet_to_json(sheet, {
    raw: false,
    defval: '',
  });

  const rows: XlsxRow[] = [];
  for (const r of raw) {
    const userIdRaw = String(r['Airbnb User Id (Admin/Owner)'] ?? '').trim();
    const listingIdRaw = String(r['Airbnb Listing ID'] ?? '').trim();
    if (!userIdRaw || !listingIdRaw) continue;

    rows.push({
      airbnb_user_id: parseInt(userIdRaw, 10),
      account_name: String(r['Account Name'] ?? '').trim(),
      airbnb_listing_id: listingIdRaw,
      listing_title: String(r['Listing Title'] ?? '').trim(),
      listing_geo: String(r['Listing Geo'] ?? '').trim(),
    });
  }
  return rows;
}

async function loadAccounts(): Promise<Map<number, AccountRow>> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('lc_airbnb_accounts')
    .select('id, airbnb_user_id, account_name')
    .not('airbnb_user_id', 'is', null);

  if (error) throw new Error(`loadAccounts failed: ${error.message}`);
  const map = new Map<number, AccountRow>();
  for (const a of data ?? []) {
    if (a.airbnb_user_id != null) {
      map.set(Number(a.airbnb_user_id), a as AccountRow);
    }
  }
  return map;
}

async function loadPropertiesByListingId(): Promise<Map<string, PropertyRow>> {
  const supabase = getSupabase();
  const map = new Map<string, PropertyRow>();
  const PAGE_SIZE = 1000;
  let from = 0;
  while (true) {
    const { data, error } = await supabase
      .from('lc_properties')
      .select('id, airbnb_listing_id, airbnb_account_id, property_name')
      .eq('is_active', true)
      .not('airbnb_listing_id', 'is', null)
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(`loadProperties failed: ${error.message}`);
    if (!data || data.length === 0) break;
    for (const p of data) {
      if (p.airbnb_listing_id) map.set(p.airbnb_listing_id, p as PropertyRow);
    }
    if (data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }
  return map;
}

function writeUnmatchedCsv(rows: XlsxRow[]): string {
  if (rows.length === 0) return '';
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const path = join('/tmp', `airbnb-listings-unmatched-${ts}.csv`);
  const headers = ['airbnb_user_id', 'account_name', 'airbnb_listing_id', 'listing_title', 'listing_geo'];
  const lines = [headers.join(',')];
  for (const r of rows) {
    lines.push(
      [
        r.airbnb_user_id,
        JSON.stringify(r.account_name),
        r.airbnb_listing_id,
        JSON.stringify(r.listing_title),
        JSON.stringify(r.listing_geo),
      ].join(','),
    );
  }
  writeFileSync(path, lines.join('\n') + '\n', 'utf-8');
  return path;
}

async function main(): Promise<void> {
  const args = parseArgs();
  const supabase = getSupabase();

  console.log(`Reading xlsx: ${args.xlsxPath}`);
  const xlsxRows = readXlsx(args.xlsxPath);
  console.log(`  ${xlsxRows.length} listings found in xlsx`);

  console.log('Loading account map (airbnb_user_id → internal id)...');
  const accountMap = await loadAccounts();
  console.log(`  ${accountMap.size} real Airbnb accounts in DB`);

  console.log('Loading lc_properties indexed by airbnb_listing_id...');
  const propMap = await loadPropertiesByListingId();
  console.log(`  ${propMap.size} active properties have airbnb_listing_id`);

  const matched: Array<{ unitId: string; airbnbAccountId: number; listingId: string }> = [];
  const unmatchedListings: XlsxRow[] = [];
  const unknownAccounts = new Set<number>();

  for (const row of xlsxRows) {
    const account = accountMap.get(row.airbnb_user_id);
    if (!account) {
      unknownAccounts.add(row.airbnb_user_id);
      unmatchedListings.push(row);
      continue;
    }
    const property = propMap.get(row.airbnb_listing_id);
    if (!property) {
      unmatchedListings.push(row);
      continue;
    }
    matched.push({
      unitId: property.id,
      airbnbAccountId: account.id,
      listingId: row.airbnb_listing_id,
    });
  }

  console.log(`\n=== Match summary ===`);
  console.log(`  Matched (will update):  ${matched.length}`);
  console.log(`  Unmatched (skipped):    ${unmatchedListings.length}`);
  if (unknownAccounts.size > 0) {
    console.log(
      `  Unknown user IDs in xlsx (no row in lc_airbnb_accounts): ${Array.from(unknownAccounts).join(', ')}`,
    );
  }

  if (unmatchedListings.length > 0) {
    const path = writeUnmatchedCsv(unmatchedListings);
    console.log(`  Unmatched CSV: ${path}`);
  }

  if (args.dryRun) {
    console.log('\n[--dry-run] Skipping writes. Re-run without --dry-run to apply.');
    return;
  }

  console.log(`\nApplying ${matched.length} updates in batches of 100...`);
  const BATCH = 100;
  let written = 0;
  for (let i = 0; i < matched.length; i += BATCH) {
    const batch = matched.slice(i, i + BATCH);
    // Group by airbnbAccountId so we can run one UPDATE per account with WHERE id IN (...)
    const byAccount = new Map<number, string[]>();
    for (const m of batch) {
      const list = byAccount.get(m.airbnbAccountId) ?? [];
      list.push(m.unitId);
      byAccount.set(m.airbnbAccountId, list);
    }
    for (const [accountId, unitIds] of Array.from(byAccount.entries())) {
      const { error } = await supabase
        .from('lc_properties')
        .update({ airbnb_account_id: accountId })
        .in('id', unitIds);
      if (error) {
        throw new Error(`Update batch failed (account=${accountId}, count=${unitIds.length}): ${error.message}`);
      }
      written += unitIds.length;
    }
    console.log(`  Updated ${Math.min(i + BATCH, matched.length)} / ${matched.length}`);
  }

  console.log(`\nDone. ${written} property rows updated with their real airbnb_account_id.\n`);
  console.log('Verification SQL:');
  console.log('  SELECT airbnb_account_id, COUNT(*) FROM lc_properties');
  console.log("  WHERE is_active = true AND airbnb_account_id IS NOT NULL");
  console.log('  GROUP BY airbnb_account_id ORDER BY airbnb_account_id;');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
