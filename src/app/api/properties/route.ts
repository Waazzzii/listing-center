export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';
import { validatePropertyInput } from '@/lib/validators';
import { isMockMode, mockProperties, mockPropertyByUnitId } from '@/lib/mock-data';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);

  if (isMockMode()) {
    const streamlineId = searchParams.get('streamline_unit_id');
    if (streamlineId) {
      const single = mockPropertyByUnitId(streamlineId);
      return NextResponse.json({ data: single ? [single] : [], count: single ? 1 : 0 });
    }
    const all = mockProperties();
    return NextResponse.json({ data: all, count: all.length });
  }

  const supabase = getSupabase();

  let query = supabase.from('lc_properties').select('*', { count: 'exact' }).eq('is_active', true);

  const streamlineId = searchParams.get('streamline_unit_id');
  if (streamlineId) query = query.eq('streamline_unit_id', streamlineId);

  const market = searchParams.get('market');
  if (market) query = query.eq('market', market);

  const tier = searchParams.get('quality_tier');
  if (tier) query = query.eq('quality_tier', tier);

  const limit = parseInt(searchParams.get('limit') || '100');
  const offset = parseInt(searchParams.get('offset') || '0');
  query = query.range(offset, offset + limit - 1).order('property_name');

  const { data, error, count } = await query;

  if (error) return NextResponse.json({ message: error.message }, { status: 500 });
  return NextResponse.json({ data, count });
}

export async function POST(req: NextRequest) {
  const supabase = getSupabase();
  const body = await req.json();

  const validation = validatePropertyInput(body);
  if (!validation.success) {
    return NextResponse.json({ message: 'Validation failed', errors: validation.error.issues }, { status: 400 });
  }

  const { data, error } = await supabase.from('lc_properties').insert(validation.data).select().single();

  if (error) return NextResponse.json({ message: error.message }, { status: 500 });
  return NextResponse.json({ data }, { status: 201 });
}
