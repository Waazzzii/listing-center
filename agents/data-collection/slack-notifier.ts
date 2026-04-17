import { IncomingWebhook } from '@slack/webhook';

// ============================================================
// CONFIGURATION
// ============================================================

let webhook: IncomingWebhook | null = null;

function getWebhook(): IncomingWebhook {
  if (webhook) return webhook;

  const url = process.env.SLACK_WEBHOOK_URL;
  if (!url) {
    console.warn('[SlackNotifier] SLACK_WEBHOOK_URL not set — notifications will be logged only');
    // Return a dummy webhook that just logs
    return {
      send: async (payload: unknown) => {
        const msg = typeof payload === 'string' ? payload : (payload as { text?: string }).text;
        console.log('[SlackNotifier] Would send:', msg);
      },
    } as unknown as IncomingWebhook;
  }

  webhook = new IncomingWebhook(url);
  return webhook;
}

// ============================================================
// NOTIFICATION FUNCTIONS
// ============================================================

/**
 * Send a plain text message to Slack.
 * If channel is specified, uses the channel override (requires bot token).
 * Otherwise sends to the default webhook channel.
 */
export async function notifySlack(
  message: string,
  channel?: string,
): Promise<void> {
  try {
    const wh = getWebhook();
    await wh.send({
      text: message,
      ...(channel ? { channel } : {}),
    });
  } catch (err) {
    console.error('[SlackNotifier] Failed to send notification:', err);
    // Don't throw — Slack failures should not break the scraper
  }
}

/**
 * Notify that a scrape run completed with a summary.
 */
export async function notifyScrapeComplete(result: {
  scrape_run_id: string;
  accounts_processed: number;
  accounts_failed: number;
  properties_scraped: number;
  properties_expected: number;
  completeness_pct: number;
  duration_seconds: number;
  errors: Array<{ account_id: number; page: string; error: string }>;
}): Promise<void> {
  const minutes = Math.round(result.duration_seconds / 60);
  const statusEmoji = result.completeness_pct >= 95 ? ':white_check_mark:'
    : result.completeness_pct >= 80 ? ':warning:'
    : ':red_circle:';

  const errorSummary = result.errors.length > 0
    ? `\nErrors (${result.errors.length}):\n${result.errors.slice(0, 5).map(
        e => `  - Account ${e.account_id}, page: ${e.page}: ${e.error.slice(0, 100)}`
      ).join('\n')}`
    : '';

  await notifySlack(
    `${statusEmoji} *Data Collection Scrape Complete*\n` +
    `Properties: ${result.properties_scraped}/${result.properties_expected} (${result.completeness_pct}%)\n` +
    `Accounts: ${result.accounts_processed} processed, ${result.accounts_failed} failed\n` +
    `Duration: ${minutes} minutes\n` +
    `Run ID: \`${result.scrape_run_id}\`` +
    errorSummary,
  );
}

/**
 * Notify that a specific account failed during scraping.
 */
export async function notifyScrapeError(
  accountId: number,
  accountName: string,
  error: string,
): Promise<void> {
  await notifySlack(
    `:x: *Scrape Error — Account ${accountName} (ID: ${accountId})*\n` +
    `Error: ${error.slice(0, 500)}`,
    '#listing-center-alerts',
  );
}

/**
 * Notify that a session has expired and needs manual MFA re-authentication.
 */
export async function notifySessionExpired(
  accountId: number,
  accountName: string,
): Promise<void> {
  await notifySlack(
    `:key: *Session Expired — ${accountName} (Account ${accountId})*\n` +
    `Manual login required — Airbnb is requesting MFA.\n` +
    `Action: Log into Airbnb manually in Chrome, then run the session capture script:\n` +
    `\`npx ts-node scripts/capture-session.ts --account=${accountId}\``,
    '#listing-center-alerts',
  );
}

/**
 * Notify that Streamline enrichment completed.
 */
export async function notifyEnrichmentComplete(result: {
  properties_enriched: number;
  properties_failed: number;
  duration_seconds: number;
}): Promise<void> {
  const statusEmoji = result.properties_failed === 0 ? ':white_check_mark:' : ':warning:';

  await notifySlack(
    `${statusEmoji} *Streamline Enrichment Complete*\n` +
    `Enriched: ${result.properties_enriched}\n` +
    `Failed: ${result.properties_failed}\n` +
    `Duration: ${result.duration_seconds}s`,
  );
}
