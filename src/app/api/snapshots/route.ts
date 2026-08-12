export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';
import { isMockMode, mockSnapshots } from '@/lib/mock-data';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);

  const propertyId = searchParams.get('property_id');
  if (!propertyId) {
    return NextResponse.json({ message: 'property_id is required' }, { status: 400 });
  }

  if (isMockMode()) {
    const limit = parseInt(searchParams.get('limit') || '12');
    return NextResponse.json({ data: mockSnapshots(propertyId, limit) });
  }

  const supabase = getSupabase();

  let query = supabase
    .from('lc_metric_snapshots')
    .select('*')
    .eq('property_id', propertyId)
    .order('snapshot_date', { ascending: false });

  const since = searchParams.get('since');
  if (since) query = query.gte('snapshot_date', since);

  const limit = parseInt(searchParams.get('limit') || '52');
  query = query.limit(limit);

  const { data, error } = await query;

  if (error) return NextResponse.json({ message: error.message }, { status: 500 });
  return NextResponse.json({ data });
}
