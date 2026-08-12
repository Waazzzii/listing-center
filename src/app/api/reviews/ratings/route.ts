export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';
import { isMockMode, mockPendingRatings } from '@/lib/mock-data';

export async function GET() {
  if (isMockMode()) {
    const data = mockPendingRatings();
    return NextResponse.json({ data, urgent_count: data.filter((r) => r.is_urgent).length });
  }
  const supabase = getSupabase();

  const { data, error } = await supabase
    .from('lc_guest_ratings_with_urgency')
    .select('*, lc_properties(property_name, market)')
    .order('rating_deadline', { ascending: true });

  if (error) return NextResponse.json({ message: error.message }, { status: 500 });

  const urgentCount = data?.filter((r: { is_urgent: boolean }) => r.is_urgent).length || 0;

  return NextResponse.json({ data, urgent_count: urgentCount });
}
