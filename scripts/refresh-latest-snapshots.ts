// Refresh lc_latest_snapshots materialized view after each scrape
// Run: npm run refresh-views

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);

async function main() {
  console.log('Refreshing lc_latest_snapshots materialized view...');

  // Use raw SQL via RPC function (must be created in Supabase)
  // CREATE OR REPLACE FUNCTION refresh_lc_latest_snapshots() RETURNS void AS $$
  //   REFRESH MATERIALIZED VIEW CONCURRENTLY lc_latest_snapshots;
  // $$ LANGUAGE sql;
  const { error } = await supabase.rpc('refresh_lc_latest_snapshots');

  if (error) {
    console.error('Failed to refresh materialized view:', error.message);
    console.log('Note: You may need to create the RPC function in Supabase first.');
    process.exit(1);
  }

  console.log('Done! Materialized view refreshed.');
}

main().catch(console.error);
