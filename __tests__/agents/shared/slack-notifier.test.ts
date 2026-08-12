import { describe, it, expect, vi } from 'vitest';
import {
  notifyRecommendationCreated,
  notifyWeeklySummary,
  notifyRatingDeadline,
  notifyTestResult,
  notifyAgentError,
  notifyScrapeHealth,
} from '../../../agents/shared/slack-notifier';

// Mock the slack module
vi.mock('../../../src/lib/slack', () => ({
  postSlackMessage: vi.fn().mockResolvedValue({ ok: true, ts: '123.456' }),
  postSlackWebhook: vi.fn().mockResolvedValue(undefined),
  buildApprovalBlocks: vi.fn().mockReturnValue([{ type: 'section', text: { type: 'mrkdwn', text: 'test' } }]),
  buildWeeklySummaryBlocks: vi.fn().mockReturnValue([{ type: 'section', text: { type: 'mrkdwn', text: 'test' } }]),
  buildAlertBlocks: vi.fn().mockReturnValue([{ type: 'section', text: { type: 'mrkdwn', text: 'test' } }]),
  buildTestResultBlocks: vi.fn().mockReturnValue([{ type: 'section', text: { type: 'mrkdwn', text: 'test' } }]),
  CHANNELS: {
    MAIN: '#listing-center',
    APPROVALS: '#listing-center-approvals',
    ALERTS: '#listing-center-alerts',
  },
}));

describe('notifyRecommendationCreated', () => {
  it('posts to approvals channel', async () => {
    const { postSlackMessage } = await import('../../../src/lib/slack');
    await notifyRecommendationCreated({
      recommendation_id: 'rec-1',
      property_name: 'Test Property',
      market: 'scottsdale',
      quality_tier: 'gold',
      recommendation_type: 'hero_photo_swap',
      title: 'Swap hero photo',
      description: 'CTR below benchmark',
      predicted_impact: '+50% CTR',
      severity: 'high',
      funnel_stage: 'mid',
    });
    expect(postSlackMessage).toHaveBeenCalledWith(
      '#listing-center-approvals',
      expect.any(String),
      expect.any(Array)
    );
  });
});

describe('notifyAgentError', () => {
  it('posts to alerts channel', async () => {
    const { postSlackMessage } = await import('../../../src/lib/slack');
    await notifyAgentError('funnel_analysis', 'Benchmark resolution failed for 3 properties');
    expect(postSlackMessage).toHaveBeenCalledWith(
      '#listing-center-alerts',
      expect.any(String),
      expect.any(Array)
    );
  });
});

describe('notifyScrapeHealth', () => {
  it('posts warning when completeness below 80%', async () => {
    const { postSlackMessage } = await import('../../../src/lib/slack');
    await notifyScrapeHealth({
      completeness_pct: 72,
      properties_scraped: 765,
      properties_expected: 1060,
      accounts_failed: 2,
    });
    expect(postSlackMessage).toHaveBeenCalledWith(
      '#listing-center-alerts',
      expect.stringContaining('72'),
      expect.any(Array)
    );
  });
});

describe('notifyRatingDeadline', () => {
  it('posts urgent alert for upcoming deadlines', async () => {
    const { postSlackMessage } = await import('../../../src/lib/slack');
    await notifyRatingDeadline({
      count: 3,
      accounts_affected: 2,
      deadline_date: '2026-04-07',
    });
    expect(postSlackMessage).toHaveBeenCalledWith(
      '#listing-center-alerts',
      expect.any(String),
      expect.any(Array)
    );
  });
});

describe('notifyTestResult', () => {
  it('posts to main channel', async () => {
    const { postSlackMessage } = await import('../../../src/lib/slack');
    await notifyTestResult({
      property_name: 'Desert Villa',
      test_type: 'hero_photo',
      thesis: 'Pool shot will improve CTR',
      result: 'positive',
      metric_lift: 125,
      result_summary: 'CTR +125%',
    });
    expect(postSlackMessage).toHaveBeenCalledWith(
      '#listing-center',
      expect.any(String),
      expect.any(Array)
    );
  });
});

describe('notifyWeeklySummary', () => {
  it('posts to main channel', async () => {
    const { postSlackMessage } = await import('../../../src/lib/slack');
    await notifyWeeklySummary({
      total_properties: 150,
      health_distribution: { red: 5, orange: 12, yellow: 20, green: 108, blue_spell: 5, unknown: 0 },
      new_recommendations: 17,
      active_ab_tests: 4,
      pending_approvals: 8,
      reviews_needing_attention: 3,
      top_actions: [],
      scan_date: '2026-04-06',
    });
    expect(postSlackMessage).toHaveBeenCalledWith(
      '#listing-center',
      expect.any(String),
      expect.any(Array)
    );
  });
});
