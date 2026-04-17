// One-time: Populate lc_properties from Streamline API
// Run: npm run seed

import { createClient } from '@supabase/supabase-js';

const STREAMLINE_API_URL = process.env.STREAMLINE_API_URL!;
const TOKEN_KEY = process.env.STREAMLINE_TOKEN_KEY!;
const TOKEN_SECRET = process.env.STREAMLINE_TOKEN_SECRET!;
const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY!;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const MARKET_MAP: Record<string, string> = {
  'Phoenix': 'scottsdale',
  'PalmSprings': 'coachella',
  'Coachella': 'coachella',
  'HighDesert': 'coachella',
  'Tucson': 'tucson',
  'Sedona': 'sedona',
  'Flagstaff': 'sedona',
  'PineTop': 'sedona',
  'IdyllwildTemecula': 'central_coast',
};

const TIER_MAP: Record<string, string> = {
  'Standard': 'standard',
  'Silver': 'silver',
  'Gold': 'gold',
  'Platinum': 'platinum',
  'Diamond': 'diamond',
};

async function callStreamline(methodName: string, params: Record<string, unknown> = {}) {
  const response = await fetch(STREAMLINE_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      methodName,
      params: { token_key: TOKEN_KEY, token_secret: TOKEN_SECRET, ...params },
    }),
  });
  const result = await response.json();
  if (result.error_code) throw new Error(`${result.error_code}: ${result.error_message}`);
  return result.data;
}

async function main() {
  console.log('Fetching properties from Streamline...');
  const properties = await callStreamline('GetPropertyList', {
    additional_variables: true,
    return_owner_id: true,
  });

  const rows: Array<Record<string, unknown>> = [];
  const missingAirbnb: string[] = [];
  const missingTier: string[] = [];

  for (const prop of Object.values(properties) as any[]) {
    const unitId = String(prop.id || prop.unit_id);
    const name = prop.name || prop.unit_name || `Unit ${unitId}`;
    const areaName = prop.location_area_name || '';
    const market = MARKET_MAP[areaName];

    if (!market) {
      console.warn(`Unknown market "${areaName}" for unit ${unitId}`);
      continue;
    }

    const pricingGroup = prop.additional_variables?.PricingGroup
      || prop.additional_variables?.pricing_group
      || prop.variable_pricing_group
      || '';
    const tier = TIER_MAP[pricingGroup] || '';

    if (!tier) missingTier.push(`${unitId} (${name})`);

    const airbnbId = prop.airbnb_listing_id
      || prop.additional_variables?.airbnb_listing_id
      || null;

    if (!airbnbId) missingAirbnb.push(`${unitId} (${name})`);

    rows.push({
      streamline_unit_id: unitId,
      property_name: name,
      market,
      quality_tier: tier || 'standard',
      airbnb_listing_id: airbnbId,
      bedrooms: prop.bedrooms_number || null,
      bathrooms: prop.bathrooms_number || null,
      max_occupancy: prop.max_occupants || null,
      property_type: prop.home_type_name || null,
    });
  }

  console.log(`Inserting ${rows.length} properties...`);
  const { error } = await supabase
    .from('lc_properties')
    .upsert(rows, { onConflict: 'streamline_unit_id' });

  if (error) {
    console.error('Insert error:', error);
    process.exit(1);
  }

  console.log(`\nDone! ${rows.length} properties seeded.`);
  if (missingAirbnb.length) {
    console.warn(`\n${missingAirbnb.length} properties missing Airbnb ID:`);
    missingAirbnb.slice(0, 10).forEach(p => console.warn(`  ${p}`));
    if (missingAirbnb.length > 10) console.warn(`  ... and ${missingAirbnb.length - 10} more`);
  }
  if (missingTier.length) {
    console.warn(`\n${missingTier.length} properties missing Pricing Group (defaulted to standard):`);
    missingTier.slice(0, 10).forEach(p => console.warn(`  ${p}`));
    if (missingTier.length > 10) console.warn(`  ... and ${missingTier.length - 10} more`);
  }
}

main().catch(console.error);
