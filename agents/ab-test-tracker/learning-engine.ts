// agents/ab-test-tracker/learning-engine.ts
// Aggregates patterns from completed A/B tests to build institutional knowledge.
// Feeds Phase 3 autonomy decisions: 80%+ success across 10+ tests -> eligible.

export interface CompletedTest {
  id: string;
  test_type: string;
  target_metric: string;
  result: 'positive' | 'negative' | 'no_change';
  metric_lift: number;
  market: string;
  quality_tier: string;
}

export interface LearningPattern {
  test_type: string;
  target_metric: string;
  market?: string;
  quality_tier?: string;
  total_tests: number;
  positive_count: number;
  negative_count: number;
  no_change_count: number;
  success_rate: number;           // (positive / total) * 100
  avg_positive_lift: number;      // Average lift among positive results
  avg_negative_lift: number;      // Average decline among negative results
  autonomous_eligible: boolean;   // 80%+ success rate AND 10+ tests
  confidence_score: number;       // 0-100 based on sample size and consistency
}

interface AggregateOptions {
  groupByMarket?: boolean;
  groupByTier?: boolean;
}

const AUTONOMY_SUCCESS_THRESHOLD = 80; // 80% success rate
const AUTONOMY_MIN_TESTS = 10;         // Minimum test count

/**
 * Aggregate completed test results into learning patterns.
 *
 * Groups by test_type (and optionally by market/tier) to identify
 * which types of changes consistently produce positive results.
 *
 * This feeds Phase 3 autonomy: patterns with 80%+ success across
 * 10+ tests become eligible for autonomous execution.
 */
export function aggregatePatterns(
  tests: CompletedTest[],
  options: AggregateOptions = {}
): LearningPattern[] {
  if (tests.length === 0) return [];

  // Build grouping key
  const groups = new Map<string, CompletedTest[]>();

  for (const test of tests) {
    const keyParts = [test.test_type];
    if (options.groupByMarket) keyParts.push(test.market);
    if (options.groupByTier) keyParts.push(test.quality_tier);
    const key = keyParts.join('|');

    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(test);
  }

  // Calculate patterns per group
  const patterns: LearningPattern[] = [];

  for (const [key, groupTests] of Array.from(groups.entries())) {
    const keyParts = key.split('|');
    const testType = keyParts[0];
    const market = options.groupByMarket ? keyParts[1] : undefined;
    const qualityTier = options.groupByTier
      ? keyParts[options.groupByMarket ? 2 : 1]
      : undefined;

    const positiveTests = groupTests.filter(t => t.result === 'positive');
    const negativeTests = groupTests.filter(t => t.result === 'negative');
    const noChangeTests = groupTests.filter(t => t.result === 'no_change');

    const totalTests = groupTests.length;
    const successRate = totalTests > 0 ? (positiveTests.length / totalTests) * 100 : 0;

    const avgPositiveLift = positiveTests.length > 0
      ? positiveTests.reduce((sum, t) => sum + t.metric_lift, 0) / positiveTests.length
      : 0;

    const avgNegativeLift = negativeTests.length > 0
      ? negativeTests.reduce((sum, t) => sum + t.metric_lift, 0) / negativeTests.length
      : 0;

    const autonomousEligible =
      successRate >= AUTONOMY_SUCCESS_THRESHOLD &&
      totalTests >= AUTONOMY_MIN_TESTS;

    // Confidence score: combines sample size and consistency
    // More tests + higher success rate + lower variance = higher confidence
    const sampleFactor = Math.min(totalTests / 20, 1) * 50; // 0-50 based on sample (caps at 20)
    const successFactor = (successRate / 100) * 50;           // 0-50 based on success rate
    const confidenceScore = Math.round(sampleFactor + successFactor);

    patterns.push({
      test_type: testType,
      target_metric: groupTests[0].target_metric,
      market,
      quality_tier: qualityTier,
      total_tests: totalTests,
      positive_count: positiveTests.length,
      negative_count: negativeTests.length,
      no_change_count: noChangeTests.length,
      success_rate: Math.round(successRate * 10) / 10,
      avg_positive_lift: Math.round(avgPositiveLift * 10) / 10,
      avg_negative_lift: Math.round(avgNegativeLift * 10) / 10,
      autonomous_eligible: autonomousEligible,
      confidence_score: confidenceScore,
    });
  }

  // Sort by confidence score descending
  patterns.sort((a, b) => b.confidence_score - a.confidence_score);

  return patterns;
}
