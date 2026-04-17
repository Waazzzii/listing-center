// agents/testing-engine/run-testing-engine.ts
// Continuous Testing Engine — the feedback loop that makes agents smarter.
//
// Pipeline:
//   1. Find completed actions whose soak period has elapsed
//   2. Evaluate: compare before/after metrics
//   3. Revert: auto-revert actions that caused regression
//   4. Learn: record outcomes to lc_test_learnings
//   5. Report: Slack summary of evaluations
//
// Usage: npx tsx agents/testing-engine/run-testing-engine.ts
// Schedule: Daily at 10am (after morning agent runs)

import { evaluateDueActions } from './evaluator';
import { processReverts } from './reverter';
import { recordLearnings } from './learner';
import { postSlackMessage } from '../../src/lib/slack';

const SLACK_CHANNEL = process.env.SLACK_LISTING_CENTER_CHANNEL || '';

export async function main() {
  console.log('[Testing Engine] Starting evaluation cycle...');
  const startTime = Date.now();

  // 1. Evaluate actions whose soak period has elapsed
  const results = await evaluateDueActions();
  console.log(`[Testing Engine] Evaluated ${results.length} actions`);

  if (results.length === 0) {
    console.log('[Testing Engine] No actions due for evaluation. Done.');
    return;
  }

  // Tally outcomes
  const positive = results.filter(r => r.outcome === 'positive').length;
  const negative = results.filter(r => r.outcome === 'negative').length;
  const neutral = results.filter(r => r.outcome === 'neutral').length;
  console.log(`  Positive: ${positive}, Negative: ${negative}, Neutral: ${neutral}`);

  // 2. Process auto-reverts for regressions
  const reverted = await processReverts(results);
  console.log(`[Testing Engine] Auto-reverted ${reverted} actions`);

  // 3. Record learnings for all outcomes
  const learned = await recordLearnings(results);
  console.log(`[Testing Engine] Recorded ${learned} learnings`);

  // 4. Send Slack summary
  if (SLACK_CHANNEL && results.length > 0) {
    const positiveLines = results
      .filter(r => r.outcome === 'positive')
      .slice(0, 5)
      .map(r => `  :chart_with_upwards_trend: ${r.primary_metric}: ${fmt(r.before_value)} → ${fmt(r.after_value)} (+${r.lift_pct?.toFixed(1)}%)`);

    const negativeLines = results
      .filter(r => r.outcome === 'negative')
      .slice(0, 5)
      .map(r => `  :chart_with_downwards_trend: ${r.primary_metric}: ${fmt(r.before_value)} → ${fmt(r.after_value)} (${r.lift_pct?.toFixed(1)}%)${r.should_revert ? ' :rewind: REVERTED' : ''}`);

    const text = [
      `:microscope: *Testing Engine Report* — ${results.length} actions evaluated`,
      '',
      `*Results:* ${positive} positive, ${neutral} neutral, ${negative} negative`,
      ...(reverted > 0 ? [`*Auto-Reverts:* ${reverted} actions reverted due to regression`] : []),
      `*Learnings Recorded:* ${learned}`,
      '',
      ...(positiveLines.length > 0 ? ['*Top Wins:*', ...positiveLines, ''] : []),
      ...(negativeLines.length > 0 ? ['*Regressions:*', ...negativeLines] : []),
    ].join('\n');

    await postSlackMessage(SLACK_CHANNEL, text, [
      { type: 'section', text: { type: 'mrkdwn', text } },
    ]);
  }

  const duration = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n[Testing Engine] Completed in ${duration}s`);
}

function fmt(val: number | null): string {
  if (val === null) return 'N/A';
  if (val < 1) return `${(val * 100).toFixed(1)}%`;
  return val.toFixed(1);
}

main().catch((err) => {
  console.error('[Testing Engine] Fatal error:', err);
  process.exit(1);
});
