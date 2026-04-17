import { describe, it, expect } from 'vitest';
import { aggregatePatterns, type CompletedTest } from '../../../agents/ab-test-tracker/learning-engine';

const completedTests: CompletedTest[] = [
  { id: 't1', test_type: 'hero_photo', target_metric: 'ctr', result: 'positive', metric_lift: 125.0, market: 'scottsdale', quality_tier: 'gold' },
  { id: 't2', test_type: 'hero_photo', target_metric: 'ctr', result: 'positive', metric_lift: 80.0, market: 'scottsdale', quality_tier: 'gold' },
  { id: 't3', test_type: 'hero_photo', target_metric: 'ctr', result: 'negative', metric_lift: -15.0, market: 'scottsdale', quality_tier: 'gold' },
  { id: 't4', test_type: 'hero_photo', target_metric: 'ctr', result: 'positive', metric_lift: 200.0, market: 'tucson', quality_tier: 'silver' },
  { id: 't5', test_type: 'description', target_metric: 'conversion', result: 'positive', metric_lift: 45.0, market: 'scottsdale', quality_tier: 'gold' },
  { id: 't6', test_type: 'description', target_metric: 'conversion', result: 'no_change', metric_lift: 2.0, market: 'scottsdale', quality_tier: 'gold' },
  { id: 't7', test_type: 'title', target_metric: 'ctr', result: 'positive', metric_lift: 30.0, market: 'coachella', quality_tier: 'platinum' },
];

describe('aggregatePatterns', () => {
  it('groups tests by test_type', () => {
    const patterns = aggregatePatterns(completedTests);
    const heroPattern = patterns.find(p => p.test_type === 'hero_photo');
    expect(heroPattern).toBeDefined();
    expect(heroPattern!.total_tests).toBe(4);
  });

  it('calculates success rate correctly', () => {
    const patterns = aggregatePatterns(completedTests);
    const heroPattern = patterns.find(p => p.test_type === 'hero_photo');
    // 3 positive out of 4 total = 75%
    expect(heroPattern!.success_rate).toBeCloseTo(75.0, 0);
  });

  it('calculates average lift for positive results only', () => {
    const patterns = aggregatePatterns(completedTests);
    const heroPattern = patterns.find(p => p.test_type === 'hero_photo');
    // Average of positive lifts: (125 + 80 + 200) / 3 = 135
    expect(heroPattern!.avg_positive_lift).toBeCloseTo(135.0, 0);
  });

  it('flags patterns eligible for autonomy (80%+ success, 10+ tests)', () => {
    // Only 4 hero_photo tests, so not eligible yet
    const patterns = aggregatePatterns(completedTests);
    const heroPattern = patterns.find(p => p.test_type === 'hero_photo');
    expect(heroPattern!.autonomous_eligible).toBe(false);
  });

  it('marks pattern as autonomous eligible when thresholds met', () => {
    // Create 12 hero photo tests with 10 positive
    const manyTests: CompletedTest[] = Array.from({ length: 12 }, (_, i) => ({
      id: `t-${i}`,
      test_type: 'hero_photo',
      target_metric: 'ctr',
      result: (i < 10 ? 'positive' : 'negative') as CompletedTest['result'],
      metric_lift: i < 10 ? 50 + i * 10 : -10,
      market: 'scottsdale',
      quality_tier: 'gold',
    }));
    const patterns = aggregatePatterns(manyTests);
    const heroPattern = patterns.find(p => p.test_type === 'hero_photo');
    // 10/12 = 83.3% success, 12 tests > 10 minimum -> eligible
    expect(heroPattern!.autonomous_eligible).toBe(true);
  });

  it('breaks down by market when requested', () => {
    const patterns = aggregatePatterns(completedTests, { groupByMarket: true });
    const scottsdaleHero = patterns.find(
      p => p.test_type === 'hero_photo' && p.market === 'scottsdale'
    );
    expect(scottsdaleHero).toBeDefined();
    expect(scottsdaleHero!.total_tests).toBe(3);
  });

  it('returns empty array for empty input', () => {
    const patterns = aggregatePatterns([]);
    expect(patterns).toEqual([]);
  });
});
