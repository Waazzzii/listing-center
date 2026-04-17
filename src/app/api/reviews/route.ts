export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';

export async function GET(req: NextRequest) {
  const supabase = getSupabase();
  const { searchParams } = new URL(req.url);

  let query = supabase
    .from('lc_reviews')
    .select('*, lc_properties(property_name, market)')
    .order('review_date', { ascending: false });

  const propertyId = searchParams.get('property_id');
  if (propertyId) query = query.eq('property_id', propertyId);

  const responseStatus = searchParams.get('response_status');
  if (responseStatus) query = query.eq('response_status', responseStatus);

  const channel = searchParams.get('channel');
  if (channel) query = query.eq('channel', channel);

  const limitParam = searchParams.get('limit');
  const limit = limitParam ? parseInt(limitParam) : 100;
  query = query.limit(limit);

  const { data, error } = await query;

  if (error) return NextResponse.json({ message: error.message }, { status: 500 });
  return NextResponse.json({ data });
}
