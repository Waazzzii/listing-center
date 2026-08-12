export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';
import { isMockMode, mockScorecards } from '@/lib/mock-data';

export async function GET(req: NextRequest) {
  if (isMockMode()) {
    return NextResponse.json({ data: mockScorecards() });
  }
  const supabase = getSupabase();
  const { searchParams } = new URL(req.url);

  let query = supabase
    .from('lc_owner_scorecards')
    .select('*, lc_properties(property_name, market)')
    .order('report_month', { ascending: false });

  const propertyId = searchParams.get('property_id');
  if (propertyId) query = query.eq('property_id', propertyId);

  const status = searchParams.get('generation_status');
  if (status) query = query.eq('generation_status', status);

  const limit = parseInt(searchParams.get('limit') || '50');
  query = query.limit(limit);

  const { data, error } = await query;

  if (error) return NextResponse.json({ message: error.message }, { status: 500 });
  return NextResponse.json({ data });
}
