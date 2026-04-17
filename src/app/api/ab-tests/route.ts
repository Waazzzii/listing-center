export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';

export async function GET(req: NextRequest) {
  const supabase = getSupabase();
  const { searchParams } = new URL(req.url);

  let query = supabase
    .from('lc_ab_tests')
    .select('*, lc_properties(property_name, market)')
    .order('created_at', { ascending: false });

  const status = searchParams.get('status');
  if (status) query = query.eq('status', status);

  const propertyId = searchParams.get('property_id');
  if (propertyId) query = query.eq('property_id', propertyId);

  const { data, error } = await query;

  if (error) return NextResponse.json({ message: error.message }, { status: 500 });

  const { count: activeCount } = await supabase
    .from('lc_ab_tests')
    .select('id', { count: 'exact', head: true })
    .in('status', ['pending', 'active', 'snapshot_due']);

  return NextResponse.json({ data, active_count: activeCount });
}

export async function POST(req: NextRequest) {
  const supabase = getSupabase();
  const body = await req.json();

  const { data, error } = await supabase.from('lc_ab_tests').insert(body).select().single();

  if (error) return NextResponse.json({ message: error.message }, { status: 500 });
  return NextResponse.json({ data }, { status: 201 });
}
