export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';
import { isMockMode, mockCommandGridResponse } from '@/lib/mock-data';

// Split into two queries to work around Supabase JS client bug
// where wide views silently drop columns. Core data + rev projections merged server-side.
const CORE_COLUMNS = [
  'property_id', 'property_name', 'market', 'quality_tier', 'quality_tier_numeric',
  'airbnb_listing_id', 'vrbo_listing_id', 'booking_property_id',
  'bedrooms', 'property_type', 'is_active',
  'snapshot_date', 'airbnb_first_page_impression_rate', 'airbnb_search_to_listing_ctr',
  'airbnb_listing_to_booking_conversion', 'airbnb_overall_conversion_rate',
  'airbnb_page_views', 'airbnb_wishlist_additions', 'airbnb_overall_rating',
  'airbnb_review_count', 'airbnb_avg_nightly_rate', 'airbnb_occupancy_rate',
  'health_status', 'previous_health_status', 'priority_score', 'funnel_bottleneck',
  'wh_occupancy_30d', 'wh_occupancy_120d', 'wh_asking_rate', 'wh_revpar',
  'wh_base_price', 'wh_recommended_price', 'wh_price_alignment',
  'wh_anchor_credibility', 'wh_auto_rates', 'wh_flags', 'wh_last_booked', 'wh_booked_30d',
  'health_score', 'health_grade', 'health_score_prev', 'health_score_delta', 'channels_active',
  'pending_actions', 'active_tests',
  'proposed_actions', 'approved_actions', 'executing_actions', 'completed_actions_7d',
].join(',');

const REV_COLUMNS = [
  'property_id', 'rev_projected', 'rev_booked', 'rev_actual', 'rev_pct_to_proj', 'rev_pace_status',
].join(',');

const SUMMARY_COLUMNS = [
  'total_properties', 'avg_health_score',
  'grade_a_count', 'grade_b_count', 'grade_c_count', 'grade_d_count', 'unscored_count',
  'avg_revpar', 'avg_occupancy_30d', 'avg_occupancy_120d',
  'total_pending_actions', 'total_active_tests', 'avg_price_alignment',
  'total_proposed_actions', 'total_approved_actions', 'total_executing_actions', 'total_completed_actions_7d',
].join(',');

const SUMMARY_REV_COLUMNS = [
  'avg_pct_to_projection',
  'pace_ahead_count', 'pace_on_track_count', 'pace_behind_count', 'pace_at_risk_count',
].join(',');

export async function GET(req: NextRequest) {
  if (isMockMode()) {
    return NextResponse.json(mockCommandGridResponse());
  }
  const supabase = getSupabase();
  const { searchParams } = new URL(req.url);

  // Build filters
  const filters: Array<{ col: string; val: string }> = [];
  const market = searchParams.get('market');
  if (market) filters.push({ col: 'market', val: market });
  const tier = searchParams.get('quality_tier');
  if (tier) filters.push({ col: 'quality_tier', val: tier });
  const healthStatus = searchParams.get('health_status');
  if (healthStatus) filters.push({ col: 'health_status', val: healthStatus });
  const healthGrade = searchParams.get('health_grade');
  if (healthGrade) filters.push({ col: 'health_grade', val: healthGrade });
  const paceStatus = searchParams.get('pace_status');
  if (paceStatus) filters.push({ col: 'rev_pace_status', val: paceStatus });

  const sortBy = searchParams.get('sort_by') || 'health_score';
  const sortDir = searchParams.get('sort_dir') === 'asc';

  // Query 1: Core data (without rev columns to avoid wide-view bug)
  let coreQuery = supabase.from('lc_command_grid').select(CORE_COLUMNS);
  for (const f of filters) coreQuery = coreQuery.eq(f.col, f.val);
  coreQuery = coreQuery.order(sortBy, { ascending: sortDir, nullsFirst: false });

  // Query 2: Revenue projections (narrow query)
  let revQuery = supabase.from('lc_command_grid').select(REV_COLUMNS);
  for (const f of filters) revQuery = revQuery.eq(f.col, f.val);

  // Query 3+4: Summary (split same way)
  const summaryCore = supabase.from('lc_command_grid_summary').select(SUMMARY_COLUMNS);
  const summaryRev = supabase.from('lc_command_grid_summary').select(SUMMARY_REV_COLUMNS);

  // Run all in parallel
  const [coreResult, revResult, sumCorResult, sumRevResult] = await Promise.all([
    coreQuery, revQuery, summaryCore, summaryRev,
  ]);

  if (coreResult.error) return NextResponse.json({ message: coreResult.error.message }, { status: 500 });

  // Merge revenue data into core rows
  const revMap = new Map<string, Record<string, unknown>>();
  if (revResult.data) {
    for (const r of revResult.data as unknown as Record<string, unknown>[]) {
      revMap.set(r.property_id as string, r);
    }
  }

  const coreRows = (coreResult.data || []) as unknown as Record<string, unknown>[];
  const data = coreRows.map((row: Record<string, unknown>) => {
    const rev = revMap.get(row.property_id as string);
    return {
      ...row,
      rev_projected: rev?.rev_projected ?? null,
      rev_booked: rev?.rev_booked ?? null,
      rev_actual: rev?.rev_actual ?? null,
      rev_pct_to_proj: rev?.rev_pct_to_proj ?? null,
      rev_pace_status: rev?.rev_pace_status ?? null,
    };
  });

  // Merge summary
  const summaryBase = sumCorResult.data?.[0] ?? {};
  const summaryRevData = sumRevResult.data?.[0] ?? {};
  const summary = { ...summaryBase, ...summaryRevData };

  return NextResponse.json({ data, summary: Object.keys(summary).length > 0 ? summary : null });
}
