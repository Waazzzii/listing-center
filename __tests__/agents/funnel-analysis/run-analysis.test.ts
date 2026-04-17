import { describe, it, expect, vi, beforeEach } from 'vitest';
import { runFullAnalysis, type AnalysisResult } from '../../../agents/funnel-analysis/run-analysis';

// Mock Supabase client
const mockSelect = vi.fn();
const mockInsert = vi.fn();
const mockUpdate = vi.fn();
const mockUpsert = vi.fn();
const mockFrom = vi.fn();

const mockSupabase = {
  from: mockFrom,
};

// Helper to set up mock chains
function setupMockQuery(data: any[], error: any = null) {
  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: data[0] ?? null, error }),
    then: vi.fn(),
    data,
    error,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('runFullAnalysis', () => {
  it('exports a runFullAnalysis function', () => {
    expect(typeof runFullAnalysis).toBe('function');
  });

  it('type checks the AnalysisResult interface', () => {
    const result: AnalysisResult = {
      properties_processed: 0,
      properties_skipped: 0,
      health_distribution: { red: 0, orange: 0, yellow: 0, green: 0, blue_spell: 0, unknown: 0 },
      recommendations_generated: 0,
      errors: [],
      execution_id: 'test',
    };
    expect(result.properties_processed).toBe(0);
  });
});
