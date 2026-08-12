-- migration-wheelhouse-tables.sql
-- Creates Wheelhouse KPI, Health Score, and Revenue Projection tables
-- Plus the lc_command_grid view that joins everything together
-- Run against Supabase SQL editor

-- ─── Table: lc_wheelhouse_kpis ───────────────────────────────────────────────
-- Stores daily KPI snapshots from Wheelhouse API per property.

CREATE TABLE IF NOT EXISTS lc_wheelhouse_kpis (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  property_id uuid NOT NULL REFERENCES lc_properties(id),
  sync_date date NOT NULL DEFAULT CURRENT_DATE,
  channel text NOT NULL DEFAULT 'airbnb',

  -- KPI fields from /listings/{id}/kpis
  adjusted_occupancy_30d numeric,
  occupancy_30d numeric,
  available_nights_30d integer,
  average_asking_rate numeric,
  average_nightly_rate numeric,
  adjusted_nightly_revpar numeric,
  nightly_revpar numeric,
  last_booked_at timestamptz,
  booked_nights_30d integer,

  -- Extended KPI windows
  adjusted_occupancy_120d numeric,
  occupancy_120d numeric,
  available_nights_120d integer,
  booked_nights_120d integer,
  nightly_revpar_120d numeric,

  -- Base price data from /listings/{id}/base_price_recommendation
  base_price_selected numeric,
  base_price_recommended numeric,
  base_price_conservative numeric,
  base_price_aggressive numeric,
  anchor_credibility integer, -- 0-100
  anchor_price numeric,

  -- Price alignment (calculated)
  price_alignment_pct numeric, -- how far off from recommended

  -- Flags from /listings/{id}/flags
  wheelhouse_flags jsonb DEFAULT '[]',

  -- Auto-rate posting status
  auto_rate_posting_enabled boolean DEFAULT false,

  created_at timestamptz DEFAULT now(),

  UNIQUE(property_id, sync_date, channel)
);

CREATE INDEX idx_wh_kpis_property ON lc_wheelhouse_kpis(property_id);
CREATE INDEX idx_wh_kpis_sync_date ON lc_wheelhouse_kpis(sync_date);


-- ─── Table: lc_health_scores ─────────────────────────────────────────────────
-- Stores the composite listing health score per property, calculated weekly.

CREATE TABLE IF NOT EXISTS lc_health_scores (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  property_id uuid NOT NULL REFERENCES lc_properties(id),
  score_date date NOT NULL DEFAULT CURRENT_DATE,

  -- Composite score 0-100
  overall_score integer NOT NULL,
  overall_grade text NOT NULL, -- A, B, C, D, F

  -- Component scores (each 0-100)
  search_visibility_score integer,
  ctr_score integer,
  conversion_score integer,
  listing_completeness_score integer,
  guest_rating_score integer,
  base_price_alignment_score integer,
  revenue_vs_projection_score integer,
  forward_occupancy_score integer,
  pricing_strategy_score integer,

  -- Component weights used
  weights jsonb DEFAULT '{}',

  -- Trend
  previous_score integer,
  score_delta integer,

  -- Channels listed
  channels_active jsonb DEFAULT '[]', -- e.g. ["airbnb", "vrbo", "booking"]

  created_at timestamptz DEFAULT now(),

  UNIQUE(property_id, score_date)
);

CREATE INDEX idx_health_scores_property ON lc_health_scores(property_id);
CREATE INDEX idx_health_scores_date ON lc_health_scores(score_date);


-- ─── Table: lc_revenue_projections ───────────────────────────────────────────
-- Stores revenue projections and actuals for the 120-day forward view.

CREATE TABLE IF NOT EXISTS lc_revenue_projections (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  property_id uuid NOT NULL REFERENCES lc_properties(id),
  projection_date date NOT NULL DEFAULT CURRENT_DATE,

  -- Monthly buckets (current month + next 3)
  month_1_label text, -- e.g. "Apr 2026"
  month_1_projected numeric DEFAULT 0,
  month_1_actual numeric DEFAULT 0,
  month_1_booked numeric DEFAULT 0,
  month_1_pct_to_projection numeric DEFAULT 0,

  month_2_label text,
  month_2_projected numeric DEFAULT 0,
  month_2_actual numeric DEFAULT 0,
  month_2_booked numeric DEFAULT 0,
  month_2_pct_to_projection numeric DEFAULT 0,

  month_3_label text,
  month_3_projected numeric DEFAULT 0,
  month_3_actual numeric DEFAULT 0,
  month_3_booked numeric DEFAULT 0,
  month_3_pct_to_projection numeric DEFAULT 0,

  month_4_label text,
  month_4_projected numeric DEFAULT 0,
  month_4_actual numeric DEFAULT 0,
  month_4_booked numeric DEFAULT 0,
  month_4_pct_to_projection numeric DEFAULT 0,

  -- Totals for 120-day window
  total_projected numeric DEFAULT 0,
  total_booked numeric DEFAULT 0,
  total_actual numeric DEFAULT 0,
  total_pct_to_projection numeric DEFAULT 0,

  -- Pace indicator
  pace_status text DEFAULT 'on_track', -- ahead, on_track, behind, at_risk

  -- From Wheelhouse
  avg_asking_rate numeric,
  revpar numeric,

  created_at timestamptz DEFAULT now(),

  UNIQUE(property_id, projection_date)
);

CREATE INDEX idx_rev_proj_property ON lc_revenue_projections(property_id);
CREATE INDEX idx_rev_proj_date ON lc_revenue_projections(projection_date);


-- ─── View: lc_command_grid ───────────────────────────────────────────────────
-- Joins properties + latest snapshots + wheelhouse KPIs + health scores +
-- revenue projections into a single command-grid view.

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

  -- Pending actions count
  (SELECT count(*) FROM lc_recommendations r WHERE r.property_id = p.id AND r.status = 'pending') as pending_actions,

  -- Active tests count
  (SELECT count(*) FROM lc_ab_tests t WHERE t.property_id = p.id AND t.status IN ('pending', 'active', 'snapshot_due')) as active_tests

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


-- ─── View: lc_command_grid_summary ───────────────────────────────────────────
-- Portfolio-level aggregate for the command grid dashboard.

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
  avg(wh_price_alignment) as avg_price_alignment
FROM lc_command_grid;
