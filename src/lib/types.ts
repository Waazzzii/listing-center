// ===== CORE ENTITIES =====

export type HealthStatus = 'red' | 'orange' | 'yellow' | 'green' | 'blue_spell' | 'unknown';
export type QualityTier = 'standard' | 'silver' | 'gold' | 'platinum' | 'diamond';
export type FunnelStage = 'top' | 'mid' | 'bottom' | 'none';
export type Market = 'scottsdale' | 'tucson' | 'sedona' | 'coachella' | 'central_coast' | 'orange_county' | 'lake_arrowhead';

export interface LcProperty {
  id: string;
  streamline_unit_id: string;
  property_name: string;
  market: Market;
  quality_tier: QualityTier;
  quality_tier_numeric: number;
  airbnb_listing_id: string | null;
  airbnb_account_id: number | null;
  vrbo_listing_id: string | null;
  booking_property_id: string | null;
  bedrooms: number | null;
  bathrooms: number | null;
  max_occupancy: number | null;
  property_type: string | null;
  adr_range: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface LcMetricSnapshot {
  id: string;
  property_id: string;
  snapshot_date: string;
  snapshot_source: string;
  scrape_completeness: 'complete' | 'partial' | 'failed';
  pages_scraped: number | null;
  scrape_run_id: string | null;

  airbnb_overall_conversion_rate: number | null;
  airbnb_first_page_impression_rate: number | null;
  airbnb_search_to_listing_ctr: number | null;
  airbnb_listing_to_booking_conversion: number | null;

  airbnb_page_views: number | null;
  airbnb_first_page_impressions: number | null;
  airbnb_wishlist_additions: number | null;

  airbnb_booking_lead_time_days: number | null;
  airbnb_returning_guest_rate: number | null;

  airbnb_occupancy_rate: number | null;
  airbnb_nights_booked: number | null;
  airbnb_nights_blocked: number | null;
  airbnb_unbooked_nights: number | null;
  airbnb_check_ins: number | null;
  airbnb_cancellation_rate: number | null;
  airbnb_avg_length_of_stay_days: number | null;
  airbnb_avg_nightly_rate: number | null;

  airbnb_overall_rating: number | null;
  airbnb_5star_overall_pct: number | null;
  airbnb_review_count: number | null;

  airbnb_superhost_status: string | null;
  airbnb_has_issues: boolean;

  health_status: HealthStatus;
  previous_health_status: HealthStatus | null;
  priority_score: number | null;
  funnel_bottleneck: FunnelStage | null;

  created_at: string;
}

export interface LcLatestSnapshot extends LcMetricSnapshot {
  property_name: string;
  market: Market;
  quality_tier: QualityTier;
  quality_tier_numeric: number;
  airbnb_listing_id: string | null;
  bedrooms: number | null;
  property_type: string | null;
  is_active: boolean;
}

export interface LcBenchmark {
  id: string;
  quality_tier: QualityTier;
  market: string | null;
  season: string | null;
  impression_rate_low: number;
  impression_rate_high: number;
  ctr_low: number;
  ctr_high: number;
  conversion_low: number;
  conversion_high: number;
  impression_rate_critical: number;
  ctr_critical: number;
  conversion_critical: number;
  is_active: boolean;
}

// ===== WORKFLOW ENTITIES =====

export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'auto_approved';
export type RecommendationStatus = 'pending' | 'approved' | 'rejected' | 'deferred' | 'expired' | 'auto_executed';
export type ABTestStatus = 'pending' | 'active' | 'snapshot_due' | 'completed' | 'cancelled';
export type ABTestResult = 'positive' | 'negative' | 'no_change';

export interface LcRecommendation {
  id: string;
  property_id: string;
  agent_name: string;
  recommendation_type: string;
  title: string;
  description: string;
  predicted_impact: string | null;
  diagnosed_issue: string | null;
  funnel_stage: FunnelStage | null;
  severity: string | null;
  proposed_change: Record<string, unknown> | null;
  status: RecommendationStatus;
  reviewed_by: string | null;
  reviewed_at: string | null;
  rejection_reason: string | null;
  defer_until: string | null;
  change_log_id: string | null;
  ab_test_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface LcABTest {
  id: string;
  property_id: string;
  test_type: string;
  thesis: string;
  target_metric: string;
  before_snapshot_date: string | null;
  before_metrics: Record<string, number> | null;
  change_description: string;
  change_executed_date: string | null;
  after_snapshot_due_date: string | null;
  after_snapshot_date: string | null;
  after_metrics: Record<string, number> | null;
  status: ABTestStatus;
  result: ABTestResult | null;
  metric_lift: number | null;
  result_summary: string | null;
  decision: string | null;
  minimum_impressions: number;
  soak_period_days: number | null;
  created_at: string;
  updated_at: string;
}

export interface LcChangeLog {
  id: string;
  property_id: string;
  change_date: string;
  change_type: string;
  change_source: string;
  field_changed: string | null;
  old_value: string | null;
  new_value: string | null;
  thesis: string | null;
  diagnosed_issue: string | null;
  predicted_impact: string | null;
  approval_status: ApprovalStatus;
  execution_status: string;
  ab_test_id: string | null;
  created_at: string;
}

// ===== REVIEW ENTITIES =====

export interface LcReview {
  id: string;
  property_id: string;
  channel: string;
  guest_name: string | null;
  review_date: string | null;
  rating: number | null;
  review_text: string | null;
  response_status: string;
  response_text: string | null;
  sentiment: string | null;
  themes: string[] | null;
  created_at: string;
}

export interface LcGuestRating {
  id: string;
  property_id: string;
  airbnb_account_id: number;
  guest_name: string;
  checkout_date: string;
  rating_deadline: string;
  submission_status: string;
  days_until_deadline: number;
  is_urgent: boolean;
}

// ===== OPERATIONAL ENTITIES =====

export interface LcScrapeRun {
  id: string;
  run_date: string;
  run_type: string;
  accounts_processed: number;
  accounts_failed: number;
  properties_scraped: number;
  properties_expected: number | null;
  completeness_pct: number | null;
  started_at: string;
  completed_at: string | null;
  duration_seconds: number | null;
  errors: unknown[] | null;
  is_healthy: boolean;
}

export interface LcAgentExecution {
  id: string;
  agent_name: string;
  execution_type: string;
  started_at: string;
  completed_at: string | null;
  status: string;
  properties_processed: number | null;
  properties_skipped: number | null;
  results_summary: Record<string, unknown> | null;
}

// ===== PORTFOLIO SUMMARY =====

export interface PortfolioSummary {
  total_properties: number;
  avg_ctr: number | null;
  avg_conversion: number | null;
  avg_impression_rate: number | null;
  red_count: number;
  orange_count: number;
  yellow_count: number;
  green_count: number;
  blue_count: number;
  unknown_count: number;
  last_scan_date: string | null;
}

// ===== WHEELHOUSE ENTITIES =====

export interface LcWheelhouseKpi {
  id: string;
  property_id: string;
  sync_date: string;
  channel: string;
  adjusted_occupancy_30d: number | null;
  occupancy_30d: number | null;
  available_nights_30d: number | null;
  average_asking_rate: number | null;
  average_nightly_rate: number | null;
  adjusted_nightly_revpar: number | null;
  nightly_revpar: number | null;
  last_booked_at: string | null;
  booked_nights_30d: number | null;
  adjusted_occupancy_120d: number | null;
  occupancy_120d: number | null;
  available_nights_120d: number | null;
  booked_nights_120d: number | null;
  nightly_revpar_120d: number | null;
  base_price_selected: number | null;
  base_price_recommended: number | null;
  base_price_conservative: number | null;
  base_price_aggressive: number | null;
  anchor_credibility: number | null;
  anchor_price: number | null;
  price_alignment_pct: number | null;
  wheelhouse_flags: string[];
  auto_rate_posting_enabled: boolean;
  created_at: string;
}

export interface LcHealthScore {
  id: string;
  property_id: string;
  score_date: string;
  overall_score: number;
  overall_grade: string;
  search_visibility_score: number | null;
  ctr_score: number | null;
  conversion_score: number | null;
  listing_completeness_score: number | null;
  guest_rating_score: number | null;
  base_price_alignment_score: number | null;
  revenue_vs_projection_score: number | null;
  forward_occupancy_score: number | null;
  pricing_strategy_score: number | null;
  weights: Record<string, number>;
  previous_score: number | null;
  score_delta: number | null;
  channels_active: string[];
  created_at: string;
}

export type PaceStatus = 'ahead' | 'on_track' | 'behind' | 'at_risk';

export interface LcRevenueProjection {
  id: string;
  property_id: string;
  projection_date: string;
  month_1_label: string;
  month_1_projected: number;
  month_1_actual: number;
  month_1_booked: number;
  month_1_pct_to_projection: number;
  month_2_label: string;
  month_2_projected: number;
  month_2_actual: number;
  month_2_booked: number;
  month_2_pct_to_projection: number;
  month_3_label: string;
  month_3_projected: number;
  month_3_actual: number;
  month_3_booked: number;
  month_3_pct_to_projection: number;
  month_4_label: string;
  month_4_projected: number;
  month_4_actual: number;
  month_4_booked: number;
  month_4_pct_to_projection: number;
  total_projected: number;
  total_booked: number;
  total_actual: number;
  total_pct_to_projection: number;
  pace_status: PaceStatus;
  avg_asking_rate: number | null;
  revpar: number | null;
  created_at: string;
}

// ===== COMMAND GRID (joined view) =====

export interface CommandGridRow {
  property_id: string;
  property_name: string;
  market: Market;
  quality_tier: QualityTier;
  quality_tier_numeric: number;
  airbnb_listing_id: string | null;
  vrbo_listing_id: string | null;
  booking_property_id: string | null;
  bedrooms: number | null;
  property_type: string | null;
  is_active: boolean;

  // Airbnb metrics
  snapshot_date: string | null;
  airbnb_first_page_impression_rate: number | null;
  airbnb_search_to_listing_ctr: number | null;
  airbnb_listing_to_booking_conversion: number | null;
  airbnb_overall_conversion_rate: number | null;
  airbnb_page_views: number | null;
  airbnb_wishlist_additions: number | null;
  airbnb_overall_rating: number | null;
  airbnb_review_count: number | null;
  airbnb_avg_nightly_rate: number | null;
  airbnb_occupancy_rate: number | null;
  health_status: HealthStatus;
  previous_health_status: HealthStatus | null;
  priority_score: number | null;
  funnel_bottleneck: FunnelStage | null;

  // Wheelhouse
  wh_occupancy_30d: number | null;
  wh_occupancy_120d: number | null;
  wh_asking_rate: number | null;
  wh_revpar: number | null;
  wh_base_price: number | null;
  wh_recommended_price: number | null;
  wh_price_alignment: number | null;
  wh_anchor_credibility: number | null;
  wh_auto_rates: boolean | null;
  wh_flags: string[] | null;
  wh_last_booked: string | null;
  wh_booked_30d: number | null;

  // Health score
  health_score: number | null;
  health_grade: string | null;
  health_score_prev: number | null;
  health_score_delta: number | null;
  channels_active: string[] | null;

  // Revenue projection
  rev_projected: number | null;
  rev_booked: number | null;
  rev_actual: number | null;
  rev_pct_to_proj: number | null;
  rev_pace_status: PaceStatus | null;

  // Counts
  pending_actions: number;
  active_tests: number;

  // Agent action counts (from updated view)
  proposed_actions: number;
  approved_actions: number;
  executing_actions: number;
  completed_actions_7d: number;
}

export interface CommandGridSummary {
  total_properties: number;
  avg_health_score: number | null;
  grade_a_count: number;
  grade_b_count: number;
  grade_c_count: number;
  grade_d_count: number;
  unscored_count: number;
  avg_revpar: number | null;
  avg_occupancy_30d: number | null;
  avg_occupancy_120d: number | null;
  avg_pct_to_projection: number | null;
  pace_ahead_count: number;
  pace_on_track_count: number;
  pace_behind_count: number;
  pace_at_risk_count: number;
  total_pending_actions: number;
  total_active_tests: number;
  avg_price_alignment: number | null;
  total_proposed_actions: number;
  total_approved_actions: number;
  total_executing_actions: number;
  total_completed_actions_7d: number;
}

// ===== AGENT EXECUTION FRAMEWORK =====

export type ActionStatus =
  | 'proposed'
  | 'approved'
  | 'auto_approved'
  | 'executing'
  | 'completed'
  | 'failed'
  | 'reverted'
  | 'cancelled'
  | 'expired';

export type ActionCategory = 'pricing' | 'discount' | 'content' | 'exposure' | 'other';

export type ExecutionChannel =
  | 'wheelhouse_api'
  | 'playwright_airbnb'
  | 'playwright_vrbo'
  | 'playwright_booking'
  | 'streamline_api'
  | 'manual';

export type ActionPriority = 'critical' | 'high' | 'normal' | 'low';

export interface AgentAction {
  id: string;
  property_id: string;
  agent_name: string;
  agent_run_id: string | null;
  action_type: string;
  action_category: ActionCategory;
  execution_channel: ExecutionChannel;
  title: string;
  description: string | null;
  payload: Record<string, unknown>;
  expected_impact: string | null;
  confidence_score: number | null;
  status: ActionStatus;
  priority: ActionPriority;
  requires_approval: boolean;
  approved_by: string | null;
  approved_at: string | null;
  rejection_reason: string | null;
  slack_message_ts: string | null;
  slack_channel_id: string | null;
  executed_at: string | null;
  execution_result: Record<string, unknown> | null;
  execution_error: string | null;
  retry_count: number;
  max_retries: number;
  is_revertible: boolean;
  revert_action_id: string | null;
  reverted_at: string | null;
  revert_reason: string | null;
  auto_revert_if_regression: boolean;
  state_snapshot_id: string | null;
  ab_test_id: string | null;
  measurement_due_at: string | null;
  measurement_result: Record<string, unknown> | null;
  recommendation_id: string | null;
  parent_action_id: string | null;
  batch_id: string | null;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ActionQueueRow {
  id: string;
  property_id: string;
  property_name: string;
  market: Market;
  quality_tier: QualityTier;
  agent_name: string;
  action_type: string;
  action_category: ActionCategory;
  execution_channel: ExecutionChannel;
  title: string;
  description: string | null;
  expected_impact: string | null;
  confidence_score: number | null;
  status: ActionStatus;
  priority: ActionPriority;
  requires_approval: boolean;
  approved_by: string | null;
  approved_at: string | null;
  executed_at: string | null;
  is_revertible: boolean;
  auto_revert_if_regression: boolean;
  measurement_due_at: string | null;
  batch_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface ActionState {
  id: string;
  action_id: string;
  property_id: string;
  snapshot_type: 'before' | 'after';
  listing_state: Record<string, unknown>;
  metrics: Record<string, unknown>;
  exposure_metrics: Record<string, unknown>;
  captured_at: string;
}

export interface ExposureBenchmark {
  id: string;
  market: string;
  quality_tier: string;
  season: string;
  channel: string;
  expected_impression_rate: number | null;
  expected_ctr: number | null;
  expected_conversion: number | null;
  impression_rate_floor: number | null;
  ctr_floor: number | null;
  conversion_floor: number | null;
  expected_search_rank_pctile: number | null;
  min_photo_count: number;
  min_amenity_count: number;
  min_review_score: number;
  min_review_count: number;
  min_response_rate: number;
  strikethrough_discount_pct: number;
  email_placement_discount_pct: number;
  custom_promotion_min_pct: number;
  expected_revpar: number | null;
  expected_occupancy_30d: number | null;
  expected_adr: number | null;
  is_active: boolean;
  updated_at: string;
  created_at: string;
}

export interface TestLearning {
  id: string;
  action_type: string;
  action_category: string;
  market: string | null;
  quality_tier: string | null;
  season: string | null;
  property_type: string | null;
  bedrooms: number | null;
  change_summary: string;
  payload_pattern: Record<string, unknown> | null;
  outcome: 'positive' | 'negative' | 'neutral';
  primary_metric_name: string | null;
  primary_metric_before: number | null;
  primary_metric_after: number | null;
  primary_metric_lift_pct: number | null;
  metrics_before: Record<string, unknown> | null;
  metrics_after: Record<string, unknown> | null;
  soak_period_days: number | null;
  sample_size: number;
  confidence: number | null;
  action_id: string | null;
  ab_test_id: string | null;
  created_at: string;
}
