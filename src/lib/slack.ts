import crypto from 'crypto';

// ---- Types ----

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type SlackBlock = Record<string, any>;

// ---- Channel Constants ----

export const CHANNELS = {
  MAIN: '#listing-center',
  APPROVALS: '#listing-center-approvals',
  ALERTS: '#listing-center-alerts',
} as const;

// ---- Slack API Posting ----

/**
 * Post a message with Block Kit blocks to a Slack channel.
 * Uses the Slack Bot Token (not webhook) for interactive messages.
 */
export async function postSlackMessage(
  channel: string,
  text: string,
  blocks: SlackBlock[]
): Promise<{ ok: boolean; ts?: string; error?: string }> {
  const token = process.env.SLACK_BOT_TOKEN;
  if (!token) {
    console.warn('[Slack] SLACK_BOT_TOKEN not set — message not sent:', text);
    return { ok: false, error: 'SLACK_BOT_TOKEN not configured' };
  }

  const response = await fetch('https://slack.com/api/chat.postMessage', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      channel,
      text, // Fallback text for notifications
      blocks,
    }),
  });

  const result = await response.json();
  if (!result.ok) {
    console.error('[Slack] Post failed:', result.error);
  }
  return result;
}

/**
 * Post a simple text message via incoming webhook (for alerts that don't need interactivity).
 */
export async function postSlackWebhook(text: string): Promise<void> {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;
  if (!webhookUrl) {
    console.warn('[Slack] SLACK_WEBHOOK_URL not set — message not sent:', text);
    return;
  }

  await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  });
}

/**
 * Update an existing Slack message (used to mark approvals as handled).
 */
export async function updateSlackMessage(
  channel: string,
  ts: string,
  text: string,
  blocks: SlackBlock[]
): Promise<{ ok: boolean; error?: string }> {
  const token = process.env.SLACK_BOT_TOKEN;
  if (!token) return { ok: false, error: 'SLACK_BOT_TOKEN not configured' };

  const response = await fetch('https://slack.com/api/chat.update', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ channel, ts, text, blocks }),
  });

  return response.json();
}

// ---- HMAC Signature Verification ----

/**
 * Verify Slack request signature using HMAC SHA256.
 * Protects the webhook endpoint from unauthorized requests.
 *
 * Returns false if:
 * - Timestamp is more than 5 minutes old (replay protection)
 * - HMAC signature doesn't match
 */
export function verifySlackSignature(
  body: string,
  timestamp: string,
  signature: string,
  signingSecret: string
): boolean {
  // Replay protection: reject requests older than 5 minutes
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - Number(timestamp)) > 300) {
    return false;
  }

  const baseString = `v0:${timestamp}:${body}`;
  const computedHash = 'v0=' + crypto.createHmac('sha256', signingSecret).update(baseString).digest('hex');

  try {
    return crypto.timingSafeEqual(Buffer.from(computedHash), Buffer.from(signature));
  } catch {
    return false;
  }
}

// ---- Block Kit Builders ----

interface ApprovalBlockInput {
  recommendation_id: string;
  property_name: string;
  market: string;
  quality_tier: string;
  recommendation_type: string;
  title: string;
  description: string;
  predicted_impact: string;
  severity: string;
  funnel_stage: string;
}

const SEVERITY_EMOJI: Record<string, string> = {
  critical: ':red_circle:',
  high: ':large_orange_circle:',
  medium: ':large_yellow_circle:',
  low: ':white_circle:',
  opportunity: ':large_blue_circle:',
};

export function buildApprovalBlocks(input: ApprovalBlockInput): SlackBlock[] {
  const emoji = SEVERITY_EMOJI[input.severity] || ':white_circle:';

  return [
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: `${input.severity.toUpperCase()}: ${input.title}`,
        emoji: true,
      },
    },
    {
      type: 'section',
      fields: [
        { type: 'mrkdwn', text: `*Property:*\n${input.property_name}` },
        { type: 'mrkdwn', text: `*Market:*\n${input.market} (${input.quality_tier})` },
        { type: 'mrkdwn', text: `*Funnel Stage:*\n${input.funnel_stage}` },
        { type: 'mrkdwn', text: `*Type:*\n${input.recommendation_type.replace(/_/g, ' ')}` },
      ],
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `${emoji} *Severity:* ${input.severity}\n\n${input.description.slice(0, 500)}`,
      },
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*Predicted Impact:* ${input.predicted_impact}`,
      },
    },
    {
      type: 'actions',
      elements: [
        {
          type: 'button',
          text: { type: 'plain_text', text: 'Approve', emoji: true },
          style: 'primary',
          action_id: `approve_rec_${input.recommendation_id}`,
          value: input.recommendation_id,
        },
        {
          type: 'button',
          text: { type: 'plain_text', text: 'Reject', emoji: true },
          style: 'danger',
          action_id: `reject_rec_${input.recommendation_id}`,
          value: input.recommendation_id,
        },
        {
          type: 'button',
          text: { type: 'plain_text', text: 'Defer 7 days', emoji: true },
          action_id: `defer_rec_${input.recommendation_id}`,
          value: input.recommendation_id,
        },
      ],
    },
    { type: 'divider' },
  ];
}

interface WeeklySummaryInput {
  total_properties: number;
  health_distribution: Record<string, number>;
  new_recommendations: number;
  active_ab_tests: number;
  pending_approvals: number;
  reviews_needing_attention: number;
  top_actions: Array<{ property_name: string; action: string; severity: string }>;
  scan_date: string;
}

export function buildWeeklySummaryBlocks(input: WeeklySummaryInput): SlackBlock[] {
  const hd = input.health_distribution;

  return [
    {
      type: 'header',
      text: { type: 'plain_text', text: 'Listing Center Weekly Portfolio Summary', emoji: true },
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*Scan Date:* ${input.scan_date} | *Properties:* ${input.total_properties}`,
      },
    },
    {
      type: 'section',
      fields: [
        { type: 'mrkdwn', text: `:red_circle: Red: *${hd.red || 0}*` },
        { type: 'mrkdwn', text: `:large_orange_circle: Orange: *${hd.orange || 0}*` },
        { type: 'mrkdwn', text: `:large_yellow_circle: Yellow: *${hd.yellow || 0}*` },
        { type: 'mrkdwn', text: `:white_check_mark: Green: *${hd.green || 0}*` },
        { type: 'mrkdwn', text: `:large_blue_circle: Blue Spell: *${hd.blue_spell || 0}*` },
        { type: 'mrkdwn', text: `:grey_question: Unknown: *${hd.unknown || 0}*` },
      ],
    },
    {
      type: 'section',
      fields: [
        { type: 'mrkdwn', text: `*New Recommendations:* ${input.new_recommendations}` },
        { type: 'mrkdwn', text: `*Active A/B Tests:* ${input.active_ab_tests}` },
        { type: 'mrkdwn', text: `*Pending Approvals:* ${input.pending_approvals}` },
        { type: 'mrkdwn', text: `*Reviews Pending:* ${input.reviews_needing_attention}` },
      ],
    },
    ...(input.top_actions.length > 0
      ? [
          { type: 'divider' },
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text:
                '*Top Actions This Week:*\n' +
                input.top_actions
                  .map(a => `${SEVERITY_EMOJI[a.severity] || ''} *${a.property_name}* — ${a.action}`)
                  .join('\n'),
            },
          },
        ]
      : []),
  ];
}

interface AlertInput {
  alert_type: string;
  title: string;
  description: string;
  urgency: 'critical' | 'high' | 'medium' | 'low';
}

export function buildAlertBlocks(input: AlertInput): SlackBlock[] {
  const urgencyEmoji: Record<string, string> = {
    critical: ':rotating_light:',
    high: ':warning:',
    medium: ':information_source:',
    low: ':memo:',
  };

  return [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `${urgencyEmoji[input.urgency] || ''} *${input.title}*\n\n${input.description}`,
      },
    },
    {
      type: 'context',
      elements: [
        { type: 'mrkdwn', text: `Alert type: ${input.alert_type} | Urgency: ${input.urgency} | ${new Date().toISOString()}` },
      ],
    },
  ];
}

interface TestResultInput {
  property_name: string;
  test_type: string;
  thesis: string;
  result: 'positive' | 'negative' | 'no_change';
  metric_lift: number;
  result_summary: string;
}

export function buildTestResultBlocks(input: TestResultInput): SlackBlock[] {
  const resultEmoji: Record<string, string> = {
    positive: ':chart_with_upwards_trend:',
    negative: ':chart_with_downwards_trend:',
    no_change: ':left_right_arrow:',
  };

  return [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `${resultEmoji[input.result] || ''} *A/B Test Result: ${input.result.toUpperCase()}*\n\n*Property:* ${input.property_name}\n*Test:* ${input.test_type.replace(/_/g, ' ')}\n*Thesis:* ${input.thesis}\n*Result:* ${input.result_summary}\n*Lift:* ${input.metric_lift > 0 ? '+' : ''}${input.metric_lift}%`,
      },
    },
  ];
}
