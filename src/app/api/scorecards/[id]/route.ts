export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('lc_owner_scorecards')
    .select('*, lc_properties(property_name, market, quality_tier)')
    .eq('id', params.id)
    .single();

  if (error) return NextResponse.json({ message: error.message }, { status: 404 });
  return NextResponse.json({ data });
}
