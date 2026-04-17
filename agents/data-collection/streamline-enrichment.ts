import { getSupabase } from '@/lib/supabase';
import { callStreamline } from '@/lib/streamline';
import { notifySlack } from './slack-notifier';

// ============================================================
// TYPES
// ============================================================

interface StreamlinePropertyInfo {
  unit_id: number;
  name: string;
  bedrooms_number?: number;
  bathrooms_number?: number;
  max_occupants?: number;
  condo_type_name?: string;
  home_type_name?: string;
}

interface EnrichmentResult {
  properties_enriched: number;
  properties_failed: number;
  duration_seconds: number;
  errors: Array<{ streamline_unit_id: string; error: string }>;
}

// ============================================================
// CONSTANTS
// ============================================================

const MAX_CONCURRENT = 10;
const BATCH_DELAY_MS = 200;
const MAX_RETRIES = 3;
const RETRY_BASE_DELAY_MS = 1000; // 1s, 2s, 4s exponential backoff (max 30s)
const RETRY_MAX_DELAY_MS = 30000;

// ============================================================
// ENRICHMENT PIPELINE
// ============================================================

/**
 * Run the Streamline enrichment pipeline for all active properties.
 *
 * Process:
 * 1. Load all active properties from lc_properties
 * 2. Prioritize Red/Orange health status properties first
 * 3. Call GetPropertyInfo for each (rate-limited: 10 concurrent, 200ms delay)
 * 4. Update lc_properties with fresh data
 * 5. Report results
 *
 * This is called by the main scraper after Airbnb scraping completes.
 */
export async function runStreamlineEnrichment(): Promise<EnrichmentResult> {
  const supabase = getSupabase();
  const startTime = Date.now();
  const errors: Array<{ streamline_unit_id: string; error: string }> = [];
  let enriched = 0;
  let failed = 0;

  // 1. Load all active properties with their current health status
  const { data: properties, error: loadError } = await supabase
    .from('lc_properties')
    .select('id, streamline_unit_id')
    .eq('is_active', true)
    .not('streamline_unit_id', 'is', null);

  if (loadError || !properties) {
    throw new Error(`Failed to load properties for enrichment: ${loadError?.message}`);
  }

  // 2. Load latest health status for prioritization
  const { data: latestSnapshots } = await supabase
    .from('lc_latest_snapshots')
    .select('property_id, health_status');

  const healthMap = new Map<string, string>();
  if (latestSnapshots) {
    for (const s of latestSnapshots) {
      healthMap.set(s.property_id, s.health_status);
    }
  }

  // 3. Sort: Red first, then Orange, then Yellow, then Green, then Blue, then unknown
  const priorityOrder: Record<string, number> = {
    'red': 0,
    'orange': 1,
    'yellow': 2,
    'green': 3,
    'blue_spell': 4,
    'unknown': 5,
  };

  const sorted = [...properties].sort((a, b) => {
    const aPriority = priorityOrder[healthMap.get(a.id) || 'unknown'] ?? 5;
    const bPriority = priorityOrder[healthMap.get(b.id) || 'unknown'] ?? 5;
    return aPriority - bPriority;
  });

  console.log(`[Enrichment] Starting enrichment for ${sorted.length} properties`);
  console.log(`[Enrichment] Priority order: Red/Orange first, Green/Blue last`);

  // 4. Process in batches of MAX_CONCURRENT
  for (let i = 0; i < sorted.length; i += MAX_CONCURRENT) {
    const batch = sorted.slice(i, i + MAX_CONCURRENT);

    const batchResults = await Promise.allSettled(
      batch.map(prop => enrichSingleProperty(prop.id, prop.streamline_unit_id))
    );

    for (let j = 0; j < batchResults.length; j++) {
      const result = batchResults[j];
      if (result.status === 'fulfilled') {
        enriched++;
      } else {
        failed++;
        errors.push({
          streamline_unit_id: batch[j].streamline_unit_id,
          error: result.reason?.message || String(result.reason),
        });
      }
    }

    // Delay between batches (not after the last batch)
    if (i + MAX_CONCURRENT < sorted.length) {
      await new Promise(resolve => setTimeout(resolve, BATCH_DELAY_MS));
    }

    // Progress logging every 100 properties
    if ((i + MAX_CONCURRENT) % 100 < MAX_CONCURRENT) {
      console.log(`[Enrichment] Progress: ${Math.min(i + MAX_CONCURRENT, sorted.length)}/${sorted.length}`);
    }
  }

  const durationSeconds = Math.round((Date.now() - startTime) / 1000);

  const result: EnrichmentResult = {
    properties_enriched: enriched,
    properties_failed: failed,
    duration_seconds: durationSeconds,
    errors,
  };

  console.log(
    `[Enrichment] Complete: ${enriched} enriched, ${failed} failed, ${durationSeconds}s`
  );

  // Alert on high failure rate (> 10%)
  if (failed > 0 && (failed / sorted.length) > 0.1) {
    await notifySlack(
      `ENRICHMENT WARNING: ${failed}/${sorted.length} properties failed Streamline enrichment. ` +
      `Top errors: ${errors.slice(0, 3).map(e => e.error).join('; ')}`,
      '#listing-center-alerts',
    );
  }

  return result;
}

/**
 * Enrich a single property from Streamline.
 * Calls GetPropertyInfo and updates lc_properties.
 * Includes exponential backoff retry logic.
 */
async function enrichSingleProperty(
  propertyId: string,
  streamlineUnitId: string,
): Promise<void> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const data = await callStreamline('GetPropertyInfo', {
        unit_id: parseInt(streamlineUnitId, 10),
      }) as StreamlinePropertyInfo;

      if (!data) {
        throw new Error(`No data returned for unit ${streamlineUnitId}`);
      }

      // Determine property type from Streamline's type fields
      const propertyType = data.home_type_name?.toLowerCase()
        || data.condo_type_name?.toLowerCase()
        || null;

      // Update the property record
      const supabase = getSupabase();
      const { error } = await supabase
        .from('lc_properties')
        .update({
          property_name: data.name || undefined,
          bedrooms: data.bedrooms_number ?? null,
          bathrooms: data.bathrooms_number ?? null,
          max_occupancy: data.max_occupants ?? null,
          property_type: propertyType,
          updated_at: new Date().toISOString(),
        })
        .eq('id', propertyId);

      if (error) {
        throw new Error(`DB update failed: ${error.message}`);
      }

      return; // Success — exit retry loop
    } catch (err: unknown) {
      lastError = err instanceof Error ? err : new Error(String(err));

      // Calculate backoff delay: 1s, 2s, 4s, ... up to 30s
      const backoffMs = Math.min(
        RETRY_BASE_DELAY_MS * Math.pow(2, attempt),
        RETRY_MAX_DELAY_MS,
      );

      console.warn(
        `[Enrichment] Attempt ${attempt + 1}/${MAX_RETRIES} failed for unit ${streamlineUnitId}: ${lastError.message}. ` +
        `Retrying in ${backoffMs}ms...`
      );

      await new Promise(resolve => setTimeout(resolve, backoffMs));
    }
  }

  throw lastError || new Error(`Enrichment failed for unit ${streamlineUnitId} after ${MAX_RETRIES} attempts`);
}

/**
 * Run a targeted enrichment for specific properties (used by spot-check).
 */
export async function enrichSpecificProperties(propertyIds: string[]): Promise<EnrichmentResult> {
  const supabase = getSupabase();
  const startTime = Date.now();
  const errors: Array<{ streamline_unit_id: string; error: string }> = [];
  let enriched = 0;
  let failed = 0;

  const { data: properties, error: loadError } = await supabase
    .from('lc_properties')
    .select('id, streamline_unit_id')
    .in('id', propertyIds);

  if (loadError || !properties) {
    throw new Error(`Failed to load properties: ${loadError?.message}`);
  }

  for (let i = 0; i < properties.length; i += MAX_CONCURRENT) {
    const batch = properties.slice(i, i + MAX_CONCURRENT);

    const batchResults = await Promise.allSettled(
      batch.map(prop => enrichSingleProperty(prop.id, prop.streamline_unit_id))
    );

    for (let j = 0; j < batchResults.length; j++) {
      if (batchResults[j].status === 'fulfilled') {
        enriched++;
      } else {
        failed++;
        const reason = (batchResults[j] as PromiseRejectedResult).reason;
        errors.push({
          streamline_unit_id: batch[j].streamline_unit_id,
          error: reason?.message || String(reason),
        });
      }
    }

    if (i + MAX_CONCURRENT < properties.length) {
      await new Promise(resolve => setTimeout(resolve, BATCH_DELAY_MS));
    }
  }

  return {
    properties_enriched: enriched,
    properties_failed: failed,
    duration_seconds: Math.round((Date.now() - startTime) / 1000),
    errors,
  };
}
