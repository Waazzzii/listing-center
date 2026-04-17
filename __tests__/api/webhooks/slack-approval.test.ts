import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Supabase
vi.mock('../../../src/lib/supabase', () => ({
  getSupabase: vi.fn().mockReturnValue({
    from: vi.fn().mockReturnValue({
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ data: null, error: null }),
      }),
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: {
              id: 'rec-123',
              property_id: 'prop-1',
              status: 'pending',
              title: 'Swap hero photo',
              recommendation_type: 'hero_photo_swap',
              agent_name: 'content_optimizer',
              description: 'CTR below benchmark',
              diagnosed_issue: 'Low CTR',
              predicted_impact: '+50% CTR',
            },
            error: null,
          }),
        }),
      }),
      insert: vi.fn().mockResolvedValue({ data: null, error: null }),
    }),
  }),
}));

// Mock Slack
vi.mock('../../../src/lib/slack', () => ({
  verifySlackSignature: vi.fn(),
  updateSlackMessage: vi.fn().mockResolvedValue({ ok: true }),
}));

import {
  parseSlackAction,
  processApproval,
  processRejection,
  processDeferral,
} from '../../../src/lib/slack-approval-helpers';

describe('parseSlackAction', () => {
  it('parses approve action ID correctly', () => {
    const result = parseSlackAction('approve_rec_abc-123');
    expect(result).toEqual({ action: 'approve', recommendation_id: 'abc-123' });
  });

  it('parses reject action ID correctly', () => {
    const result = parseSlackAction('reject_rec_abc-123');
    expect(result).toEqual({ action: 'reject', recommendation_id: 'abc-123' });
  });

  it('parses defer action ID correctly', () => {
    const result = parseSlackAction('defer_rec_abc-123');
    expect(result).toEqual({ action: 'defer', recommendation_id: 'abc-123' });
  });

  it('returns null for unrecognized action IDs', () => {
    const result = parseSlackAction('unknown_action_123');
    expect(result).toBeNull();
  });

  it('handles UUIDs with hyphens correctly', () => {
    const result = parseSlackAction('approve_rec_550e8400-e29b-41d4-a716-446655440000');
    expect(result).toEqual({
      action: 'approve',
      recommendation_id: '550e8400-e29b-41d4-a716-446655440000',
    });
  });
});

describe('processApproval', () => {
  it('is a function', () => {
    expect(typeof processApproval).toBe('function');
  });
});

describe('processRejection', () => {
  it('is a function', () => {
    expect(typeof processRejection).toBe('function');
  });
});

describe('processDeferral', () => {
  it('is a function', () => {
    expect(typeof processDeferral).toBe('function');
  });
});
