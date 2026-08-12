import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  buildApprovalBlocks,
  buildWeeklySummaryBlocks,
  buildAlertBlocks,
  buildTestResultBlocks,
  verifySlackSignature,
  CHANNELS,
} from '../../src/lib/slack';

describe('CHANNELS', () => {
  it('exports correct channel constants', () => {
    expect(CHANNELS.MAIN).toBe('#listing-center');
    expect(CHANNELS.APPROVALS).toBe('#listing-center-approvals');
    expect(CHANNELS.ALERTS).toBe('#listing-center-alerts');
  });
});

describe('buildApprovalBlocks', () => {
  it('builds Block Kit blocks with Approve/Reject/Defer buttons', () => {
    const blocks = buildApprovalBlocks({
      recommendation_id: 'rec-123',
      property_name: 'Desert Oasis Villa',
      market: 'scottsdale',
      quality_tier: 'gold',
      recommendation_type: 'hero_photo_swap',
      title: 'Swap hero photo to pool aerial',
      description: 'CTR is below benchmark. Recommend aerial pool shot.',
      predicted_impact: 'Expected +50% CTR',
      severity: 'high',
      funnel_stage: 'mid',
    });

    expect(blocks).toBeInstanceOf(Array);
    expect(blocks.length).toBeGreaterThanOrEqual(3); // Header + body + actions

    // Find the actions block
    const actionsBlock = blocks.find((b: any) => b.type === 'actions');
    expect(actionsBlock).toBeDefined();
    expect(actionsBlock.elements).toHaveLength(3); // Approve, Reject, Defer

    // Check button action IDs contain the recommendation ID
    const actionIds = actionsBlock.elements.map((e: any) => e.action_id);
    expect(actionIds).toContain('approve_rec_rec-123');
    expect(actionIds).toContain('reject_rec_rec-123');
    expect(actionIds).toContain('defer_rec_rec-123');
  });

  it('includes severity emoji in header', () => {
    const blocks = buildApprovalBlocks({
      recommendation_id: 'rec-456',
      property_name: 'Mountain Lodge',
      market: 'sedona',
      quality_tier: 'platinum',
      recommendation_type: 'price_decrease',
      title: 'Lower price to improve impressions',
      description: 'Algorithm is suppressing this listing.',
      predicted_impact: 'Expected +15% impression rate',
      severity: 'critical',
      funnel_stage: 'top',
    });

    // The header should contain a red indicator for critical
    const headerBlock = blocks.find((b: any) => b.type === 'header' || b.type === 'section');
    const headerText = JSON.stringify(headerBlock);
    expect(headerText.toLowerCase()).toContain('critical');
  });
});

describe('buildWeeklySummaryBlocks', () => {
  it('builds summary with health distribution and key actions', () => {
    const blocks = buildWeeklySummaryBlocks({
      total_properties: 150,
      health_distribution: { red: 5, orange: 12, yellow: 20, green: 108, blue_spell: 5, unknown: 0 },
      new_recommendations: 17,
      active_ab_tests: 4,
      pending_approvals: 8,
      reviews_needing_attention: 3,
      top_actions: [
        { property_name: 'Desert Oasis', action: 'Hero photo swap recommended', severity: 'critical' },
        { property_name: 'Mountain View', action: 'Price increase opportunity', severity: 'opportunity' },
      ],
      scan_date: '2026-04-06',
    });

    expect(blocks).toBeInstanceOf(Array);
    expect(blocks.length).toBeGreaterThanOrEqual(3);
    const blockText = JSON.stringify(blocks);
    expect(blockText).toContain('150');
    expect(blockText).toContain('Desert Oasis');
  });
});

describe('buildAlertBlocks', () => {
  it('builds alert message with urgency indicator', () => {
    const blocks = buildAlertBlocks({
      alert_type: 'rating_deadline',
      title: 'Guest rating deadline in 24 hours',
      description: '3 ratings due tomorrow across 2 accounts',
      urgency: 'high',
    });

    expect(blocks).toBeInstanceOf(Array);
    const blockText = JSON.stringify(blocks);
    expect(blockText).toContain('rating deadline');
  });

  it('builds scrape health warning', () => {
    const blocks = buildAlertBlocks({
      alert_type: 'scrape_health',
      title: 'SCRAPE HEALTH WARNING',
      description: 'Only 72% of properties scraped (765/1060). 2 accounts failed.',
      urgency: 'critical',
    });

    expect(blocks).toBeInstanceOf(Array);
    const blockText = JSON.stringify(blocks);
    expect(blockText).toContain('72%');
  });
});

describe('buildTestResultBlocks', () => {
  it('builds A/B test result notification', () => {
    const blocks = buildTestResultBlocks({
      property_name: 'Poolside Retreat',
      test_type: 'hero_photo',
      thesis: 'Pool aerial will increase CTR',
      result: 'positive',
      metric_lift: 125.0,
      result_summary: 'CTR increased from 8% to 18% (+125%)',
    });

    expect(blocks).toBeInstanceOf(Array);
    const blockText = JSON.stringify(blocks);
    expect(blockText.toLowerCase()).toContain('positive');
    expect(blockText).toContain('125');
  });
});

describe('verifySlackSignature', () => {
  it('returns true for valid HMAC signature', () => {
    const signingSecret = 'test-secret-12345';
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const body = 'payload=%7B%22test%22%3A%22data%22%7D';

    // Compute expected signature
    const crypto = require('crypto');
    const baseString = `v0:${timestamp}:${body}`;
    const expectedHash = 'v0=' + crypto.createHmac('sha256', signingSecret).update(baseString).digest('hex');

    const result = verifySlackSignature(body, timestamp, expectedHash, signingSecret);
    expect(result).toBe(true);
  });

  it('returns false for invalid signature', () => {
    const result = verifySlackSignature('body', '12345', 'v0=invalid', 'secret');
    expect(result).toBe(false);
  });

  it('returns false for stale timestamp (> 5 minutes)', () => {
    const staleTimestamp = (Math.floor(Date.now() / 1000) - 400).toString(); // 6+ minutes ago
    const result = verifySlackSignature('body', staleTimestamp, 'v0=whatever', 'secret');
    expect(result).toBe(false);
  });
});
