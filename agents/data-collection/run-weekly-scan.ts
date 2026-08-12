/**
 * Weekly Full Scan — Entry Point
 *
 * Runs every Sunday night (scheduled by Wazzi agent platform or cron).
 * Scrapes ALL Airbnb accounts across ALL pages, then enriches from Streamline.
 *
 * Usage:
 *   npx ts-node agents/data-collection/run-weekly-scan.ts
 *
 * Environment:
 *   Requires all env vars from .env.local (Supabase, Streamline, Slack, Airbnb encryption key)
 */

import 'dotenv/config';
import { runScrape, ScrapeRunConfig } from './airbnb-scraper';
import { runStreamlineEnrichment } from './streamline-enrichment';
import { notifySlack, notifyEnrichmentComplete } from './slack-notifier';

async function main() {
  const startTime = Date.now();

  console.log('='.repeat(60));
  console.log('LISTING CENTER — WEEKLY FULL SCAN');
  console.log(`Started: ${new Date().toISOString()}`);
  console.log('='.repeat(60));

  try {
    // Phase 1: Airbnb Scraping
    console.log('\n--- Phase 1: Airbnb Performance Scraping ---\n');

    const scrapeConfig: ScrapeRunConfig = {
      run_type: 'weekly_full',
    };

    const scrapeResult = await runScrape(scrapeConfig);

    console.log(`\nScrape complete: ${scrapeResult.properties_scraped}/${scrapeResult.properties_expected} properties`);
    console.log(`Completeness: ${scrapeResult.completeness_pct}%`);
    console.log(`Duration: ${Math.round(scrapeResult.duration_seconds / 60)} minutes`);

    // Phase 2: Streamline Enrichment
    console.log('\n--- Phase 2: Streamline Enrichment ---\n');

    const enrichmentResult = await runStreamlineEnrichment();

    console.log(`\nEnrichment complete: ${enrichmentResult.properties_enriched} properties enriched`);
    console.log(`Duration: ${enrichmentResult.duration_seconds}s`);

    await notifyEnrichmentComplete(enrichmentResult);

    // Summary
    const totalDuration = Math.round((Date.now() - startTime) / 1000);
    console.log('\n' + '='.repeat(60));
    console.log('WEEKLY SCAN COMPLETE');
    console.log(`Total duration: ${Math.round(totalDuration / 60)} minutes`);
    console.log(`Scrape: ${scrapeResult.properties_scraped} properties, ${scrapeResult.completeness_pct}%`);
    console.log(`Enrichment: ${enrichmentResult.properties_enriched} properties`);
    console.log('='.repeat(60));

  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error('\nFATAL ERROR in weekly scan:', errMsg);
    await notifySlack(
      `:rotating_light: *WEEKLY SCAN FAILED*\n` +
      `Error: ${errMsg}\n` +
      `The weekly data collection pipeline has crashed. Dashboard data will be stale.\n` +
      `Check logs and restart manually.`,
      '#listing-center-alerts',
    );
    process.exit(1);
  }
}

main();
