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

import { config as loadEnv } from 'dotenv';
loadEnv({ path: '.env.local' });
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
  const id = listingId.trim();
  if (!id) return null;
  const encoded = encodeURIComponent(id);
  if (ota === 'airbnb') return `https://www.airbnb.com/rooms/${encoded}`;
  if (ota === 'vrbo') return `https://www.vrbo.com/${encoded}`;
  if (ota === 'booking') return `https://www.booking.com/hotel/${encoded}.html`;
  return null;
}

async function main(): Promise<void> {
  const supabase = getSupabase();

  console.log('Fetching active properties…');
  const PAGE = 1000;
  const rows: PropertyRow[] = [];
  for (let offset = 0; ; offset += PAGE) {
    const { data, error } = await supabase
      .from('lc_properties')
      .select('id, airbnb_listing_id, vrbo_listing_id, booking_property_id')
      .eq('is_active', true)
      .order('id', { ascending: true })
      .range(offset, offset + PAGE - 1);
    if (error) throw new Error(`fetch lc_properties (offset=${offset}) failed: ${error.message}`);
    const page = (data ?? []) as PropertyRow[];
    rows.push(...page);
    if (page.length < PAGE) break;
  }
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
