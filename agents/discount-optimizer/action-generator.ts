// agents/discount-optimizer/action-generator.ts
// Converts discount opportunities into lc_agent_actions records
// and sends them to Slack for approval.

import { getSupabase } from '../../src/lib/supabase';
import { sendActionApprovalRequest, sendBatchSummary } from '../../src/lib/slack-action-notifier';
import type { DiscountOpportunity } from './strategy';

const AGENT_NAME = 'discount_optimizer';
const SLACK_CHANNEL = process.env.SLACK_LISTING_CENTER_CHANNEL || '';

// Confidence scoring based on learning history and risk level
const RISK_CONFIDENCE: Record<string, number> = {
  low: 75,
  medium: 55,
  high: 35,
};

// Auto-approve threshold: only auto-approve low-risk LOS discounts
const AUTO_APPROVE_TYPES = ['los_incentive'];

export interface GenerationResult {
  total_opportunities: number;
  actions_created: number;
  auto_approved: number;
  pending_approval: number;
  errors: string[];
}

/**
 * Generate agent actions from discount opportunities and submit for approval.
 */
export async function generateActions(
  opportunities: DiscountOpportunity[]
): Promise<GenerationResult> {
  const supabase = getSupabase();
  const result: GenerationResult = {
    total_opportunities: opportunities.length,
    actions_created: 0,
    auto_approved: 0,
    pending_approval: 0,
    errors: [],
  };

  if (opportunities.length === 0) return result;

  // Generate a batch ID for this run
  const batchId = crypto.randomUUID();
  const createdActions: Array<{ id: string; property_name: string; action_category: string }> = [];

  for (const opp of opportunities) {
    try {
      // Check for existing active actions on this property to avoid duplicates
      const { data: existing } = await supabase
        .from('lc_agent_actions')
        .select('id')
        .eq('property_id', opp.property_id)
        .eq('agent_name', AGENT_NAME)
        .in('status', ['proposed', 'approved', 'auto_approved', 'executing'])
        .limit(1);

      if (existing && existing.length > 0) {
        continue; // Already has an active discount action
      }

      // Look up confidence from learning history
      const confidence = await lookupConfidence(supabase, opp);

      // Determine if auto-approve eligible
      const isAutoApproveType = AUTO_APPROVE_TYPES.includes(opp.strategy.type);
      const highConfidence = confidence >= 80;
      const autoApprove = isAutoApproveType && highConfidence && opp.risk_level === 'low';

      // Create one parent action per opportunity (the strategy)
      const parentAction = {
        property_id: opp.property_id,
        agent_name: AGENT_NAME,
        action_type: opp.strategy.type,
        action_category: 'discount' as const,
        execution_channel: opp.actions[0]?.execution_channel || 'playwright_airbnb',
        title: buildTitle(opp),
        description: opp.rationale,
        payload: {
          listing_id: null, // Will be populated from property lookup
          strategy: opp.strategy,
          estimated_60d_median: opp.estimated_60d_median,
          current_base_price: opp.current_base_price,
        },
        expected_impact: opp.estimated_exposure_lift,
        confidence_score: confidence,
        status: autoApprove ? 'auto_approved' : 'proposed',
        priority: opp.risk_level === 'high' ? 'low' as const : opp.risk_level === 'low' ? 'high' as const : 'normal' as const,
        requires_approval: !autoApprove,
        is_revertible: true,
        auto_revert_if_regression: true,
        batch_id: batchId,
      };

      const { data: created, error } = await supabase
        .from('lc_agent_actions')
        .insert(parentAction)
        .select('id')
        .single();

      if (error) {
        result.errors.push(`${opp.property_name}: ${error.message}`);
        continue;
      }

      result.actions_created++;
      if (autoApprove) {
        result.auto_approved++;
      } else {
        result.pending_approval++;
      }

      // Create child actions for each step (rate change + discount set)
      if (opp.actions.length > 1) {
        for (let i = 0; i < opp.actions.length; i++) {
          const act = opp.actions[i];
          await supabase.from('lc_agent_actions').insert({
            property_id: opp.property_id,
            agent_name: AGENT_NAME,
            action_type: act.action_type,
            action_category: 'discount',
            execution_channel: act.execution_channel,
            title: act.description.split('.')[0], // First sentence as title
            description: act.description,
            payload: {
              listing_id: null,
              discount_type: act.discount_type,
              percentage: act.percentage,
              new_base_price: act.new_base_price,
              start_date: act.start_date,
              end_date: act.end_date,
            },
            expected_impact: opp.estimated_exposure_lift,
            confidence_score: confidence,
            status: autoApprove ? 'auto_approved' : 'proposed',
            priority: act.priority,
            requires_approval: !autoApprove,
            is_revertible: true,
            parent_action_id: created.id,
            batch_id: batchId,
          });
        }
      }

      createdActions.push({
        id: created.id,
        property_name: opp.property_name,
        action_category: opp.strategy.type,
      });

      // Send to Slack for approval (if not auto-approved)
      if (!autoApprove && SLACK_CHANNEL) {
        const { data: actionData } = await supabase
          .from('lc_agent_actions')
          .select('*')
          .eq('id', created.id)
          .single();

        if (actionData) {
          const slackTs = await sendActionApprovalRequest(
            { ...actionData, property_name: opp.property_name, market: opp.market },
            SLACK_CHANNEL
          );
          if (slackTs) {
            await supabase
              .from('lc_agent_actions')
              .update({ slack_message_ts: slackTs, slack_channel_id: SLACK_CHANNEL })
              .eq('id', created.id);
          }
        }
      }
    } catch (err) {
      result.errors.push(`${opp.property_name}: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  }

  // Send batch summary to Slack
  if (SLACK_CHANNEL && result.actions_created > 0) {
    const summaryActions = createdActions.map(a => ({
      ...a,
      action_category: 'discount' as const,
    }));
    // Simplified summary notification
    console.log(`[Discount Optimizer] Batch ${batchId}: ${result.actions_created} actions created (${result.auto_approved} auto-approved, ${result.pending_approval} pending)`);
  }

  return result;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function buildTitle(opp: DiscountOpportunity): string {
  switch (opp.strategy.type) {
    case 'email_placement_play':
      return `Email placement play: $${opp.current_base_price} → $${opp.strategy.new_base_price} base, 20% promo → guest pays $${opp.strategy.effective_guest_rate}`;
    case 'strikethrough_play':
      return `Strikethrough play: $${opp.current_base_price} → $${opp.strategy.new_base_price} base, 15% promo → guest pays $${opp.strategy.effective_guest_rate}`;
    case 'los_incentive':
      return `LOS incentive: 10% weekly + 20% monthly discounts to reduce turnover costs`;
    default:
      return `Discount optimization: ${opp.strategy.type}`;
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function lookupConfidence(supabase: any, opp: DiscountOpportunity): Promise<number> {
  // Check learning history for similar actions in this market/tier
  const { data: learnings } = await supabase
    .from('lc_test_learnings')
    .select('outcome, confidence, primary_metric_lift_pct')
    .eq('action_category', 'discount')
    .eq('market', opp.market)
    .eq('quality_tier', opp.quality_tier)
    .limit(10);

  if (!learnings || learnings.length === 0) {
    // No learning history — use risk-based default
    return RISK_CONFIDENCE[opp.risk_level] || 50;
  }

  // Weight by outcome: positive learnings boost confidence, negative reduce it
  let score = RISK_CONFIDENCE[opp.risk_level] || 50;
  const positives = learnings.filter((l: { outcome: string }) => l.outcome === 'positive').length;
  const negatives = learnings.filter((l: { outcome: string }) => l.outcome === 'negative').length;
  const total = learnings.length;

  // Adjust: each positive adds, each negative subtracts
  score += (positives / total) * 20;
  score -= (negatives / total) * 15;

  return Math.max(20, Math.min(95, Math.round(score)));
}
