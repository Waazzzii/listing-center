export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';

export async function GET() {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('lc_benchmarks')
    .select('*')
    .eq('is_active', true)
    .order('quality_tier');

  if (error) return NextResponse.json({ message: error.message }, { status: 500 });
  return NextResponse.json({ data });
}

export async function PUT(req: NextRequest) {
  const supabase = getSupabase();
  const body = await req.json();

  if (!body.id) return NextResponse.json({ message: 'id is required' }, { status: 400 });

  const { data, error } = await supabase
    .from('lc_benchmarks')
    .update({ ...body, updated_at: new Date().toISOString() })
    .eq('id', body.id)
    .select()
    .single();

  if (error) return NextResponse.json({ message: error.message }, { status: 500 });
  return NextResponse.json({ data });
}
