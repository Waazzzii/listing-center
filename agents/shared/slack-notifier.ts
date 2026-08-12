import {
  postSlackMessage,
  buildApprovalBlocks,
  buildWeeklySummaryBlocks,
  buildAlertBlocks,
  buildTestResultBlocks,
  CHANNELS,
} from '../../src/lib/slack';

// ---- Recommendation Created ----

interface RecommendationNotification {
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

export async function notifyRecommendationCreated(rec: RecommendationNotification): Promise<void> {
  const blocks = buildApprovalBlocks(rec);
  await postSlackMessage(
    CHANNELS.APPROVALS,
    `New recommendation for ${rec.property_name}: ${rec.title}`,
    blocks
  );
}

// ---- Weekly Portfolio Summary ----

interface WeeklySummaryData {
  total_properties: number;
  health_distribution: Record<string, number>;
  new_recommendations: number;
  active_ab_tests: number;
  pending_approvals: number;
  reviews_needing_attention: number;
  top_actions: Array<{ property_name: string; action: string; severity: string }>;
  scan_date: string;
}

export async function notifyWeeklySummary(data: WeeklySummaryData): Promise<void> {
  const blocks = buildWeeklySummaryBlocks(data);
  await postSlackMessage(
    CHANNELS.MAIN,
    `Weekly Listing Center Summary — ${data.total_properties} properties monitored`,
    blocks
  );
}

// ---- Rating Deadline Alert ----

interface RatingDeadlineData {
  count: number;
  accounts_affected: number;
  deadline_date: string;
}

export async function notifyRatingDeadline(data: RatingDeadlineData): Promise<void> {
  const blocks = buildAlertBlocks({
    alert_type: 'rating_deadline',
    title: `Guest rating deadline: ${data.count} ratings due by ${data.deadline_date}`,
    description: `${data.count} guest ratings need to be submitted across ${data.accounts_affected} accounts before the 14-day deadline expires. Failure to submit 5-star ratings impacts Superhost metrics and review score.`,
    urgency: data.count > 5 ? 'critical' : 'high',
  });
  await postSlackMessage(
    CHANNELS.ALERTS,
    `URGENT: ${data.count} guest ratings due by ${data.deadline_date}`,
    blocks
  );
}

// ---- A/B Test Result ----

interface TestResultData {
  property_name: string;
  test_type: string;
  thesis: string;
  result: 'positive' | 'negative' | 'no_change';
  metric_lift: number;
  result_summary: string;
}

export async function notifyTestResult(data: TestResultData): Promise<void> {
  const blocks = buildTestResultBlocks(data);
  await postSlackMessage(
    CHANNELS.MAIN,
    `A/B Test ${data.result}: ${data.property_name} — ${data.result_summary}`,
    blocks
  );
}

// ---- Agent Error ----

export async function notifyAgentError(agentName: string, errorMessage: string): Promise<void> {
  const blocks = buildAlertBlocks({
    alert_type: 'agent_error',
    title: `Agent failure: ${agentName}`,
    description: errorMessage,
    urgency: 'critical',
  });
  await postSlackMessage(
    CHANNELS.ALERTS,
    `AGENT ERROR: ${agentName} — ${errorMessage}`,
    blocks
  );
}

// ---- Scrape Health Warning ----

interface ScrapeHealthData {
  completeness_pct: number;
  properties_scraped: number;
  properties_expected: number;
  accounts_failed: number;
}

export async function notifyScrapeHealth(data: ScrapeHealthData): Promise<void> {
  const blocks = buildAlertBlocks({
    alert_type: 'scrape_health',
    title: 'SCRAPE HEALTH WARNING',
    description: `Only ${data.completeness_pct}% of properties scraped (${data.properties_scraped}/${data.properties_expected}). ${data.accounts_failed} accounts failed. Dashboard data may be stale.`,
    urgency: 'critical',
  });
  await postSlackMessage(
    CHANNELS.ALERTS,
    `SCRAPE HEALTH WARNING: Only ${data.completeness_pct}% completeness`,
    blocks
  );
}

// ---- Scrape Completion (Normal) ----

export async function notifyScrapeComplete(data: {
  properties_scraped: number;
  duration_seconds: number;
  errors_count: number;
}): Promise<void> {
  const blocks = buildAlertBlocks({
    alert_type: 'scrape_complete',
    title: 'Weekly scrape complete',
    description: `${data.properties_scraped} properties scraped in ${Math.round(data.duration_seconds / 60)} minutes. ${data.errors_count > 0 ? `${data.errors_count} errors logged.` : 'No errors.'}`,
    urgency: data.errors_count > 0 ? 'medium' : 'low',
  });
  await postSlackMessage(
    CHANNELS.MAIN,
    `Scrape complete: ${data.properties_scraped} properties`,
    blocks
  );
}
