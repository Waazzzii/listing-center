export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';
import { getCurrentUser } from '@/lib/auth';

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('lc_recommendations')
    .select('*, lc_properties(property_name, market, quality_tier)')
    .eq('id', params.id)
    .single();

  if (error) return NextResponse.json({ message: error.message }, { status: 404 });
  return NextResponse.json({ data });
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = getSupabase();
  const body = await req.json();
  const user = getCurrentUser();

  const allowedStatuses = ['approved', 'rejected', 'deferred'];
  if (!allowedStatuses.includes(body.status)) {
    return NextResponse.json({ message: `status must be one of: ${allowedStatuses.join(', ')}` }, { status: 400 });
  }

  const update: Record<string, unknown> = {
    status: body.status,
    reviewed_by: user.name,
    reviewed_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  if (body.status === 'rejected') update.rejection_reason = body.rejection_reason || null;
  if (body.status === 'deferred') update.defer_until = body.defer_until || null;

  const { data, error } = await supabase
    .from('lc_recommendations')
    .update(update)
    .eq('id', params.id)
    .select()
    .single();

  if (error) return NextResponse.json({ message: error.message }, { status: 500 });
  return NextResponse.json({ data });
}
