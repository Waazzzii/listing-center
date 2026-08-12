/**
 * Seed the 7 real Airbnb accounts into lc_airbnb_accounts.
 *
 * Reads account emails from .env.local (one block per Airbnb User ID).
 * Account names + market mappings come from the AirBnB Listings.xlsx report.
 *
 * Passwords are NEVER stored in the database. They live only in .env.local
 * and are read into memory at runtime by the scraper for first-time login,
 * after which encrypted session cookies are persisted to lc_airbnb_accounts.session_data.
 *
 * Idempotent: uses upsert on airbnb_user_id. Safe to re-run.
 *
 * Usage:  npm run seed:real-airbnb-accounts
 *
 * Prerequisites:
 *   1. Migration 20260503000001 applied (adds airbnb_user_id column, wipes placeholders).
 *   2. .env.local contains:
 *        SUPABASE_URL
 *        SUPABASE_SERVICE_KEY
 *        AIRBNB_ACCT_<userid>_EMAIL  (for each of the 7 user IDs below)
 */

import 'dotenv/config';
import { getSupabase } from '@/lib/supabase';

interface AccountConfig {
  airbnb_user_id: number;
  account_name: string;
  markets: string[];
  expected_listing_count: number;
}

/**
 * Source of truth: the AirBnB Listings.xlsx report (1,107 listings).
 * The 7th account (122210813) has no listings in this report but is an
 * active credentialed account per Jason's .env.local; included for
 * completeness so future imports can attribute to it.
 */
const ACCOUNTS: AccountConfig[] = [
  {
    airbnb_user_id: 104930499,
    account_name: 'Casago Arizona Flannery',
    markets: ['phoenix', 'tucson', 'sedona', 'flagstaff', 'scottsdale'],
    expected_listing_count: 261,
  },
  {
    airbnb_user_id: 122210813,
    account_name: 'Casago Arizona (CasagoAZ)',
    markets: ['phoenix', 'tucson'],
    expected_listing_count: 0, // Not in current xlsx; future imports may attribute
  },
  {
    airbnb_user_id: 131765587,
    account_name: 'Casago Coachella Valley Rasky',
    markets: ['coachella', 'palm-springs', 'idyllwild', 'temecula'],
    expected_listing_count: 400,
  },
  {
    airbnb_user_id: 137854275,
    account_name: 'ACME House Company Flannery',
    markets: ['phoenix', 'tucson', 'sedona'],
    expected_listing_count: 161,
  },
  {
    airbnb_user_id: 162858310,
    account_name: 'Casago Arizona Flannery (Secondary)',
    markets: ['phoenix', 'tucson', 'high-desert'],
    expected_listing_count: 282,
  },
  {
    airbnb_user_id: 48722591,
    account_name: 'Casago Flannery (Legacy 1)',
    markets: ['coachella'],
    expected_listing_count: 2,
  },
  {
    airbnb_user_id: 6201646,
    account_name: 'Casago Flannery (Legacy 2)',
    markets: ['coachella'],
    expected_listing_count: 1,
  },
];

function envEmailFor(userId: number): string {
  const key = `AIRBNB_ACCT_${userId}_EMAIL`;
  const value = process.env[key];
  if (!value) {
    throw new Error(
      `Missing ${key} in .env.local. Please add it (and the corresponding _PASSWORD) before running this seed.`,
    );
  }
  return value;
}

async function main(): Promise<void> {
  const supabase = getSupabase();

  // Pre-flight: confirm airbnb_user_id column exists (migration applied).
  const { data: cols, error: colErr } = await supabase
    .from('lc_airbnb_accounts')
    .select('airbnb_user_id')
    .limit(0);
  if (colErr) {
    throw new Error(
      `Cannot read lc_airbnb_accounts.airbnb_user_id: ${colErr.message}\n` +
        'Did you apply migration 20260503000001 in the Supabase SQL Editor?',
    );
  }
  void cols;

  console.log(`Seeding ${ACCOUNTS.length} real Airbnb accounts...`);

  let inserted = 0;
  let updated = 0;

  for (const acct of ACCOUNTS) {
    const email = envEmailFor(acct.airbnb_user_id);

    const { data: existing } = await supabase
      .from('lc_airbnb_accounts')
      .select('id')
      .eq('airbnb_user_id', acct.airbnb_user_id)
      .maybeSingle();

    if (existing) {
      const { error } = await supabase
        .from('lc_airbnb_accounts')
        .update({
          account_name: acct.account_name,
          account_email: email,
          markets: acct.markets,
          listing_count: acct.expected_listing_count,
          is_active: true,
        })
        .eq('id', existing.id);
      if (error) throw new Error(`update failed for ${acct.airbnb_user_id}: ${error.message}`);
      updated++;
      console.log(`  [updated] id=${existing.id} user=${acct.airbnb_user_id} ${acct.account_name}`);
    } else {
      const { data, error } = await supabase
        .from('lc_airbnb_accounts')
        .insert({
          airbnb_user_id: acct.airbnb_user_id,
          account_name: acct.account_name,
          account_email: email,
          markets: acct.markets,
          listing_count: acct.expected_listing_count,
          is_active: true,
        })
        .select('id')
        .single();
      if (error) throw new Error(`insert failed for ${acct.airbnb_user_id}: ${error.message}`);
      inserted++;
      console.log(`  [inserted] id=${data?.id} user=${acct.airbnb_user_id} ${acct.account_name}`);
    }
  }

  console.log(`\nDone. inserted=${inserted} updated=${updated}\n`);
  console.log('Next steps:');
  console.log('  1. Run: npm run import:airbnb-listings');
  console.log('  2. Smoke-test login for one account (Step C — TBD)');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
