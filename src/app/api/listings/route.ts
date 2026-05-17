export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';
import { isMockMode, mockListingPresence } from '@/lib/mock-data';

export async function GET() {
  if (isMockMode()) {
    return NextResponse.json({ data: mockListingPresence() });
  }
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('lc_listing_presence')
    .select('*, lc_properties(property_name, market)');
  if (error) return NextResponse.json({ message: error.message }, { status: 500 });
  return NextResponse.json({ data });
}
