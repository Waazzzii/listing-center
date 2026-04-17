-- migration-agent-actions.sql
-- Phase B-1a: Agent Execution Framework
-- Creates the action queue, state snapshots, and exposure benchmarks.
-- Run against Supabase SQL editor.

-- ─── Table: lc_agent_actions ────────────────────────────────────────────────
-- Universal action queue. Every optimization agent writes here.
-- Actions flow: proposed -> approved -> executing -> completed | failed | reverted
-- High-confidence actions can skip approval (auto_approved).

CREATE TABLE IF NOT EXISTS lc_agent_actions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  property_id uuid NOT NULL REFERENCES lc_properties(id),

  -- Who proposed this
  agent_name text NOT NULL,          -- pricing_optimizer, discount_optimizer, content_optimizer, etc.
  agent_run_id uuid,                 -- links to lc_agent_executions row

  -- What kind of action
  action_type text NOT NULL,         -- rate_change, discount_set, description_update, amenity_toggle, photo_reorder, promotion_set, etc.
  action_category text NOT NULL,     -- pricing, discount, content, exposure, other
  execution_channel text NOT NULL,   -- wheelhouse_api, playwright_airbnb, playwright_vrbo, playwright_booking, streamline_api, manual

  -- The action itself
  title text NOT NULL,
  description text,
  payload jsonb NOT NULL DEFAULT '{}',  -- channel-specific execution payload
  expected_impact text,                 -- human-readable predicted outcome
  confidence_score numeric,             -- 0-100, from learning engine. >80 = auto-approve eligible

  -- Lifecycle
  status text NOT NULL DEFAULT 'proposed',  -- proposed, approved, auto_approved, executing, completed, failed, reverted, cancelled, expired
  priority text NOT NULL DEFAULT 'normal',  -- critical, high, normal, low

  -- Approval
  requires_approval boolean NOT NULL DEFAULT true,
  approved_by text,
  approved_at timestamptz,
  rejection_reason text,
  slack_message_ts text,             -- for updating the Slack message after action completes
  slack_channel_id text,

  -- Execution
  executed_at timestamptz,
  execution_result jsonb,            -- response from Wheelhouse API, Playwright result, etc.
  execution_error text,
  retry_count integer DEFAULT 0,
  max_retries integer DEFAULT 2,

  -- Revert
  is_revertible boolean NOT NULL DEFAULT true,
  revert_action_id uuid,            -- if this IS a revert, points to original
  reverted_at timestamptz,
  revert_reason text,
  auto_revert_if_regression boolean DEFAULT false,  -- continuous testing: revert if metrics drop

  -- Measurement
  state_snapshot_id uuid,            -- points to lc_action_states (before state)
  ab_test_id uuid REFERENCES lc_ab_tests(id),
  measurement_due_at timestamptz,    -- when to check results
  measurement_result jsonb,          -- post-action metrics

  -- Linking
  recommendation_id uuid REFERENCES lc_recommendations(id),
  parent_action_id uuid,             -- for chained actions (e.g. raise price then set discount)
  batch_id uuid,                     -- group related actions across properties

  -- Timestamps
  expires_at timestamptz,            -- auto-expire if not approved by this time
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_actions_property ON lc_agent_actions(property_id);
CREATE INDEX idx_actions_status ON lc_agent_actions(status);
CREATE INDEX idx_actions_agent ON lc_agent_actions(agent_name);
CREATE INDEX idx_actions_category ON lc_agent_actions(action_category);
CREATE INDEX idx_actions_batch ON lc_agent_actions(batch_id) WHERE batch_id IS NOT NULL;
CREATE INDEX idx_actions_created ON lc_agent_actions(created_at DESC);
CREATE INDEX idx_actions_pending ON lc_agent_actions(status, priority) WHERE status IN ('proposed', 'approved');


-- ─── Table: lc_action_states ────────────────────────────────────────────────
-- Before/after state snapshots for any action.
-- Enables precise revert and impact measurement.

CREATE TABLE IF NOT EXISTS lc_action_states (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  action_id uuid NOT NULL REFERENCES lc_agent_actions(id) ON DELETE CASCADE,
  property_id uuid NOT NULL REFERENCES lc_properties(id),
  snapshot_type text NOT NULL,       -- before, after

  -- Listing state at time of snapshot
  listing_state jsonb NOT NULL DEFAULT '{}',
  -- Example structure:
  -- {
  --   "base_price": 250,
  --   "discounts": { "weekly": 10, "monthly": 20, "custom_promotion": 15, "early_bird": 5 },
  --   "title": "Stunning Desert Retreat...",
  --   "description": "...",
  --   "amenities_count": 45,
  --   "photo_count": 32,
  --   "hero_photo_url": "...",
  --   "cancellation_policy": "moderate",
  --   "instant_book": true,
  --   "min_nights": 2,
  --   "max_nights": 30,
  --   "ota_settings": { "airbnb": {...}, "vrbo": {...}, "booking": {...} }
  -- }

  -- Performance metrics at time of snapshot
  metrics jsonb NOT NULL DEFAULT '{}',
  -- Example structure:
  -- {
  --   "impression_rate": 0.42,
  --   "ctr": 0.065,
  --   "conversion": 0.028,
  --   "page_views": 312,
  --   "occupancy_30d": 0.72,
  --   "revpar": 185,
  --   "avg_nightly_rate": 280,
  --   "review_score": 4.87,
  --   "health_score": 74
  -- }

  -- Exposure metrics at time of snapshot
  exposure_metrics jsonb DEFAULT '{}',
  -- {
  --   "airbnb_search_rank": 12,
  --   "airbnb_category_rank": 5,
  --   "strikethrough_active": true,
  --   "email_placement_eligible": false,
  --   "vrbo_premier_status": true,
  --   "booking_genius_eligible": false
  -- }

  captured_at timestamptz DEFAULT now()
);

CREATE INDEX idx_action_states_action ON lc_action_states(action_id);
CREATE INDEX idx_action_states_property ON lc_action_states(property_id);


-- ─── Table: lc_exposure_benchmarks ──────────────────────────────────────────
-- Expected vs actual exposure rates by market/tier/season/channel.
-- Agents use these to know when a listing is underperforming.

CREATE TABLE IF NOT EXISTS lc_exposure_benchmarks (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  market text NOT NULL,
  quality_tier text NOT NULL,
  season text NOT NULL,              -- peak, shoulder, low
  channel text NOT NULL,             -- airbnb, vrbo, booking

  -- Expected funnel rates
  expected_impression_rate numeric,  -- first page impression %
  expected_ctr numeric,              -- search to listing click-through
  expected_conversion numeric,       -- listing to booking conversion

  -- Thresholds for agent triggers
  impression_rate_floor numeric,     -- below this = agent intervenes
  ctr_floor numeric,
  conversion_floor numeric,

  -- Exposure-specific benchmarks
  expected_search_rank_pctile numeric,  -- e.g. top 25% = 0.25
  min_photo_count integer DEFAULT 20,
  min_amenity_count integer DEFAULT 30,
  min_review_score numeric DEFAULT 4.5,
  min_review_count integer DEFAULT 5,
  min_response_rate numeric DEFAULT 0.95,

  -- Airbnb merchandising thresholds
  strikethrough_discount_pct numeric DEFAULT 10,   -- 10% off 60-day median triggers strikethrough
  email_placement_discount_pct numeric DEFAULT 20, -- 20% off triggers email feature
  custom_promotion_min_pct numeric DEFAULT 10,     -- min custom promotion %

  -- Revenue benchmarks
  expected_revpar numeric,
  expected_occupancy_30d numeric,
  expected_adr numeric,

  is_active boolean DEFAULT true,
  updated_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),

  UNIQUE(market, quality_tier, season, channel)
);

CREATE INDEX idx_benchmarks_lookup ON lc_exposure_benchmarks(market, quality_tier, season, channel);


-- ─── Table: lc_test_learnings ───────────────────────────────────────────────
-- Accumulated knowledge from completed actions and A/B tests.
-- Agents reference this to improve confidence scores over time.

CREATE TABLE IF NOT EXISTS lc_test_learnings (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  action_type text NOT NULL,
  action_category text NOT NULL,

  -- Context tags for matching future situations
  market text,
  quality_tier text,
  season text,
  property_type text,
  bedrooms integer,

  -- What was done
  change_summary text NOT NULL,
  payload_pattern jsonb,             -- abstracted payload for pattern matching

  -- Results
  outcome text NOT NULL,             -- positive, negative, neutral
  primary_metric_name text,
  primary_metric_before numeric,
  primary_metric_after numeric,
  primary_metric_lift_pct numeric,

  -- All measured metrics
  metrics_before jsonb,
  metrics_after jsonb,
  soak_period_days integer,

  -- Confidence
  sample_size integer DEFAULT 1,     -- how many similar actions inform this learning
  confidence numeric,                -- 0-100

  -- Source
  action_id uuid REFERENCES lc_agent_actions(id),
  ab_test_id uuid REFERENCES lc_ab_tests(id),

  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_learnings_type ON lc_test_learnings(action_type, action_category);
CREATE INDEX idx_learnings_context ON lc_test_learnings(market, quality_tier, season);
CREATE INDEX idx_learnings_outcome ON lc_test_learnings(outcome);


-- ─── View: lc_action_queue ──────────────────────────────────────────────────
-- Denormalized view of pending/active actions with property context.

CREATE OR REPLACE VIEW lc_action_queue AS
SELECT
  a.id,
  a.property_id,
  p.property_name,
  p.market,
  p.quality_tier,
  a.agent_name,
  a.action_type,
  a.action_category,
  a.execution_channel,
  a.title,
  a.description,
  a.expected_impact,
  a.confidence_score,
  a.status,
  a.priority,
  a.requires_approval,
  a.approved_by,
  a.approved_at,
  a.executed_at,
  a.is_revertible,
  a.auto_revert_if_regression,
  a.measurement_due_at,
  a.batch_id,
  a.created_at,
  a.updated_at
FROM lc_agent_actions a
JOIN lc_properties p ON p.id = a.property_id
WHERE a.status NOT IN ('cancelled', 'expired')
ORDER BY
  CASE a.priority
    WHEN 'critical' THEN 1
    WHEN 'high' THEN 2
    WHEN 'normal' THEN 3
    WHEN 'low' THEN 4
  END,
  a.created_at DESC;


-- ─── Update: lc_command_grid view ───────────────────────────────────────────
-- Add action counts by category to the command grid.

CREATE OR REPLACE VIEW lc_command_grid AS
SELECT
  p.id as property_id,
  p.property_name,
  p.market,
  p.quality_tier,
  p.quality_tier_numeric,
  p.airbnb_listing_id,
  p.vrbo_listing_id,
  p.booking_property_id,
  p.bedrooms,
  p.property_type,
  p.is_active,

  -- Latest Airbnb metrics
  s.snapshot_date,
  s.airbnb_first_page_impression_rate,
  s.airbnb_search_to_listing_ctr,
  s.airbnb_listing_to_booking_conversion,
  s.airbnb_overall_conversion_rate,
  s.airbnb_page_views,
  s.airbnb_wishlist_additions,
  s.airbnb_overall_rating,
  s.airbnb_review_count,
  s.airbnb_avg_nightly_rate,
  s.airbnb_occupancy_rate,
  s.health_status,
  s.previous_health_status,
  s.priority_score,
  s.funnel_bottleneck,

  -- Wheelhouse KPIs
  wk.adjusted_occupancy_30d as wh_occupancy_30d,
  wk.adjusted_occupancy_120d as wh_occupancy_120d,
  wk.average_asking_rate as wh_asking_rate,
  wk.nightly_revpar as wh_revpar,
  wk.base_price_selected as wh_base_price,
  wk.base_price_recommended as wh_recommended_price,
  wk.price_alignment_pct as wh_price_alignment,
  wk.anchor_credibility as wh_anchor_credibility,
  wk.auto_rate_posting_enabled as wh_auto_rates,
  wk.wheelhouse_flags as wh_flags,
  wk.last_booked_at as wh_last_booked,
  wk.booked_nights_30d as wh_booked_30d,

  -- Health score
  hs.overall_score as health_score,
  hs.overall_grade as health_grade,
  hs.previous_score as health_score_prev,
  hs.score_delta as health_score_delta,
  hs.channels_active,

  -- Revenue projection
  rp.total_projected as rev_projected,
  rp.total_booked as rev_booked,
  rp.total_actual as rev_actual,
  rp.total_pct_to_projection as rev_pct_to_proj,
  rp.pace_status as rev_pace_status,

  -- Pending actions count (total)
  (SELECT count(*) FROM lc_recommendations r WHERE r.property_id = p.id AND r.status = 'pending') as pending_actions,

  -- Active tests count
  (SELECT count(*) FROM lc_ab_tests t WHERE t.property_id = p.id AND t.status IN ('pending', 'active', 'snapshot_due')) as active_tests,

  -- Agent action counts by status
  (SELECT count(*) FROM lc_agent_actions aa WHERE aa.property_id = p.id AND aa.status = 'proposed') as proposed_actions,
  (SELECT count(*) FROM lc_agent_actions aa WHERE aa.property_id = p.id AND aa.status IN ('approved', 'auto_approved')) as approved_actions,
  (SELECT count(*) FROM lc_agent_actions aa WHERE aa.property_id = p.id AND aa.status = 'executing') as executing_actions,
  (SELECT count(*) FROM lc_agent_actions aa WHERE aa.property_id = p.id AND aa.status = 'completed' AND aa.executed_at > now() - interval '7 days') as completed_actions_7d

FROM lc_properties p
LEFT JOIN lc_latest_snapshots s ON s.property_id = p.id
LEFT JOIN LATERAL (
  SELECT * FROM lc_wheelhouse_kpis wk2
  WHERE wk2.property_id = p.id
  ORDER BY wk2.sync_date DESC
  LIMIT 1
) wk ON true
LEFT JOIN LATERAL (
  SELECT * FROM lc_health_scores hs2
  WHERE hs2.property_id = p.id
  ORDER BY hs2.score_date DESC
  LIMIT 1
) hs ON true
LEFT JOIN LATERAL (
  SELECT * FROM lc_revenue_projections rp2
  WHERE rp2.property_id = p.id
  ORDER BY rp2.projection_date DESC
  LIMIT 1
) rp ON true
WHERE p.is_active = true;


-- ─── Update: lc_command_grid_summary ────────────────────────────────────────
-- Add agent action totals.

CREATE OR REPLACE VIEW lc_command_grid_summary AS
SELECT
  count(*) as total_properties,
  avg(health_score) as avg_health_score,
  count(*) FILTER (WHERE health_score >= 80) as grade_a_count,
  count(*) FILTER (WHERE health_score >= 60 AND health_score < 80) as grade_b_count,
  count(*) FILTER (WHERE health_score >= 40 AND health_score < 60) as grade_c_count,
  count(*) FILTER (WHERE health_score < 40) as grade_d_count,
  count(*) FILTER (WHERE health_score IS NULL) as unscored_count,
  avg(wh_revpar) as avg_revpar,
  avg(wh_occupancy_30d) as avg_occupancy_30d,
  avg(wh_occupancy_120d) as avg_occupancy_120d,
  avg(rev_pct_to_proj) as avg_pct_to_projection,
  count(*) FILTER (WHERE rev_pace_status = 'ahead') as pace_ahead_count,
  count(*) FILTER (WHERE rev_pace_status = 'on_track') as pace_on_track_count,
  count(*) FILTER (WHERE rev_pace_status = 'behind') as pace_behind_count,
  count(*) FILTER (WHERE rev_pace_status = 'at_risk') as pace_at_risk_count,
  sum(pending_actions) as total_pending_actions,
  sum(active_tests) as total_active_tests,
  avg(wh_price_alignment) as avg_price_alignment,
  -- New: agent action totals
  sum(proposed_actions) as total_proposed_actions,
  sum(approved_actions) as total_approved_actions,
  sum(executing_actions) as total_executing_actions,
  sum(completed_actions_7d) as total_completed_actions_7d
FROM lc_command_grid;


-- ─── Schema cache reload ────────────────────────────────────────────────────
NOTIFY pgrst, 'reload schema';
