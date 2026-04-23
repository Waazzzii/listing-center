-- 20260415000001_listing_diagnostic_tables.sql
-- Phase D-1: Listing Visibility & Performance Diagnostic Layer

-- ============================================================
-- lc_listing_presence
-- One row per unit × OTA. Answers: "is this live where it should be?"
-- ============================================================
CREATE TABLE lc_listing_presence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id UUID NOT NULL REFERENCES lc_properties(id) ON DELETE CASCADE,
  ota TEXT NOT NULL CHECK (ota IN ('airbnb', 'vrbo', 'booking')),
  streamline_distributed BOOLEAN NOT NULL DEFAULT false,
  publicly_found BOOLEAN,
  extranet_active BOOLEAN,
  public_url TEXT,
  extranet_listing_id TEXT,
  last_public_check_at TIMESTAMPTZ,
  last_extranet_check_at TIMESTAMPTZ,
  mismatch_flags TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (unit_id, ota)
);

CREATE INDEX idx_lc_listing_presence_unit ON lc_listing_presence(unit_id);
CREATE INDEX idx_lc_listing_presence_ota ON lc_listing_presence(ota);
CREATE INDEX idx_lc_listing_presence_mismatch
  ON lc_listing_presence USING GIN(mismatch_flags)
  WHERE array_length(mismatch_flags, 1) > 0;

-- ============================================================
-- lc_listing_content_snapshot
-- Time-series: what guests see on each OTA.
-- ============================================================
CREATE TABLE lc_listing_content_snapshot (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id UUID NOT NULL REFERENCES lc_properties(id) ON DELETE CASCADE,
  ota TEXT NOT NULL CHECK (ota IN ('airbnb', 'vrbo', 'booking')),
  source TEXT NOT NULL CHECK (source IN ('public', 'extranet')),
  scraped_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  title TEXT,
  description TEXT,
  photo_count INT,
  primary_photo_url TEXT,
  price_shown NUMERIC(10, 2),
  rating NUMERIC(3, 2),
  review_count INT,
  badges TEXT[] NOT NULL DEFAULT '{}',
  cancellation_policy_display TEXT,
  instant_book_enabled BOOLEAN,
  amenity_count INT,
  amenity_highlights JSONB,
  raw_html_ref TEXT
);

CREATE INDEX idx_lc_content_snapshot_unit_ota_time
  ON lc_listing_content_snapshot(unit_id, ota, scraped_at DESC);
CREATE INDEX idx_lc_content_snapshot_source
  ON lc_listing_content_snapshot(source, scraped_at DESC);

-- ============================================================
-- lc_listing_performance
-- One row per unit × OTA × day — traffic + conversion from extranet.
-- ============================================================
CREATE TABLE lc_listing_performance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id UUID NOT NULL REFERENCES lc_properties(id) ON DELETE CASCADE,
  ota TEXT NOT NULL CHECK (ota IN ('airbnb', 'vrbo', 'booking')),
  date DATE NOT NULL,
  impressions INT,
  clicks INT,
  ctr NUMERIC(6, 4),
  conversions INT,
  cvr NUMERIC(6, 4),
  revenue NUMERIC(10, 2),
  search_rank_median INT,
  saves INT,
  quote_requests INT,
  scraped_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (unit_id, ota, date)
);

CREATE INDEX idx_lc_performance_unit_date
  ON lc_listing_performance(unit_id, date DESC);
CREATE INDEX idx_lc_performance_ota_date
  ON lc_listing_performance(ota, date DESC);

-- ============================================================
-- lc_listing_health_score
-- One row per unit × period — composite + component scores.
-- ============================================================
CREATE TABLE lc_listing_health_score (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id UUID NOT NULL REFERENCES lc_properties(id) ON DELETE CASCADE,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  composite_score INT NOT NULL CHECK (composite_score BETWEEN 0 AND 100),
  presence_score INT NOT NULL CHECK (presence_score BETWEEN 0 AND 100),
  content_score INT NOT NULL CHECK (content_score BETWEEN 0 AND 100),
  traffic_score INT NOT NULL CHECK (traffic_score BETWEEN 0 AND 100),
  conversion_score INT NOT NULL CHECK (conversion_score BETWEEN 0 AND 100),
  bucket TEXT NOT NULL CHECK (bucket IN ('red', 'yellow', 'green')),
  trend_vs_prior INT,
  calculated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (unit_id, period_end)
);

CREATE INDEX idx_lc_health_unit_period
  ON lc_listing_health_score(unit_id, period_end DESC);
CREATE INDEX idx_lc_health_bucket
  ON lc_listing_health_score(bucket, period_end DESC);

-- ============================================================
-- updated_at trigger for presence
-- ============================================================
CREATE OR REPLACE FUNCTION lc_listing_presence_touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_lc_listing_presence_touch
  BEFORE UPDATE ON lc_listing_presence
  FOR EACH ROW
  EXECUTE FUNCTION lc_listing_presence_touch_updated_at();

-- ============================================================
-- RLS — forward-looking posture: service-role-only on all Phase D
-- diagnostic tables. Pre-existing lc_* tables (properties, snapshots,
-- benchmarks, accounts, opportunities) currently have RLS DISABLED;
-- aligning them is tracked as a separate follow-up.
-- ============================================================
ALTER TABLE lc_listing_presence ENABLE ROW LEVEL SECURITY;
ALTER TABLE lc_listing_content_snapshot ENABLE ROW LEVEL SECURITY;
ALTER TABLE lc_listing_performance ENABLE ROW LEVEL SECURITY;
ALTER TABLE lc_listing_health_score ENABLE ROW LEVEL SECURITY;
