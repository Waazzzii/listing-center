// agents/action-executor/run-executor.ts
// Entry point for the action execution pipeline.
// Processes approved actions, executes them, and reports results.
//
// Usage: npx tsx agents/action-executor/run-executor.ts
// Schedule: Every 5 minutes via cron or Vercel cron

import { processActionQueue } from './executor';
import { postSlackMessage } from '../../src/lib/slack';

async function main() {
  console.log('[Action Executor] Starting execution run...');
  const startTime = Date.now();

  const stats = await processActionQueue();

  const duration = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`[Action Executor] Completed in ${duration}s`);
  console.log(`  Processed: ${stats.processed}`);
  console.log(`  Succeeded: ${stats.succeeded}`);
  console.log(`  Failed: ${stats.failed}`);

  if (stats.errors.length > 0) {
    console.log(`  Errors:`);
    for (const err of stats.errors) {
      console.log(`    - ${err}`);
    }
  }

  // Notify Slack if any actions were processed
  const slackChannel = process.env.SLACK_LISTING_CENTER_CHANNEL;
  if (stats.processed > 0 && slackChannel) {
    const emoji = stats.failed > 0 ? ':warning:' : ':white_check_mark:';
    const text = `${emoji} Action Executor: ${stats.succeeded}/${stats.processed} actions executed (${stats.failed} failed) in ${duration}s`;
    await postSlackMessage(slackChannel, text, [
      { type: 'section', text: { type: 'mrkdwn', text } },
    ]);
  }
}

main().catch((err) => {
  console.error('[Action Executor] Fatal error:', err);
  process.exit(1);
});
