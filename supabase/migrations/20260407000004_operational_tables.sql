-- 004_operational_tables.sql
-- Agent executions, scrape runs, competitors

CREATE TABLE lc_agent_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_name TEXT NOT NULL,
  execution_type TEXT NOT NULL,

  started_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ,
  status TEXT DEFAULT 'running',

  properties_processed INT,
  properties_skipped INT,
  errors JSONB,

  results_summary JSONB,

  expires_at TIMESTAMPTZ DEFAULT (now() + INTERVAL '30 days'),

  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_lc_agent_executions_agent ON lc_agent_executions(agent_name, started_at DESC);


CREATE TABLE lc_scrape_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_date DATE NOT NULL,
  run_type TEXT NOT NULL,

  accounts_processed INT DEFAULT 0,
  accounts_failed INT DEFAULT 0,
  properties_scraped INT DEFAULT 0,
  properties_expected INT,
  completeness_pct NUMERIC(5,2),

  started_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ,
  duration_seconds INT,

  errors JSONB,
  pages_with_errors INT DEFAULT 0,

  is_healthy BOOLEAN GENERATED ALWAYS AS (
    CASE WHEN completeness_pct IS NOT NULL AND completeness_pct >= 80.0 THEN true ELSE false END
  ) STORED,

  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_lc_scrape_runs_date ON lc_scrape_runs(run_date DESC);


CREATE TABLE lc_competitor_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  market TEXT NOT NULL,
  competitor_listing_id TEXT NOT NULL,
  snapshot_date DATE NOT NULL,
  cancellation_policy TEXT,
  nightly_rate_range TEXT,
  review_score NUMERIC(3,2),
  review_count INT,
  guest_favorites BOOLEAN,
  min_stay INT,
  on_first_page BOOLEAN,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_lc_competitors_market ON lc_competitor_snapshots(market, snapshot_date);
