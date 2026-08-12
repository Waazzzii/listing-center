import { describe, it, expect } from 'vitest';
import { buildContentSnapshotRow, buildPresenceUpdate } from '../../../agents/listing-scraper/_storage';
import type { ContentSnapshot } from '../../../agents/listing-scraper/_types';

describe('buildContentSnapshotRow', () => {
  it('maps camelCase ContentSnapshot to snake_case DB row', () => {
    const snap: ContentSnapshot = {
      unitId: '11111111-1111-1111-1111-111111111111',
      ota: 'airbnb',
      source: 'public',
      scrapedAt: new Date('2026-04-15T10:00:00Z'),
      title: 'Sunny Desert Retreat',
      description: 'Lovely pool home.',
      photoCount: 24,
      primaryPhotoUrl: 'https://x/img.jpg',
      priceShown: 289.5,
      rating: 4.92,
      reviewCount: 118,
      badges: ['superhost', 'guest_favorite'],
      cancellationPolicyDisplay: 'Moderate',
      instantBookEnabled: true,
      amenityCount: 32,
      amenityHighlights: { pool: true, wifi: true },
      rawHtmlRef: 's3://bucket/ref',
    };

    const row = buildContentSnapshotRow(snap);

    expect(row.unit_id).toBe(snap.unitId);
    expect(row.ota).toBe('airbnb');
    expect(row.source).toBe('public');
    expect(row.scraped_at).toBe(snap.scrapedAt.toISOString());
    expect(row.title).toBe('Sunny Desert Retreat');
    expect(row.photo_count).toBe(24);
    expect(row.primary_photo_url).toBe('https://x/img.jpg');
    expect(row.price_shown).toBe(289.5);
    expect(row.badges).toEqual(['superhost', 'guest_favorite']);
    expect(row.cancellation_policy_display).toBe('Moderate');
    expect(row.instant_book_enabled).toBe(true);
    expect(row.amenity_highlights).toEqual({ pool: true, wifi: true });
    expect(row.raw_html_ref).toBe('s3://bucket/ref');
  });

  it('handles null-like fields', () => {
    const row = buildContentSnapshotRow({
      unitId: 'u',
      ota: 'airbnb',
      source: 'public',
      scrapedAt: new Date('2026-04-15T00:00:00Z'),
      title: null,
      description: null,
      photoCount: null,
      primaryPhotoUrl: null,
      priceShown: null,
      rating: null,
      reviewCount: null,
      badges: [],
      cancellationPolicyDisplay: null,
      instantBookEnabled: null,
      amenityCount: null,
      amenityHighlights: null,
      rawHtmlRef: null,
    });

    expect(row.title).toBeNull();
    expect(row.photo_count).toBeNull();
    expect(row.badges).toEqual([]);
  });
});

describe('buildPresenceUpdate', () => {
  it('sets publicly_found + last_public_check_at when source=public', () => {
    const update = buildPresenceUpdate({
      source: 'public',
      found: true,
      checkedAt: new Date('2026-04-15T10:00:00Z'),
    });
    expect(update.publicly_found).toBe(true);
    expect(update.last_public_check_at).toBe('2026-04-15T10:00:00.000Z');
    expect(update).not.toHaveProperty('extranet_active');
  });

  it('sets extranet_active + last_extranet_check_at when source=extranet', () => {
    const update = buildPresenceUpdate({
      source: 'extranet',
      found: false,
      checkedAt: new Date('2026-04-15T10:00:00Z'),
    });
    expect(update.extranet_active).toBe(false);
    expect(update.last_extranet_check_at).toBe('2026-04-15T10:00:00.000Z');
    expect(update).not.toHaveProperty('publicly_found');
  });
});
