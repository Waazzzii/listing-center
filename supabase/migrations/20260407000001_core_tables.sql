-- 001_core_tables.sql
-- Listing Center core identity and time-series tables

CREATE TABLE lc_properties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  streamline_unit_id TEXT UNIQUE NOT NULL,
  property_name TEXT NOT NULL,
  market TEXT NOT NULL,
  quality_tier TEXT NOT NULL DEFAULT 'standard',
  quality_tier_numeric INT GENERATED ALWAYS AS (
    CASE quality_tier
      WHEN 'standard' THEN 1
      WHEN 'silver' THEN 2
      WHEN 'gold' THEN 3
      WHEN 'platinum' THEN 4
      WHEN 'diamond' THEN 5
      ELSE 0
    END
  ) STORED,

  airbnb_listing_id TEXT,
  airbnb_account_id INT,
  vrbo_listing_id TEXT,
  vrbo_account TEXT,
  booking_property_id TEXT,
  booking_account TEXT,

  bedrooms INT,
  bathrooms NUMERIC(3,1),
  max_occupancy INT,
  property_type TEXT,
  adr_range TEXT,

  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_lc_properties_market ON lc_properties(market);
CREATE INDEX idx_lc_properties_tier ON lc_properties(quality_tier_numeric);
CREATE INDEX idx_lc_properties_airbnb ON lc_properties(airbnb_listing_id);


CREATE TABLE lc_metric_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID REFERENCES lc_properties(id) NOT NULL,
  snapshot_date DATE NOT NULL,
  snapshot_source TEXT NOT NULL,

  scrape_completeness TEXT NOT NULL DEFAULT 'complete',
  pages_scraped INT,
  scrape_run_id UUID,

  airbnb_overall_conversion_rate NUMERIC(6,3),
  airbnb_first_page_impression_rate NUMERIC(6,3),
  airbnb_search_to_listing_ctr NUMERIC(6,3),
  airbnb_listing_to_booking_conversion NUMERIC(6,3),

  airbnb_page_views INT,
  airbnb_first_page_impressions INT,
  airbnb_wishlist_additions INT,

  airbnb_booking_lead_time_days NUMERIC(5,1),
  airbnb_returning_guest_rate NUMERIC(6,3),

  airbnb_occupancy_rate NUMERIC(6,3),
  airbnb_nights_booked INT,
  airbnb_nights_blocked INT,
  airbnb_unbooked_nights INT,
  airbnb_check_ins INT,
  airbnb_cancellation_rate NUMERIC(6,3),
  airbnb_avg_length_of_stay_days NUMERIC(5,1),
  airbnb_avg_nightly_rate NUMERIC(8,2),

  airbnb_overall_rating NUMERIC(3,2),
  airbnb_5star_overall_pct NUMERIC(6,3),
  airbnb_5star_accuracy_pct NUMERIC(6,3),
  airbnb_5star_checkin_pct NUMERIC(6,3),
  airbnb_5star_cleanliness_pct NUMERIC(6,3),
  airbnb_5star_communication_pct NUMERIC(6,3),
  airbnb_5star_location_pct NUMERIC(6,3),
  airbnb_5star_value_pct NUMERIC(6,3),
  airbnb_review_count INT,

  airbnb_superhost_status TEXT,
  airbnb_superhost_rating NUMERIC(3,2),
  airbnb_superhost_response_rate NUMERIC(6,3),
  airbnb_superhost_cancellation_rate NUMERIC(6,3),
  airbnb_opportunities_completion_pct NUMERIC(6,3),
  airbnb_has_issues BOOLEAN DEFAULT false,
  airbnb_issue_status TEXT,

  airbnb_similar_listings_impression_rate NUMERIC(6,3),
  airbnb_similar_listings_ctr NUMERIC(6,3),
  airbnb_similar_listings_conversion NUMERIC(6,3),
  airbnb_period_over_period_delta JSONB,

  vrbo_milestone_tier TEXT,
  vrbo_offer_strength_score NUMERIC(5,2),
  vrbo_search_impressions INT,
  vrbo_page_views INT,
  vrbo_bookings INT,
  vrbo_conversion_rate NUMERIC(6,3),
  vrbo_acceptance_rate NUMERIC(6,3),
  vrbo_cancellation_rate NUMERIC(6,3),
  vrbo_review_rating NUMERIC(3,2),
  vrbo_review_count INT,

  booking_room_nights_sold INT,
  booking_revenue NUMERIC(10,2),
  booking_occupancy_rate NUMERIC(6,3),
  booking_adr NUMERIC(8,2),
  booking_revpar NUMERIC(8,2),
  booking_search_views INT,
  booking_ctr NUMERIC(6,3),
  booking_page_views INT,
  booking_bookings INT,
  booking_conversion_rate NUMERIC(6,3),
  booking_cancellation_pct NUMERIC(6,3),
  booking_page_score NUMERIC(4,2),
  booking_review_score NUMERIC(4,2),

  health_status TEXT NOT NULL DEFAULT 'unknown',
  previous_health_status TEXT,
  priority_score NUMERIC(8,2),
  funnel_bottleneck TEXT,
  total_page_views_all_channels INT,
  total_bookings_all_channels INT,
  blended_conversion_rate NUMERIC(6,3),

  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE UNIQUE INDEX idx_lc_snapshots_property_date ON lc_metric_snapshots(property_id, snapshot_date, snapshot_source);
CREATE INDEX idx_lc_snapshots_date ON lc_metric_snapshots(snapshot_date);
CREATE INDEX idx_lc_snapshots_health ON lc_metric_snapshots(health_status);


CREATE TABLE lc_benchmarks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quality_tier TEXT NOT NULL,
  market TEXT,
  season TEXT,

  impression_rate_low NUMERIC(6,3),
  impression_rate_high NUMERIC(6,3),
  ctr_low NUMERIC(6,3),
  ctr_high NUMERIC(6,3),
  conversion_low NUMERIC(6,3),
  conversion_high NUMERIC(6,3),

  impression_rate_critical NUMERIC(6,3),
  ctr_critical NUMERIC(6,3),
  conversion_critical NUMERIC(6,3),

  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

INSERT INTO lc_benchmarks (quality_tier, impression_rate_low, impression_rate_high, ctr_low, ctr_high, conversion_low, conversion_high, impression_rate_critical, ctr_critical, conversion_critical) VALUES
  ('diamond',   40.0, 55.0, 8.0,  15.0, 1.5, 3.0, 40.0, 8.0,  1.5),
  ('platinum',  45.0, 60.0, 10.0, 20.0, 2.0, 4.0, 45.0, 10.0, 2.0),
  ('gold',      50.0, 65.0, 10.0, 25.0, 2.0, 5.0, 50.0, 10.0, 2.0),
  ('silver',    55.0, 70.0, 12.0, 30.0, 2.5, 5.0, 55.0, 12.0, 2.5),
  ('standard',  55.0, 70.0, 12.0, 30.0, 2.5, 6.0, 55.0, 12.0, 2.5);


CREATE TABLE lc_airbnb_accounts (
  id SERIAL PRIMARY KEY,
  account_name TEXT NOT NULL,
  account_email TEXT,
  listing_count INT,
  markets TEXT[],
  session_data JSONB,
  last_successful_login TIMESTAMPTZ,
  last_scrape_date DATE,
  last_scrape_status TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);


CREATE TABLE lc_airbnb_opportunities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  airbnb_account_id INT NOT NULL,
  snapshot_date DATE NOT NULL,
  opportunity_name TEXT NOT NULL,
  category TEXT NOT NULL,
  completion_pct NUMERIC(5,2),
  is_completed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_lc_opportunities_account ON lc_airbnb_opportunities(airbnb_account_id, snapshot_date);
