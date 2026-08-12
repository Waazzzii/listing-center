export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { verifySlackSignature, updateSlackMessage } from '@/lib/slack';
import {
  parseSlackAction,
  processApproval,
  processRejection,
  processDeferral,
  processActionApproval,
  processActionRejection,
  processActionDeferral,
} from '@/lib/slack-approval-helpers';

// ---- Webhook Route Handler ----

export async function POST(req: NextRequest): Promise<NextResponse> {
  // Step 1: Read raw body for signature verification
  const rawBody = await req.text();
  const timestamp = req.headers.get('x-slack-request-timestamp') || '';
  const signature = req.headers.get('x-slack-signature') || '';
  const signingSecret = process.env.SLACK_SIGNING_SECRET || '';

  // Step 2: Verify HMAC signature
  if (!verifySlackSignature(rawBody, timestamp, signature, signingSecret)) {
    console.error('[Slack Webhook] Signature verification failed');
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  // Step 3: Parse the Slack interaction payload
  // Slack sends URL-encoded body with a `payload` field containing JSON
  const params = new URLSearchParams(rawBody);
  const payloadStr = params.get('payload');
  if (!payloadStr) {
    return NextResponse.json({ error: 'Missing payload' }, { status: 400 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let payload: Record<string, any>;
  try {
    payload = JSON.parse(payloadStr);
  } catch {
    return NextResponse.json({ error: 'Invalid payload JSON' }, { status: 400 });
  }

  // Step 4: Extract the action
  const action = payload.actions?.[0];
  if (!action) {
    return NextResponse.json({ error: 'No action found' }, { status: 400 });
  }

  const parsed = parseSlackAction(action.action_id);
  if (!parsed) {
    return NextResponse.json({ error: 'Unrecognized action' }, { status: 400 });
  }

  const userId = payload.user?.username || payload.user?.id || 'unknown';

  // Step 5: Process the action (route to correct handler based on target type)
  let result: { success: boolean; error?: string };
  let statusLabel: string;

  if (parsed.target_type === 'agent_action') {
    // Agent action approval flow
    switch (parsed.action) {
      case 'approve':
        result = await processActionApproval(parsed.recommendation_id, userId);
        statusLabel = 'APPROVED';
        break;
      case 'reject':
        result = await processActionRejection(parsed.recommendation_id, userId);
        statusLabel = 'REJECTED';
        break;
      case 'defer':
        result = await processActionDeferral(parsed.recommendation_id, userId);
        statusLabel = 'DEFERRED (7 days)';
        break;
      default:
        return NextResponse.json({ error: 'Unknown action type' }, { status: 400 });
    }
  } else {
    // Legacy recommendation approval flow
    switch (parsed.action) {
      case 'approve':
        result = await processApproval(parsed.recommendation_id, userId);
        statusLabel = 'APPROVED';
        break;
      case 'reject':
        result = await processRejection(parsed.recommendation_id, userId);
        statusLabel = 'REJECTED';
        break;
      case 'defer':
        result = await processDeferral(parsed.recommendation_id, userId);
        statusLabel = 'DEFERRED (7 days)';
        break;
      default:
        return NextResponse.json({ error: 'Unknown action type' }, { status: 400 });
    }
  }

  if (!result.success) {
    console.error(`[Slack Webhook] Action ${parsed.action} failed: ${result.error}`);
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  // Step 6: Update the original Slack message to show the result
  // Replace action buttons with a status text
  const channel = payload.channel?.id;
  const messageTs = payload.message?.ts;

  if (channel && messageTs) {
    const updatedBlocks = [
      ...(payload.message?.blocks?.filter((b: Record<string, unknown>) => b.type !== 'actions') || []),
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*${statusLabel}* by @${userId} at ${new Date().toLocaleString()}`,
        },
      },
    ];

    await updateSlackMessage(channel, messageTs, `Recommendation ${statusLabel.toLowerCase()}`, updatedBlocks);
  }

  // Slack expects an empty 200 response within 3 seconds
  return new NextResponse(null, { status: 200 });
}
