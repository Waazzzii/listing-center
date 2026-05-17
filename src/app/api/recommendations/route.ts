export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';
import { isMockMode, mockRecommendations } from '@/lib/mock-data';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);

  if (isMockMode()) {
    const propertyId = searchParams.get('property_id');
    const data = mockRecommendations(propertyId);
    return NextResponse.json({
      data,
      pending_count: data.filter((r) => r.status === 'pending').length,
    });
  }

  const supabase = getSupabase();

  let query = supabase
    .from('lc_recommendations')
    .select('*, lc_properties(property_name, market, quality_tier)')
    .order('created_at', { ascending: false });

  const status = searchParams.get('status');
  if (status) query = query.eq('status', status);

  const propertyId = searchParams.get('property_id');
  if (propertyId) query = query.eq('property_id', propertyId);

  const limitParam = searchParams.get('limit');
  const limit = limitParam ? parseInt(limitParam) : 100;
  query = query.limit(limit);

  const { data, error } = await query;

  if (error) return NextResponse.json({ message: error.message }, { status: 500 });

  const { count: pendingCount } = await supabase
    .from('lc_recommendations')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'pending');

  return NextResponse.json({ data, pending_count: pendingCount });
}
