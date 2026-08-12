export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';

// Columns to select from the materialized view (select('*') fails on wide mat views)
const SNAPSHOT_COLUMNS = [
  'id', 'property_id', 'snapshot_date', 'snapshot_source', 'scrape_completeness',
  'airbnb_overall_conversion_rate', 'airbnb_first_page_impression_rate',
  'airbnb_search_to_listing_ctr', 'airbnb_listing_to_booking_conversion',
  'airbnb_page_views', 'airbnb_first_page_impressions', 'airbnb_wishlist_additions',
  'airbnb_occupancy_rate', 'airbnb_nights_booked', 'airbnb_avg_nightly_rate',
  'airbnb_overall_rating', 'airbnb_5star_overall_pct', 'airbnb_review_count',
  'airbnb_superhost_status', 'airbnb_has_issues',
  'health_status', 'previous_health_status', 'priority_score', 'funnel_bottleneck',
  'property_name', 'market', 'quality_tier', 'quality_tier_numeric',
  'airbnb_listing_id', 'bedrooms', 'property_type', 'is_active',
].join(',');

export async function GET(req: NextRequest) {
  const supabase = getSupabase();
  const { searchParams } = new URL(req.url);

  let query = supabase.from('lc_latest_snapshots').select(SNAPSHOT_COLUMNS);

  const market = searchParams.get('market');
  if (market) query = query.eq('market', market);

  const tier = searchParams.get('quality_tier');
  if (tier) query = query.eq('quality_tier', tier);

  const healthStatus = searchParams.get('health_status');
  if (healthStatus) query = query.eq('health_status', healthStatus);

  const sortBy = searchParams.get('sort_by') || 'priority_score';
  const sortDir = searchParams.get('sort_dir') === 'asc';
  query = query.order(sortBy, { ascending: sortDir, nullsFirst: false });

  const { data, error } = await query;

  if (error) return NextResponse.json({ message: error.message }, { status: 500 });

  const { data: summaryArr } = await supabase.from('lc_portfolio_summary').select('*');
  const summary = summaryArr?.[0] ?? null;

  return NextResponse.json({ data, summary });
}
