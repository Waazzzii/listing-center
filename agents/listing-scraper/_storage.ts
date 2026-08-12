import { getSupabase } from '@/lib/supabase';
import type { ContentSnapshot, ScrapeSource } from './_types';

export interface ContentSnapshotRow {
  unit_id: string;
  ota: string;
  source: string;
  scraped_at: string;
  title: string | null;
  description: string | null;
  photo_count: number | null;
  primary_photo_url: string | null;
  price_shown: number | null;
  rating: number | null;
  review_count: number | null;
  badges: string[];
  cancellation_policy_display: string | null;
  instant_book_enabled: boolean | null;
  amenity_count: number | null;
  amenity_highlights: Record<string, unknown> | null;
  raw_html_ref: string | null;
}

export function buildContentSnapshotRow(snap: ContentSnapshot): ContentSnapshotRow {
  return {
    unit_id: snap.unitId,
    ota: snap.ota,
    source: snap.source,
    scraped_at: snap.scrapedAt.toISOString(),
    title: snap.title,
    description: snap.description,
    photo_count: snap.photoCount,
    primary_photo_url: snap.primaryPhotoUrl,
    price_shown: snap.priceShown,
    rating: snap.rating,
    review_count: snap.reviewCount,
    badges: snap.badges,
    cancellation_policy_display: snap.cancellationPolicyDisplay,
    instant_book_enabled: snap.instantBookEnabled,
    amenity_count: snap.amenityCount,
    amenity_highlights: snap.amenityHighlights,
    raw_html_ref: snap.rawHtmlRef,
  };
}

export interface PresenceUpdate {
  publicly_found?: boolean;
  extranet_active?: boolean;
  last_public_check_at?: string;
  last_extranet_check_at?: string;
}

export function buildPresenceUpdate(args: {
  source: ScrapeSource;
  found: boolean;
  checkedAt: Date;
}): PresenceUpdate {
  const iso = args.checkedAt.toISOString();
  if (args.source === 'public') {
    return { publicly_found: args.found, last_public_check_at: iso };
  }
  return { extranet_active: args.found, last_extranet_check_at: iso };
}

export async function insertContentSnapshot(snap: ContentSnapshot): Promise<void> {
  const supabase = getSupabase();
  const row = buildContentSnapshotRow(snap);
  const { error } = await supabase.from('lc_listing_content_snapshot').insert(row);
  if (error) {
    throw new Error(
      `insertContentSnapshot failed for unit_id=${snap.unitId} ota=${snap.ota} source=${snap.source}: ${error.message}`
    );
  }
}

export async function updatePresence(args: {
  unitId: string;
  ota: string;
  source: ScrapeSource;
  found: boolean;
  checkedAt: Date;
}): Promise<void> {
  const supabase = getSupabase();
  const update = buildPresenceUpdate({
    source: args.source,
    found: args.found,
    checkedAt: args.checkedAt,
  });
  const { data, error } = await supabase
    .from('lc_listing_presence')
    .update(update)
    .eq('unit_id', args.unitId)
    .eq('ota', args.ota)
    .select();
  if (error) {
    throw new Error(
      `updatePresence failed for unit_id=${args.unitId} ota=${args.ota}: ${error.message}`
    );
  }
  if (!data || data.length === 0) {
    throw new Error(
      `updatePresence: no lc_listing_presence row found for unit_id=${args.unitId} ota=${args.ota} (seed may be missing)`
    );
  }
}
