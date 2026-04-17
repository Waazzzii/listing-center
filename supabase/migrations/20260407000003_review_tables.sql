-- 003_review_tables.sql
-- Reviews, guest ratings, owner scorecards

CREATE TABLE lc_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID REFERENCES lc_properties(id) NOT NULL,

  channel TEXT NOT NULL,
  guest_name TEXT,
  review_date DATE,
  rating NUMERIC(3,2),
  review_text TEXT,

  response_status TEXT DEFAULT 'pending',
  response_text TEXT,
  response_drafted_at TIMESTAMPTZ,
  response_posted_at TIMESTAMPTZ,
  response_approved_by TEXT,

  sentiment TEXT,
  themes JSONB,

  source TEXT,
  external_review_id TEXT,

  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_lc_reviews_property ON lc_reviews(property_id, review_date DESC);
CREATE INDEX idx_lc_reviews_response ON lc_reviews(response_status);


CREATE TABLE lc_guest_ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID REFERENCES lc_properties(id) NOT NULL,
  airbnb_account_id INT NOT NULL,

  guest_name TEXT NOT NULL,
  checkout_date DATE NOT NULL,
  rating_deadline DATE NOT NULL,

  submission_status TEXT DEFAULT 'pending',
  submitted_at TIMESTAMPTZ,
  rating_given INT DEFAULT 5,
  review_text_given TEXT DEFAULT 'Would recommend to anyone',

  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_lc_ratings_pending ON lc_guest_ratings(submission_status, rating_deadline);


CREATE TABLE lc_owner_scorecards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID REFERENCES lc_properties(id) NOT NULL,
  report_month DATE NOT NULL,

  generated_at TIMESTAMPTZ,
  generation_status TEXT DEFAULT 'pending',

  scorecard_data JSONB NOT NULL DEFAULT '{}',

  delivery_method TEXT,
  delivered_at TIMESTAMPTZ,
  owner_email TEXT,

  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE UNIQUE INDEX idx_lc_scorecards_property_month ON lc_owner_scorecards(property_id, report_month);
