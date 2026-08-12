-- 002_workflow_tables.sql
-- Change log, A/B tests, recommendations

CREATE TABLE lc_change_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID REFERENCES lc_properties(id) NOT NULL,
  change_date TIMESTAMPTZ DEFAULT now(),
  change_type TEXT NOT NULL,
  change_source TEXT NOT NULL,

  field_changed TEXT,
  old_value TEXT,
  new_value TEXT,

  thesis TEXT,
  diagnosed_issue TEXT,
  predicted_impact TEXT,

  approval_status TEXT DEFAULT 'pending',
  approved_by TEXT,
  approved_at TIMESTAMPTZ,
  rejection_reason TEXT,

  execution_status TEXT DEFAULT 'not_started',
  executed_at TIMESTAMPTZ,
  execution_error TEXT,

  ab_test_id UUID,

  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_lc_changes_property ON lc_change_log(property_id, change_date DESC);
CREATE INDEX idx_lc_changes_approval ON lc_change_log(approval_status);


CREATE TABLE lc_ab_tests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID REFERENCES lc_properties(id) NOT NULL,

  test_type TEXT NOT NULL,
  thesis TEXT NOT NULL,
  target_metric TEXT NOT NULL,

  before_snapshot_date DATE,
  before_metrics JSONB,

  change_description TEXT NOT NULL,
  change_log_id UUID REFERENCES lc_change_log(id),
  change_executed_date DATE,

  after_snapshot_due_date DATE,
  after_snapshot_date DATE,
  after_metrics JSONB,

  status TEXT DEFAULT 'pending',
  result TEXT,
  metric_lift NUMERIC(8,3),
  result_summary TEXT,
  decision TEXT,

  minimum_impressions INT DEFAULT 3000,
  soak_period_days INT,

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_lc_tests_property ON lc_ab_tests(property_id);
CREATE INDEX idx_lc_tests_status ON lc_ab_tests(status);


CREATE TABLE lc_recommendations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID REFERENCES lc_properties(id) NOT NULL,
  agent_name TEXT NOT NULL,

  recommendation_type TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  predicted_impact TEXT,

  diagnosed_issue TEXT,
  funnel_stage TEXT,
  severity TEXT,

  proposed_change JSONB,

  status TEXT DEFAULT 'pending',
  reviewed_by TEXT,
  reviewed_at TIMESTAMPTZ,
  rejection_reason TEXT,
  defer_until DATE,

  change_log_id UUID REFERENCES lc_change_log(id),
  ab_test_id UUID REFERENCES lc_ab_tests(id),

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_lc_recommendations_status ON lc_recommendations(status);
CREATE INDEX idx_lc_recommendations_property ON lc_recommendations(property_id);
