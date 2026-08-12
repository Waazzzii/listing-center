import { getSupabase } from '@/lib/supabase';
import type { CommandGridRow } from '@/lib/types';

/**
 * Fetch command grid data using the split-query pattern
 * to avoid the Supabase wide-view column drop bug.
 */
export async function fetchCommandGrid(): Promise<CommandGridRow[]> {
  const supabase = getSupabase();

  const coreColumns = [
    'property_id', 'property_name', 'market', 'quality_tier', 'quality_tier_numeric',
    'airbnb_listing_id', 'vrbo_listing_id', 'booking_property_id',
    'bedrooms', 'property_type', 'is_active',
    'airbnb_first_page_impression_rate', 'airbnb_search_to_listing_ctr',
    'airbnb_listing_to_booking_conversion', 'airbnb_avg_nightly_rate',
    'airbnb_page_views', 'airbnb_overall_rating', 'airbnb_review_count',
    'health_status', 'funnel_bottleneck',
    'wh_occupancy_30d', 'wh_occupancy_120d', 'wh_revpar',
    'wh_base_price', 'wh_recommended_price', 'wh_price_alignment',
    'wh_auto_rates', 'wh_flags',
    'health_score', 'health_grade',
  ].join(',');

  const revColumns = ['property_id', 'rev_pct_to_proj', 'rev_pace_status'].join(',');

  const [coreResult, revResult] = await Promise.all([
    supabase.from('lc_command_grid').select(coreColumns),
    supabase.from('lc_command_grid').select(revColumns),
  ]);

  if (coreResult.error) throw new Error(`Failed to fetch command grid: ${coreResult.error.message}`);

  const revMap = new Map<string, Record<string, unknown>>();
  if (revResult.data) {
    for (const r of revResult.data as unknown as Record<string, unknown>[]) {
      revMap.set(r.property_id as string, r);
    }
  }

  return ((coreResult.data || []) as unknown as Record<string, unknown>[]).map((row) => {
    const rev = revMap.get(row.property_id as string);
    return { ...row, ...rev } as unknown as CommandGridRow;
  });
}
