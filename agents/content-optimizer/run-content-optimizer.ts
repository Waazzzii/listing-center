// agents/content-optimizer/run-content-optimizer.ts
// Listing Content Optimization Agent.
//
// Analyzes listing completeness, title quality, amenity gaps, and photo counts
// to generate content improvement actions that boost CTR and conversion.
//
// What OTAs reward:
//   Airbnb: 20+ photos, 100% amenity completeness, keyword-rich title,
//           Instant Book, <1hr response time, >88% acceptance rate, Superhost
//   VRBO:   Premier Partner, fast response, high booking acceptance
//   Booking.com: Genius program, free cancellation, mobile rates
//
// Usage: npx tsx agents/content-optimizer/run-content-optimizer.ts
// Schedule: Weekly (Monday 6am)

import { getSupabase } from '../../src/lib/supabase';
import { sendActionApprovalRequest } from '../../src/lib/slack-action-notifier';
import type { CommandGridRow } from '../../src/lib/types';

const AGENT_NAME = 'content_optimizer';
const SLACK_CHANNEL = process.env.SLACK_LISTING_CENTER_CHANNEL || '';

// Content quality thresholds
const MIN_PHOTOS = 20;
const IDEAL_PHOTOS = 30;
const CTR_CONCERN = 0.04;  // Below 4% CTR = mid-funnel issue
const CONVERSION_CONCERN = 0.02; // Below 2% conversion = bottom-funnel issue

interface ContentOpportunity {
  property_id: string;
  property_name: string;
  market: string;
  issues: ContentIssue[];
  priority: 'high' | 'normal' | 'low';
}

interface ContentIssue {
  type: 'title' | 'description' | 'amenities' | 'photos' | 'instant_book' | 'cancellation' | 'response_time';
  action_type: string;
  title: string;
  description: string;
  expected_impact: string;
  execution_channel: string;
}

export async function main() {
  console.log('[Content Optimizer] Starting analysis...');
  const startTime = Date.now();
  const supabase = getSupabase();

  const columns = [
    'property_id', 'property_name', 'market', 'quality_tier',
    'airbnb_listing_id', 'is_active',
    'airbnb_first_page_impression_rate', 'airbnb_search_to_listing_ctr',
    'airbnb_listing_to_booking_conversion', 'airbnb_page_views',
    'airbnb_overall_rating', 'airbnb_review_count',
    'health_status', 'funnel_bottleneck',
    'health_score', 'health_grade',
  ].join(',');

  const { data: coreData, error } = await supabase.from('lc_command_grid').select(columns);
  if (error) {
    console.error('[Content Optimizer] Failed to fetch:', error.message);
    process.exit(1);
  }

  const rows = (coreData || []) as unknown as CommandGridRow[];
  console.log(`[Content Optimizer] Loaded ${rows.length} properties`);

  // Also fetch exposure benchmarks for context
  const { data: benchmarks } = await supabase
    .from('lc_exposure_benchmarks')
    .select('market, quality_tier, channel, min_photo_count, min_amenity_count, min_review_score, min_review_count')
    .eq('channel', 'airbnb')
    .eq('is_active', true);

  const benchmarkMap = new Map<string, Record<string, unknown>>();
  if (benchmarks) {
    for (const b of benchmarks as Record<string, unknown>[]) {
      benchmarkMap.set(`${b.market}_${b.quality_tier}`, b);
    }
  }

  // Analyze each property for content issues
  const opportunities: ContentOpportunity[] = [];

  for (const row of rows) {
    if (!row.is_active || !row.airbnb_listing_id) continue;

    const issues: ContentIssue[] = [];
    const ctr = row.airbnb_search_to_listing_ctr;
    const conversion = row.airbnb_listing_to_booking_conversion;
    const bottleneck = row.funnel_bottleneck;

    // Mid-funnel issue (low CTR) → title and hero photo optimization
    if (ctr !== null && ctr < CTR_CONCERN) {
      issues.push({
        type: 'title',
        action_type: 'title_update',
        title: 'Rewrite listing title for better search CTR',
        description: `CTR at ${(ctr * 100).toFixed(1)}% is below ${(CTR_CONCERN * 100)}% threshold. Title should lead with the most compelling feature (pool, view, location name) and include the market name for search ranking. Avoid generic words like "beautiful" or "cozy" — be specific.`,
        expected_impact: '+5-15% CTR improvement from title optimization',
        execution_channel: 'playwright_airbnb',
      });
    }

    // Bottom-funnel issue (low conversion) → description completeness
    if (conversion !== null && conversion < CONVERSION_CONCERN) {
      issues.push({
        type: 'description',
        action_type: 'description_update',
        title: 'Update description — missing conversion-critical details',
        description: `Conversion at ${(conversion * 100).toFixed(1)}% is below ${(CONVERSION_CONCERN * 100)}% threshold. Audit description for: coffee/beverage station, sleep quality (mattress, blackout curtains), kitchen completeness, workspace details, parking specifics, pool/spa details, checkout time. Each missing detail loses ~1% of potential bookers.`,
        expected_impact: '+0.5-2.0% absolute conversion lift',
        execution_channel: 'playwright_airbnb',
      });
    }

    // Low review score (below 4.5)
    if (row.airbnb_overall_rating !== null && row.airbnb_overall_rating < 4.5 && row.airbnb_review_count !== null && row.airbnb_review_count >= 3) {
      issues.push({
        type: 'amenities',
        action_type: 'amenity_toggle',
        title: 'Amenity audit — ensure 100% completeness to improve search ranking',
        description: `Rating at ${row.airbnb_overall_rating} is below 4.5. Complete amenity checklist helps filter visibility. Verify every amenity is checked, especially: WiFi speed, EV charger, dedicated workspace, pool type, hot tub, BBQ grill, washer/dryer, parking type.`,
        expected_impact: 'Improved search filter visibility and guest expectations alignment',
        execution_channel: 'playwright_airbnb',
      });
    }

    // Funnel bottleneck at mid = hero photo issue
    if (bottleneck === 'mid') {
      issues.push({
        type: 'photos',
        action_type: 'photo_reorder',
        title: 'Hero photo audit — first image determines click-through',
        description: `Funnel bottleneck is at mid-funnel (impressions→clicks). The hero photo is the single biggest CTR lever. Check: Does it crop well to thumbnail? Is it bright and inviting? Does it establish the most compelling feature of the space? Test: aerial shot, pool shot, or wide living area shot.`,
        expected_impact: '+30-200% CTR improvement from hero photo swap (proven by A/B tests)',
        execution_channel: 'playwright_airbnb',
      });
    }

    if (issues.length > 0) {
      const priority = issues.length >= 3 ? 'high' : issues.length >= 2 ? 'normal' : 'low';
      opportunities.push({
        property_id: row.property_id,
        property_name: row.property_name,
        market: row.market,
        issues,
        priority,
      });
    }
  }

  console.log(`[Content Optimizer] Found ${opportunities.length} properties with content issues`);

  // Create agent actions
  const batchId = crypto.randomUUID();
  let created = 0;

  for (const opp of opportunities) {
    // Skip if already has active content actions
    const { data: existing } = await supabase
      .from('lc_agent_actions')
      .select('id')
      .eq('property_id', opp.property_id)
      .eq('agent_name', AGENT_NAME)
      .in('status', ['proposed', 'approved', 'auto_approved', 'executing'])
      .limit(1);

    if (existing && existing.length > 0) continue;

    // Create one action per issue
    for (const issue of opp.issues) {
      const { data: action, error: insertErr } = await supabase
        .from('lc_agent_actions')
        .insert({
          property_id: opp.property_id,
          agent_name: AGENT_NAME,
          action_type: issue.action_type,
          action_category: 'content',
          execution_channel: issue.execution_channel,
          title: issue.title,
          description: `[${opp.property_name} — ${opp.market}]\n\n${issue.description}`,
          payload: { listing_id: null }, // Populated at execution time
          expected_impact: issue.expected_impact,
          confidence_score: 60,
          status: 'proposed',
          priority: opp.priority,
          requires_approval: true,
          is_revertible: issue.type !== 'amenities', // Amenity toggles are easy to revert
          auto_revert_if_regression: issue.type === 'title' || issue.type === 'photos',
          batch_id: batchId,
        })
        .select('*')
        .single();

      if (insertErr) {
        console.error(`  Error for ${opp.property_name}: ${insertErr.message}`);
        continue;
      }

      created++;

      // Send to Slack
      if (SLACK_CHANNEL && action) {
        await sendActionApprovalRequest(
          { ...action, property_name: opp.property_name, market: opp.market },
          SLACK_CHANNEL
        );
      }
    }
  }

  const duration = ((Date.now() - startTime) / 1000).toFixed(1);
  const totalIssues = opportunities.reduce((sum, o) => sum + o.issues.length, 0);
  console.log(`\n[Content Optimizer] Completed in ${duration}s`);
  console.log(`  Properties with issues: ${opportunities.length}`);
  console.log(`  Total issues found: ${totalIssues}`);
  console.log(`  Actions created: ${created}`);
}

main().catch((err) => {
  console.error('[Content Optimizer] Fatal error:', err);
  process.exit(1);
});
