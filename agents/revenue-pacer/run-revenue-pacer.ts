// agents/revenue-pacer/run-revenue-pacer.ts
// Revenue Pace Agent — monitors revenue pacing and triggers interventions.
//
// This agent doesn't directly make changes. Instead, it:
// 1. Identifies properties pacing behind/at-risk
// 2. Checks if discount or pricing agents already have active actions
// 3. If not, triggers the appropriate agent to propose an intervention
// 4. Escalates to Slack for properties with multiple failed interventions
//
// Think of it as the "orchestrator" that coordinates the other agents.
//
// Usage: npx tsx agents/revenue-pacer/run-revenue-pacer.ts
// Schedule: Twice daily (8am, 2pm)

import { getSupabase } from '../../src/lib/supabase';
import { postSlackMessage } from '../../src/lib/slack';
import type { CommandGridRow } from '../../src/lib/types';

const AGENT_NAME = 'revenue_pacer';
const SLACK_CHANNEL = process.env.SLACK_LISTING_CENTER_CHANNEL || '';

// Intervention thresholds
const PACE_WARNING = 0.80;   // 80% to projection = warning
const PACE_CRITICAL = 0.60;  // 60% to projection = critical
const PACE_EMERGENCY = 0.40; // 40% = emergency escalation

interface PaceAlert {
  property_id: string;
  property_name: string;
  market: string;
  quality_tier: string;
  pct_to_projection: number;
  pace_status: string;
  severity: 'warning' | 'critical' | 'emergency';
  has_active_intervention: boolean;
  recommended_action: string;
}

export async function main() {
  console.log('[Revenue Pacer] Starting pace check...');
  const startTime = Date.now();
  const supabase = getSupabase();

  // Fetch properties with revenue projections
  const columns = [
    'property_id', 'property_name', 'market', 'quality_tier',
    'airbnb_listing_id', 'is_active',
    'wh_occupancy_30d', 'wh_occupancy_120d', 'wh_base_price', 'wh_revpar',
    'health_score', 'health_grade',
  ].join(',');

  const revColumns = [
    'property_id', 'rev_projected', 'rev_booked', 'rev_actual',
    'rev_pct_to_proj', 'rev_pace_status',
  ].join(',');

  const [coreResult, revResult] = await Promise.all([
    supabase.from('lc_command_grid').select(columns),
    supabase.from('lc_command_grid').select(revColumns),
  ]);

  if (coreResult.error) {
    console.error('[Revenue Pacer] Failed to fetch:', coreResult.error.message);
    process.exit(1);
  }

  // Merge
  const revMap = new Map<string, Record<string, unknown>>();
  if (revResult.data) {
    for (const r of revResult.data as unknown as Record<string, unknown>[]) {
      revMap.set(r.property_id as string, r);
    }
  }

  const rows = ((coreResult.data || []) as unknown as Record<string, unknown>[]).map((row) => {
    const rev = revMap.get(row.property_id as string);
    return { ...row, ...rev } as unknown as CommandGridRow;
  });

  console.log(`[Revenue Pacer] Checking ${rows.length} properties`);

  // Identify properties pacing below thresholds
  const alerts: PaceAlert[] = [];

  for (const row of rows) {
    if (!row.is_active) continue;

    const pctToProj = row.rev_pct_to_proj;
    const paceStatus = row.rev_pace_status;
    if (pctToProj === null || pctToProj === undefined) continue;

    let severity: PaceAlert['severity'] | null = null;
    if (pctToProj < PACE_EMERGENCY) severity = 'emergency';
    else if (pctToProj < PACE_CRITICAL) severity = 'critical';
    else if (pctToProj < PACE_WARNING && (paceStatus === 'behind' || paceStatus === 'at_risk')) severity = 'warning';

    if (!severity) continue;

    // Check if there's already an active intervention
    const { data: activeActions } = await supabase
      .from('lc_agent_actions')
      .select('id, agent_name, action_type, status')
      .eq('property_id', row.property_id)
      .in('status', ['proposed', 'approved', 'auto_approved', 'executing'])
      .in('action_category', ['pricing', 'discount'])
      .limit(5);

    const hasIntervention = (activeActions?.length || 0) > 0;

    let recommendedAction = '';
    if (severity === 'emergency') {
      recommendedAction = hasIntervention
        ? 'Escalate to manual review — existing interventions not moving the needle'
        : 'Trigger email placement discount play + 10% base price reduction';
    } else if (severity === 'critical') {
      recommendedAction = hasIntervention
        ? 'Monitor existing interventions — consider escalation if no improvement in 7 days'
        : 'Trigger strikethrough discount play + moderate rate adjustment';
    } else {
      recommendedAction = hasIntervention
        ? 'Existing interventions active — no additional action needed'
        : 'Trigger LOS discount strategy for incremental demand';
    }

    alerts.push({
      property_id: row.property_id,
      property_name: row.property_name,
      market: row.market,
      quality_tier: row.quality_tier,
      pct_to_projection: pctToProj,
      pace_status: paceStatus || 'unknown',
      severity,
      has_active_intervention: hasIntervention,
      recommended_action: recommendedAction,
    });
  }

  // Sort by severity (emergency first)
  const severityOrder: Record<string, number> = { emergency: 1, critical: 2, warning: 3 };
  alerts.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

  console.log(`\n[Revenue Pacer] Found ${alerts.length} pace alerts:`);
  console.log(`  Emergency: ${alerts.filter(a => a.severity === 'emergency').length}`);
  console.log(`  Critical: ${alerts.filter(a => a.severity === 'critical').length}`);
  console.log(`  Warning: ${alerts.filter(a => a.severity === 'warning').length}`);
  console.log(`  With existing interventions: ${alerts.filter(a => a.has_active_intervention).length}`);

  // Create pace monitoring actions for unaddressed properties
  const needsIntervention = alerts.filter(a => !a.has_active_intervention && a.severity !== 'warning');
  let actionsCreated = 0;

  for (const alert of needsIntervention) {
    const { error } = await supabase.from('lc_agent_actions').insert({
      property_id: alert.property_id,
      agent_name: AGENT_NAME,
      action_type: 'pace_intervention',
      action_category: alert.severity === 'emergency' ? 'pricing' : 'discount',
      execution_channel: 'manual',
      title: `Revenue pace ${alert.severity}: ${(alert.pct_to_projection * 100).toFixed(0)}% to projection`,
      description: `${alert.property_name} (${alert.market}) is at ${(alert.pct_to_projection * 100).toFixed(0)}% of revenue projection. ${alert.recommended_action}`,
      payload: {
        pct_to_projection: alert.pct_to_projection,
        pace_status: alert.pace_status,
        severity: alert.severity,
      },
      expected_impact: 'Revenue recovery toward projection',
      confidence_score: null,
      status: 'proposed',
      priority: alert.severity === 'emergency' ? 'critical' : 'high',
      requires_approval: true,
      is_revertible: false,
    });

    if (!error) actionsCreated++;
  }

  // Send Slack summary for emergency/critical alerts
  if (SLACK_CHANNEL && alerts.length > 0) {
    const emergencies = alerts.filter(a => a.severity === 'emergency');
    const criticals = alerts.filter(a => a.severity === 'critical');

    if (emergencies.length > 0 || criticals.length > 0) {
      const emergencyLines = emergencies.map(a =>
        `  :rotating_light: *${a.property_name}* (${a.market}) — ${(a.pct_to_projection * 100).toFixed(0)}% to proj ${a.has_active_intervention ? '(intervention active)' : '*NEEDS ACTION*'}`
      );
      const criticalLines = criticals.map(a =>
        `  :red_circle: *${a.property_name}* (${a.market}) — ${(a.pct_to_projection * 100).toFixed(0)}% to proj ${a.has_active_intervention ? '(intervention active)' : '*NEEDS ACTION*'}`
      );

      const text = [
        `:chart_with_downwards_trend: *Revenue Pace Alert* — ${alerts.length} properties flagged`,
        '',
        ...(emergencyLines.length > 0 ? ['*Emergency:*', ...emergencyLines, ''] : []),
        ...(criticalLines.length > 0 ? ['*Critical:*', ...criticalLines.slice(0, 10), ''] : []),
        `${actionsCreated} new intervention actions created.`,
      ].join('\n');

      await postSlackMessage(SLACK_CHANNEL, text, [
        { type: 'section', text: { type: 'mrkdwn', text } },
      ]);
    }
  }

  const duration = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n[Revenue Pacer] Completed in ${duration}s: ${actionsCreated} actions created`);
}

main().catch((err) => {
  console.error('[Revenue Pacer] Fatal error:', err);
  process.exit(1);
});
