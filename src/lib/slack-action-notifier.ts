// slack-action-notifier.ts
// Sends agent action proposals to Slack for approval.
// Creates rich Block Kit messages with action details and approve/reject/defer buttons.

import { postSlackMessage } from '@/lib/slack';
import type { AgentAction, ActionCategory, ExecutionChannel } from '@/lib/types';

const CATEGORY_EMOJI: Record<ActionCategory, string> = {
  pricing: ':moneybag:',
  discount: ':label:',
  content: ':memo:',
  exposure: ':eyes:',
  other: ':gear:',
};

const CHANNEL_LABEL: Record<ExecutionChannel, string> = {
  wheelhouse_api: 'Wheelhouse API',
  playwright_airbnb: 'Airbnb (Browser)',
  playwright_vrbo: 'VRBO (Browser)',
  playwright_booking: 'Booking.com (Browser)',
  streamline_api: 'Streamline API',
  manual: 'Manual',
};

const PRIORITY_EMOJI: Record<string, string> = {
  critical: ':rotating_light:',
  high: ':red_circle:',
  normal: ':large_blue_circle:',
  low: ':white_circle:',
};

/**
 * Send an agent action to Slack for approval.
 * Returns the message timestamp for later updates.
 */
export async function sendActionApprovalRequest(
  action: AgentAction & { property_name?: string; market?: string },
  channel: string
): Promise<string | null> {
  const categoryEmoji = CATEGORY_EMOJI[action.action_category] || ':gear:';
  const channelLabel = CHANNEL_LABEL[action.execution_channel] || action.execution_channel;
  const priorityEmoji = PRIORITY_EMOJI[action.priority] || '';

  const confidenceStr = action.confidence_score !== null
    ? `${action.confidence_score.toFixed(0)}%`
    : 'N/A';

  const blocks = [
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: `${categoryEmoji} Agent Action: ${action.title}`,
      },
    },
    {
      type: 'section',
      fields: [
        { type: 'mrkdwn', text: `*Property:*\n${action.property_name || action.property_id}` },
        { type: 'mrkdwn', text: `*Agent:*\n${action.agent_name}` },
        { type: 'mrkdwn', text: `*Category:*\n${action.action_category}` },
        { type: 'mrkdwn', text: `*Execution:*\n${channelLabel}` },
        { type: 'mrkdwn', text: `*Priority:*\n${priorityEmoji} ${action.priority}` },
        { type: 'mrkdwn', text: `*Confidence:*\n${confidenceStr}` },
      ],
    },
    ...(action.description ? [{
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*Details:*\n${action.description}`,
      },
    }] : []),
    ...(action.expected_impact ? [{
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*Expected Impact:*\n${action.expected_impact}`,
      },
    }] : []),
    {
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: `Action ID: \`${action.id}\` | Type: \`${action.action_type}\` | Revertible: ${action.is_revertible ? 'Yes' : 'No'}`,
        },
      ],
    },
    {
      type: 'actions',
      elements: [
        {
          type: 'button',
          text: { type: 'plain_text', text: 'Approve' },
          style: 'primary',
          action_id: `approve_action_${action.id}`,
        },
        {
          type: 'button',
          text: { type: 'plain_text', text: 'Reject' },
          style: 'danger',
          action_id: `reject_action_${action.id}`,
        },
        {
          type: 'button',
          text: { type: 'plain_text', text: 'Defer 7d' },
          action_id: `defer_action_${action.id}`,
        },
      ],
    },
  ];

  const result = await postSlackMessage(
    channel,
    `${categoryEmoji} Agent Action: ${action.title} — ${action.property_name || action.property_id}`,
    blocks
  );

  return result?.ts || null;
}

/**
 * Send a batch summary of proposed actions to Slack.
 */
export async function sendBatchSummary(
  actions: (AgentAction & { property_name?: string })[],
  channel: string
): Promise<void> {
  const byCategory = actions.reduce((acc, a) => {
    acc[a.action_category] = (acc[a.action_category] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const categoryLines = Object.entries(byCategory)
    .map(([cat, count]) => `${CATEGORY_EMOJI[cat as ActionCategory] || ':gear:'} ${cat}: ${count}`)
    .join('\n');

  const blocks = [
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: `:robot_face: ${actions.length} New Agent Actions Proposed`,
      },
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*Breakdown:*\n${categoryLines}\n\nActions requiring approval have been sent as individual messages below.`,
      },
    },
  ];

  await postSlackMessage(
    channel,
    `:robot_face: ${actions.length} new agent actions proposed`,
    blocks
  );
}
