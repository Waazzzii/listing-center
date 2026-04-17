-- supabase/migrations/010_upsert_rpc.sql
-- RPC function for conditional upsert: only update if new data has >= pages_scraped

CREATE OR REPLACE FUNCTION upsert_metric_snapshot(
  p_property_id UUID,
  p_snapshot_date DATE,
  p_snapshot_source TEXT,
  p_scrape_run_id UUID,
  p_pages_scraped INT,
  p_scrape_completeness TEXT,
  p_metrics JSONB
) RETURNS VOID AS $$
DECLARE
  v_existing_pages INT;
BEGIN
  -- Check if a row already exists
  SELECT pages_scraped INTO v_existing_pages
  FROM lc_metric_snapshots
  WHERE property_id = p_property_id
    AND snapshot_date = p_snapshot_date
    AND snapshot_source = p_snapshot_source;

  IF v_existing_pages IS NOT NULL THEN
    -- Only update if new data has equal or more pages
    IF p_pages_scraped >= v_existing_pages THEN
      UPDATE lc_metric_snapshots SET
        scrape_run_id = p_scrape_run_id,
        pages_scraped = p_pages_scraped,
        scrape_completeness = p_scrape_completeness,
        -- Capture previous health status before overwriting
        previous_health_status = health_status,
        -- Unpack all metric fields from JSONB
        airbnb_overall_conversion_rate = (p_metrics->>'airbnb_overall_conversion_rate')::NUMERIC,
        airbnb_first_page_impression_rate = (p_metrics->>'airbnb_first_page_impression_rate')::NUMERIC,
        airbnb_search_to_listing_ctr = (p_metrics->>'airbnb_search_to_listing_ctr')::NUMERIC,
        airbnb_listing_to_booking_conversion = (p_metrics->>'airbnb_listing_to_booking_conversion')::NUMERIC,
        airbnb_page_views = (p_metrics->>'airbnb_page_views')::INT,
        airbnb_first_page_impressions = (p_metrics->>'airbnb_first_page_impressions')::INT,
        airbnb_wishlist_additions = (p_metrics->>'airbnb_wishlist_additions')::INT,
        airbnb_occupancy_rate = (p_metrics->>'airbnb_occupancy_rate')::NUMERIC,
        airbnb_nights_booked = (p_metrics->>'airbnb_nights_booked')::INT,
        airbnb_nights_blocked = (p_metrics->>'airbnb_nights_blocked')::INT,
        airbnb_unbooked_nights = (p_metrics->>'airbnb_unbooked_nights')::INT,
        airbnb_check_ins = (p_metrics->>'airbnb_check_ins')::INT,
        airbnb_cancellation_rate = (p_metrics->>'airbnb_cancellation_rate')::NUMERIC,
        airbnb_avg_length_of_stay_days = (p_metrics->>'airbnb_avg_length_of_stay_days')::NUMERIC,
        airbnb_avg_nightly_rate = (p_metrics->>'airbnb_avg_nightly_rate')::NUMERIC,
        airbnb_overall_rating = (p_metrics->>'airbnb_overall_rating')::NUMERIC,
        airbnb_5star_overall_pct = (p_metrics->>'airbnb_5star_overall_pct')::NUMERIC,
        airbnb_review_count = (p_metrics->>'airbnb_review_count')::INT,
        airbnb_has_issues = (p_metrics->>'airbnb_has_issues')::BOOLEAN,
        airbnb_opportunities_completion_pct = (p_metrics->>'airbnb_opportunities_completion_pct')::NUMERIC
      WHERE property_id = p_property_id
        AND snapshot_date = p_snapshot_date
        AND snapshot_source = p_snapshot_source;
    END IF;
    -- If new data has fewer pages, skip the update (keep the better data)
  ELSE
    -- Insert new row
    INSERT INTO lc_metric_snapshots (
      property_id, snapshot_date, snapshot_source, scrape_run_id,
      pages_scraped, scrape_completeness,
      airbnb_overall_conversion_rate, airbnb_first_page_impression_rate,
      airbnb_search_to_listing_ctr, airbnb_listing_to_booking_conversion,
      airbnb_page_views, airbnb_first_page_impressions, airbnb_wishlist_additions,
      airbnb_occupancy_rate, airbnb_nights_booked, airbnb_nights_blocked,
      airbnb_unbooked_nights, airbnb_check_ins,
      airbnb_cancellation_rate, airbnb_avg_length_of_stay_days, airbnb_avg_nightly_rate,
      airbnb_overall_rating, airbnb_5star_overall_pct, airbnb_review_count,
      airbnb_has_issues, airbnb_opportunities_completion_pct
    ) VALUES (
      p_property_id, p_snapshot_date, p_snapshot_source, p_scrape_run_id,
      p_pages_scraped, p_scrape_completeness,
      (p_metrics->>'airbnb_overall_conversion_rate')::NUMERIC,
      (p_metrics->>'airbnb_first_page_impression_rate')::NUMERIC,
      (p_metrics->>'airbnb_search_to_listing_ctr')::NUMERIC,
      (p_metrics->>'airbnb_listing_to_booking_conversion')::NUMERIC,
      (p_metrics->>'airbnb_page_views')::INT,
      (p_metrics->>'airbnb_first_page_impressions')::INT,
      (p_metrics->>'airbnb_wishlist_additions')::INT,
      (p_metrics->>'airbnb_occupancy_rate')::NUMERIC,
      (p_metrics->>'airbnb_nights_booked')::INT,
      (p_metrics->>'airbnb_nights_blocked')::INT,
      (p_metrics->>'airbnb_unbooked_nights')::INT,
      (p_metrics->>'airbnb_check_ins')::INT,
      (p_metrics->>'airbnb_cancellation_rate')::NUMERIC,
      (p_metrics->>'airbnb_avg_length_of_stay_days')::NUMERIC,
      (p_metrics->>'airbnb_avg_nightly_rate')::NUMERIC,
      (p_metrics->>'airbnb_overall_rating')::NUMERIC,
      (p_metrics->>'airbnb_5star_overall_pct')::NUMERIC,
      (p_metrics->>'airbnb_review_count')::INT,
      (p_metrics->>'airbnb_has_issues')::BOOLEAN,
      (p_metrics->>'airbnb_opportunities_completion_pct')::NUMERIC
    );
  END IF;
END;
$$ LANGUAGE plpgsql;

-- RPC function to refresh the materialized view
CREATE OR REPLACE FUNCTION refresh_latest_snapshots() RETURNS VOID AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY lc_latest_snapshots;
END;
$$ LANGUAGE plpgsql;
