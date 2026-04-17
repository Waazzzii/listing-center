/**
 * Daily Spot Check — Entry Point
 *
 * Runs daily (Monday-Saturday). Targets Red and Orange health status properties
 * using per-listing scraping mode (?lid parameter) for focused monitoring.
 *
 * Usage:
 *   npx ts-node agents/data-collection/run-spot-check.ts
 *
 * Environment:
 *   Requires all env vars from .env.local
 */

import 'dotenv/config';
import { getSupabase } from '@/lib/supabase';
import { runScrape, ScrapeRunConfig } from './airbnb-scraper';
import { enrichSpecificProperties } from './streamline-enrichment';
import { notifySlack } from './slack-notifier';

async function main() {
  console.log('='.repeat(60));
  console.log('LISTING CENTER — DAILY SPOT CHECK');
  console.log(`Started: ${new Date().toISOString()}`);
  console.log('='.repeat(60));

  const supabase = getSupabase();

  try {
    // 1. Find Red and Orange properties from the latest snapshots
    const { data: flaggedProperties, error } = await supabase
      .from('lc_latest_snapshots')
      .select('property_id, airbnb_listing_id, property_name, health_status')
      .in('health_status', ['red', 'orange'])
      .not('airbnb_listing_id', 'is', null);

    if (error) {
      throw new Error(`Failed to load flagged properties: ${error.message}`);
    }

    if (!flaggedProperties || flaggedProperties.length === 0) {
      console.log('No Red or Orange properties found — spot check not needed.');
      await notifySlack('Daily spot check: No Red/Orange properties to monitor. All clear.');
      return;
    }

    console.log(`Found ${flaggedProperties.length} Red/Orange properties to spot-check:`);
    for (const p of flaggedProperties) {
      console.log(`  - [${p.health_status.toUpperCase()}] ${p.property_name} (${p.airbnb_listing_id})`);
    }

    // 2. Group listing IDs by account for efficient scraping
    // For spot checks, we pass specific listing IDs to filter each page
    const targetListingIds = flaggedProperties
      .map(p => p.airbnb_listing_id)
      .filter((id): id is string => id !== null);

    // 3. Run scrape in spot-check mode
    const config: ScrapeRunConfig = {
      run_type: 'daily_spot_check',
      target_listing_ids: targetListingIds,
    };

    const scrapeResult = await runScrape(config);

    console.log(`\nSpot check scrape: ${scrapeResult.properties_scraped}/${scrapeResult.properties_expected} properties`);

    // 4. Enrichment for flagged properties only
    const propertyIds = flaggedProperties.map(p => p.property_id);
    const enrichResult = await enrichSpecificProperties(propertyIds);

    console.log(`Enrichment: ${enrichResult.properties_enriched} properties updated`);

    // 5. Summary notification
    await notifySlack(
      `:mag: *Daily Spot Check Complete*\n` +
      `Monitored: ${flaggedProperties.length} Red/Orange properties\n` +
      `Scraped: ${scrapeResult.properties_scraped}\n` +
      `Enriched: ${enrichResult.properties_enriched}\n` +
      `Duration: ${Math.round(scrapeResult.duration_seconds / 60)} minutes`,
    );

  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error('\nERROR in spot check:', errMsg);
    await notifySlack(
      `:warning: *Daily Spot Check Failed*\n` +
      `Error: ${errMsg}\n` +
      `Red/Orange properties were not checked today.`,
      '#listing-center-alerts',
    );
    process.exit(1);
  }
}

main();
