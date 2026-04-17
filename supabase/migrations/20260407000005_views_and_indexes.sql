-- 005_views_and_indexes.sql
-- Computed views and materialized views

CREATE VIEW lc_guest_ratings_with_urgency AS
SELECT
  gr.*,
  (gr.rating_deadline - CURRENT_DATE) AS days_until_deadline,
  (gr.rating_deadline - CURRENT_DATE <= 2) AS is_urgent
FROM lc_guest_ratings gr
WHERE gr.submission_status = 'pending';


CREATE MATERIALIZED VIEW lc_latest_snapshots AS
SELECT DISTINCT ON (ms.property_id)
  ms.*,
  p.property_name,
  p.market,
  p.quality_tier,
  p.quality_tier_numeric,
  p.airbnb_listing_id,
  p.bedrooms,
  p.property_type,
  p.is_active
FROM lc_metric_snapshots ms
JOIN lc_properties p ON p.id = ms.property_id
WHERE ms.scrape_completeness = 'complete'
  AND p.is_active = true
ORDER BY ms.property_id, ms.snapshot_date DESC;

CREATE UNIQUE INDEX idx_lc_latest_snapshots_property ON lc_latest_snapshots(property_id);
CREATE INDEX idx_lc_latest_snapshots_health ON lc_latest_snapshots(health_status);
CREATE INDEX idx_lc_latest_snapshots_market ON lc_latest_snapshots(market);


CREATE VIEW lc_portfolio_summary AS
SELECT
  COUNT(*) AS total_properties,
  AVG(airbnb_search_to_listing_ctr) AS avg_ctr,
  AVG(airbnb_listing_to_booking_conversion) AS avg_conversion,
  AVG(airbnb_first_page_impression_rate) AS avg_impression_rate,
  COUNT(*) FILTER (WHERE health_status = 'red') AS red_count,
  COUNT(*) FILTER (WHERE health_status = 'orange') AS orange_count,
  COUNT(*) FILTER (WHERE health_status = 'yellow') AS yellow_count,
  COUNT(*) FILTER (WHERE health_status = 'green') AS green_count,
  COUNT(*) FILTER (WHERE health_status = 'blue_spell') AS blue_count,
  COUNT(*) FILTER (WHERE health_status = 'unknown') AS unknown_count,
  MAX(snapshot_date) AS last_scan_date
FROM lc_latest_snapshots;
