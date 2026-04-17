export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';

export async function GET(req: NextRequest) {
  const supabase = getSupabase();
  const { searchParams } = new URL(req.url);
  const propertyId = searchParams.get('property_id');

  if (!propertyId) {
    return NextResponse.json({ message: 'property_id is required' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('lc_revenue_projections')
    .select('*')
    .eq('property_id', propertyId)
    .order('projection_date', { ascending: false })
    .limit(1);

  if (error) return NextResponse.json({ message: error.message }, { status: 500 });

  return NextResponse.json({ data: data?.[0] ?? null });
}
