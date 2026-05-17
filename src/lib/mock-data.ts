/**
 * Mock data fallback for the Listing Center UI.
 *
 * Activates when:
 *   - process.env.LC_MOCK_DATA === 'true', OR
 *   - process.env.SUPABASE_SERVICE_KEY is unset (preview mode without DB)
 *
 * Lets you boot `npm run dev` against the Wazzi UI without needing
 * Supabase credentials. Replace by configuring real env vars to query
 * the live DB instead.
 */

let _logged = false;

export function isMockMode(): boolean {
  const active =
    process.env.LC_MOCK_DATA === 'true' ||
    !process.env.SUPABASE_URL ||
    !process.env.SUPABASE_SERVICE_KEY;
  if (active && !_logged) {
    // One-time log per server boot so it's obvious mock mode is active.
    console.log(
      '[mock-data] Mock mode ACTIVE — set SUPABASE_URL + SUPABASE_SERVICE_KEY to query the real DB.',
    );
    _logged = true;
  }
  return active;
}

// ============================================================
// Listing presence (Phase D-1 layer)
// ============================================================

export function mockListingPresence() {
  // Build per (unit × OTA) presence rows from the property fixtures.
  // Captures the same reconciliation columns the diagnostic layer surfaces.
  const rows: Array<{
    unit_id: string;
    property_name: string;
    market: string;
    ota: string;
    streamline_distributed: boolean;
    publicly_found: boolean | null;
    extranet_active: boolean | null;
    public_url: string | null;
    extranet_listing_id: string | null;
    last_public_check_at: string | null;
    last_extranet_check_at: string | null;
    mismatch_flags: string[];
  }> = [];

  for (const p of MOCK_PROPERTIES) {
    const channels: Array<{ ota: string; id: string | undefined; urlBase: string }> = [
      { ota: 'airbnb', id: p.airbnb, urlBase: 'https://www.airbnb.com/rooms/' },
      { ota: 'vrbo', id: p.vrbo, urlBase: 'https://www.vrbo.com/' },
      { ota: 'booking', id: p.booking, urlBase: 'https://www.booking.com/hotel/' },
    ];
    for (const c of channels) {
      if (!c.id) continue;
      // Synthesize a couple of mismatches deterministically so the audit
      // surfaces something to act on.
      const mismatch_flags: string[] = [];
      if (p.id === 'prop-003') mismatch_flags.push('stale_content');
      if (p.id === 'prop-008') mismatch_flags.push('streamline_on_public_off');
      if (p.id === 'prop-013') mismatch_flags.push('low_photo_count');
      rows.push({
        unit_id: p.id,
        property_name: p.name,
        market: p.market,
        ota: c.ota,
        streamline_distributed: true,
        publicly_found: p.id !== 'prop-008',
        extranet_active: p.id !== 'prop-013',
        public_url: `${c.urlBase}${c.id}`,
        extranet_listing_id: c.id,
        last_public_check_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2).toISOString(),
        last_extranet_check_at: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
        mismatch_flags,
      });
    }
  }
  return rows;
}

// ============================================================
// Command Grid (dashboard)
// ============================================================

export const MOCK_PROPERTIES: Array<{
  id: string;
  name: string;
  market: string;
  tier: string;
  bedrooms: number;
  type: string;
  impression: number;
  ctr: number;
  conversion: number;
  pageViews: number;
  wishlists: number;
  rating: number;
  reviewCount: number;
  occupancy30: number;
  revpar: number;
  basePrice: number;
  recommendedPrice: number;
  priceAlignment: number;
  healthScore: number;
  healthDelta: number;
  healthStatus: string;
  pacePctToProj: number;
  paceStatus: 'ahead' | 'on_track' | 'behind' | 'at_risk';
  pendingActions: number;
  activeTests: number;
  proposedActions: number;
  approvedActions: number;
  executingActions: number;
  airbnb?: string;
  vrbo?: string;
  booking?: string;
}> = [
  { id: 'prop-001', name: 'Peaceful Valley', market: 'tucson', tier: 'gold', bedrooms: 3, type: 'house', impression: 42.1, ctr: 11.5, conversion: 1.8, pageViews: 480, wishlists: 38, rating: 4.82, reviewCount: 142, occupancy30: 68.2, revpar: 188.4, basePrice: 215, recommendedPrice: 240, priceAlignment: -10.4, healthScore: 62, healthDelta: -3, healthStatus: 'yellow', pacePctToProj: 102.1, paceStatus: 'on_track', pendingActions: 2, activeTests: 1, proposedActions: 0, approvedActions: 0, executingActions: 0, airbnb: '44419327' },
  { id: 'prop-002', name: 'Arrowhead Abode', market: 'scottsdale', tier: 'platinum', bedrooms: 4, type: 'house', impression: 58.6, ctr: 18.2, conversion: 3.2, pageViews: 920, wishlists: 124, rating: 4.94, reviewCount: 218, occupancy30: 82.5, revpar: 324.6, basePrice: 395, recommendedPrice: 410, priceAlignment: -3.7, healthScore: 81, healthDelta: 4, healthStatus: 'green', pacePctToProj: 111.4, paceStatus: 'ahead', pendingActions: 0, activeTests: 2, proposedActions: 1, approvedActions: 0, executingActions: 0, airbnb: '83197857', vrbo: '2493410' },
  { id: 'prop-003', name: 'Bellas Catalina Oasis', market: 'tucson', tier: 'silver', bedrooms: 2, type: 'condo', impression: 28.4, ctr: 8.1, conversion: 0.9, pageViews: 220, wishlists: 14, rating: 4.61, reviewCount: 78, occupancy30: 41.5, revpar: 92.1, basePrice: 165, recommendedPrice: 195, priceAlignment: -15.4, healthScore: 38, healthDelta: -8, healthStatus: 'red', pacePctToProj: 85.8, paceStatus: 'at_risk', pendingActions: 5, activeTests: 0, proposedActions: 2, approvedActions: 1, executingActions: 0, airbnb: '70291817' },
  { id: 'prop-004', name: 'Cactus Cove Retreat', market: 'coachella', tier: 'gold', bedrooms: 3, type: 'house', impression: 51.3, ctr: 14.8, conversion: 2.7, pageViews: 640, wishlists: 84, rating: 4.88, reviewCount: 196, occupancy30: 74.1, revpar: 256.8, basePrice: 345, recommendedPrice: 345, priceAlignment: 0, healthScore: 77, healthDelta: 2, healthStatus: 'green', pacePctToProj: 105.1, paceStatus: 'ahead', pendingActions: 1, activeTests: 0, proposedActions: 0, approvedActions: 0, executingActions: 1, airbnb: '38898923' },
  { id: 'prop-005', name: 'Cactus Path', market: 'coachella', tier: 'silver', bedrooms: 2, type: 'condo', impression: 36.7, ctr: 10.2, conversion: 1.6, pageViews: 410, wishlists: 32, rating: 4.72, reviewCount: 92, occupancy30: 58.4, revpar: 144.2, basePrice: 195, recommendedPrice: 210, priceAlignment: -7.1, healthScore: 58, healthDelta: 1, healthStatus: 'yellow', pacePctToProj: 99.0, paceStatus: 'on_track', pendingActions: 1, activeTests: 1, proposedActions: 0, approvedActions: 0, executingActions: 0, airbnb: '45503389' },
  { id: 'prop-006', name: 'Sedona Vista Casita', market: 'sedona', tier: 'platinum', bedrooms: 3, type: 'house', impression: 64.2, ctr: 20.4, conversion: 3.5, pageViews: 1180, wishlists: 162, rating: 4.96, reviewCount: 284, occupancy30: 88.1, revpar: 412.5, basePrice: 485, recommendedPrice: 480, priceAlignment: 1.0, healthScore: 88, healthDelta: 1, healthStatus: 'green', pacePctToProj: 114.2, paceStatus: 'ahead', pendingActions: 0, activeTests: 1, proposedActions: 0, approvedActions: 0, executingActions: 0, airbnb: '52481723', vrbo: '3019842' },
  { id: 'prop-007', name: 'Flagstaff Pines Lodge', market: 'sedona', tier: 'gold', bedrooms: 4, type: 'house', impression: 48.9, ctr: 13.6, conversion: 2.4, pageViews: 740, wishlists: 96, rating: 4.79, reviewCount: 164, occupancy30: 71.2, revpar: 278.4, basePrice: 365, recommendedPrice: 380, priceAlignment: -3.9, healthScore: 73, healthDelta: -1, healthStatus: 'green', pacePctToProj: 103.7, paceStatus: 'on_track', pendingActions: 1, activeTests: 0, proposedActions: 1, approvedActions: 0, executingActions: 0, airbnb: '61298310' },
  { id: 'prop-008', name: 'Phoenix Suns Hideaway', market: 'scottsdale', tier: 'silver', bedrooms: 2, type: 'condo', impression: 32.1, ctr: 9.4, conversion: 1.2, pageViews: 280, wishlists: 22, rating: 4.55, reviewCount: 64, occupancy30: 48.2, revpar: 112.6, basePrice: 175, recommendedPrice: 215, priceAlignment: -18.6, healthScore: 44, healthDelta: -5, healthStatus: 'orange', pacePctToProj: 91.4, paceStatus: 'behind', pendingActions: 4, activeTests: 0, proposedActions: 1, approvedActions: 1, executingActions: 0, airbnb: '49271854' },
  { id: 'prop-009', name: 'Idyllwild Mountain Cabin', market: 'lake_arrowhead', tier: 'gold', bedrooms: 3, type: 'cabin', impression: 54.2, ctr: 15.8, conversion: 2.8, pageViews: 820, wishlists: 108, rating: 4.84, reviewCount: 178, occupancy30: 76.8, revpar: 232.1, basePrice: 295, recommendedPrice: 310, priceAlignment: -4.8, healthScore: 79, healthDelta: 3, healthStatus: 'green', pacePctToProj: 108.2, paceStatus: 'ahead', pendingActions: 0, activeTests: 1, proposedActions: 0, approvedActions: 0, executingActions: 0, airbnb: '57218346' },
  { id: 'prop-010', name: 'Palm Springs Modern', market: 'coachella', tier: 'diamond', bedrooms: 5, type: 'house', impression: 71.3, ctr: 24.1, conversion: 4.1, pageViews: 1640, wishlists: 248, rating: 4.97, reviewCount: 342, occupancy30: 91.2, revpar: 612.8, basePrice: 695, recommendedPrice: 695, priceAlignment: 0, healthScore: 92, healthDelta: 2, healthStatus: 'green', pacePctToProj: 118.4, paceStatus: 'ahead', pendingActions: 0, activeTests: 2, proposedActions: 0, approvedActions: 0, executingActions: 0, airbnb: '38291847', vrbo: '4129843' },
  { id: 'prop-011', name: 'Saguaro Sunset Villa', market: 'tucson', tier: 'gold', bedrooms: 3, type: 'house', impression: 46.5, ctr: 12.9, conversion: 2.1, pageViews: 560, wishlists: 68, rating: 4.78, reviewCount: 134, occupancy30: 65.4, revpar: 196.2, basePrice: 245, recommendedPrice: 265, priceAlignment: -7.5, healthScore: 68, healthDelta: 0, healthStatus: 'yellow', pacePctToProj: 97.5, paceStatus: 'on_track', pendingActions: 2, activeTests: 0, proposedActions: 0, approvedActions: 0, executingActions: 1, airbnb: '41827639' },
  { id: 'prop-012', name: 'Desert Mirage Estate', market: 'coachella', tier: 'platinum', bedrooms: 4, type: 'house', impression: 59.8, ctr: 17.4, conversion: 3.0, pageViews: 980, wishlists: 142, rating: 4.91, reviewCount: 224, occupancy30: 84.6, revpar: 384.2, basePrice: 445, recommendedPrice: 440, priceAlignment: 1.1, healthScore: 84, healthDelta: 1, healthStatus: 'green', pacePctToProj: 109.8, paceStatus: 'ahead', pendingActions: 0, activeTests: 1, proposedActions: 1, approvedActions: 0, executingActions: 0, airbnb: '67392145' },
  { id: 'prop-013', name: 'High Desert Ranch', market: 'tucson', tier: 'standard', bedrooms: 2, type: 'house', impression: 22.4, ctr: 6.8, conversion: 0.7, pageViews: 160, wishlists: 8, rating: 4.42, reviewCount: 42, occupancy30: 34.8, revpar: 68.4, basePrice: 145, recommendedPrice: 185, priceAlignment: -21.6, healthScore: 32, healthDelta: -6, healthStatus: 'red', pacePctToProj: 78.4, paceStatus: 'at_risk', pendingActions: 6, activeTests: 0, proposedActions: 2, approvedActions: 0, executingActions: 0, airbnb: '28471096' },
  { id: 'prop-014', name: 'Scottsdale Golf Retreat', market: 'scottsdale', tier: 'gold', bedrooms: 3, type: 'condo', impression: 49.7, ctr: 14.1, conversion: 2.5, pageViews: 680, wishlists: 88, rating: 4.85, reviewCount: 172, occupancy30: 73.5, revpar: 248.6, basePrice: 295, recommendedPrice: 310, priceAlignment: -4.8, healthScore: 75, healthDelta: 2, healthStatus: 'green', pacePctToProj: 104.5, paceStatus: 'on_track', pendingActions: 1, activeTests: 0, proposedActions: 0, approvedActions: 1, executingActions: 0, airbnb: '54218963', booking: '8472916' },
  { id: 'prop-015', name: 'Coachella Festival House', market: 'coachella', tier: 'platinum', bedrooms: 5, type: 'house', impression: 67.4, ctr: 22.8, conversion: 3.8, pageViews: 1420, wishlists: 198, rating: 4.93, reviewCount: 256, occupancy30: 87.4, revpar: 478.2, basePrice: 545, recommendedPrice: 540, priceAlignment: 0.9, healthScore: 87, healthDelta: 3, healthStatus: 'green', pacePctToProj: 116.8, paceStatus: 'ahead', pendingActions: 0, activeTests: 1, proposedActions: 0, approvedActions: 0, executingActions: 0, airbnb: '72931845' },
];

const TODAY = new Date().toISOString().split('T')[0];

export function mockCommandGridResponse() {
  const data = MOCK_PROPERTIES.map((p) => ({
    property_id: p.id,
    property_name: p.name,
    market: p.market,
    quality_tier: p.tier,
    quality_tier_numeric: { standard: 1, silver: 2, gold: 3, platinum: 4, diamond: 5 }[p.tier] ?? 1,
    airbnb_listing_id: p.airbnb ?? null,
    vrbo_listing_id: p.vrbo ?? null,
    booking_property_id: p.booking ?? null,
    bedrooms: p.bedrooms,
    property_type: p.type,
    is_active: true,
    snapshot_date: TODAY,
    airbnb_first_page_impression_rate: p.impression,
    airbnb_search_to_listing_ctr: p.ctr,
    airbnb_listing_to_booking_conversion: p.conversion,
    airbnb_overall_conversion_rate: p.conversion,
    airbnb_page_views: p.pageViews,
    airbnb_wishlist_additions: p.wishlists,
    airbnb_overall_rating: p.rating,
    airbnb_review_count: p.reviewCount,
    airbnb_avg_nightly_rate: p.basePrice,
    airbnb_occupancy_rate: p.occupancy30,
    health_status: p.healthStatus,
    previous_health_status: p.healthStatus,
    priority_score: 100 - p.healthScore,
    funnel_bottleneck: p.healthScore < 50 ? 'conversion' : null,
    wh_occupancy_30d: p.occupancy30,
    wh_occupancy_120d: p.occupancy30 - 4,
    wh_asking_rate: p.basePrice,
    wh_revpar: p.revpar,
    wh_base_price: p.basePrice,
    wh_recommended_price: p.recommendedPrice,
    wh_price_alignment: p.priceAlignment,
    wh_anchor_credibility: 0.85,
    wh_auto_rates: true,
    wh_flags: [],
    wh_last_booked: TODAY,
    wh_booked_30d: Math.round((p.occupancy30 / 100) * 30),
    health_score: p.healthScore,
    health_grade: p.healthScore >= 80 ? 'A' : p.healthScore >= 60 ? 'B' : p.healthScore >= 40 ? 'C' : 'D',
    health_score_prev: p.healthScore - p.healthDelta,
    health_score_delta: p.healthDelta,
    channels_active: [p.airbnb, p.vrbo, p.booking].filter(Boolean).length,
    pending_actions: p.pendingActions,
    active_tests: p.activeTests,
    proposed_actions: p.proposedActions,
    approved_actions: p.approvedActions,
    executing_actions: p.executingActions,
    completed_actions_7d: 0,
    rev_projected: p.revpar * 30,
    rev_booked: p.revpar * 30 * (p.pacePctToProj / 100),
    rev_actual: p.revpar * 30 * (p.pacePctToProj / 100),
    rev_pct_to_proj: p.pacePctToProj,
    rev_pace_status: p.paceStatus,
  }));

  const count = data.length;
  const sum = <K extends keyof typeof data[0]>(k: K) =>
    data.reduce((s, r) => s + (typeof r[k] === 'number' ? (r[k] as number) : 0), 0);
  const avg = (k: keyof typeof data[0]) => sum(k) / count;

  const summary = {
    total_properties: count,
    avg_health_score: avg('health_score'),
    grade_a_count: data.filter((r) => r.health_grade === 'A').length,
    grade_b_count: data.filter((r) => r.health_grade === 'B').length,
    grade_c_count: data.filter((r) => r.health_grade === 'C').length,
    grade_d_count: data.filter((r) => r.health_grade === 'D').length,
    unscored_count: 0,
    avg_revpar: avg('wh_revpar'),
    avg_occupancy_30d: avg('wh_occupancy_30d'),
    avg_occupancy_120d: avg('wh_occupancy_120d'),
    total_pending_actions: sum('pending_actions'),
    total_active_tests: sum('active_tests'),
    avg_price_alignment: avg('wh_price_alignment'),
    total_proposed_actions: sum('proposed_actions'),
    total_approved_actions: sum('approved_actions'),
    total_executing_actions: sum('executing_actions'),
    total_completed_actions_7d: 0,
    avg_pct_to_projection: avg('rev_pct_to_proj'),
    pace_ahead_count: data.filter((r) => r.rev_pace_status === 'ahead').length,
    pace_on_track_count: data.filter((r) => r.rev_pace_status === 'on_track').length,
    pace_behind_count: data.filter((r) => r.rev_pace_status === 'behind').length,
    pace_at_risk_count: data.filter((r) => r.rev_pace_status === 'at_risk').length,
  };

  return { data, summary };
}

// ============================================================
// Reviews
// ============================================================

export function mockPendingRatings() {
  const today = new Date();
  const daysFromNow = (n: number) => {
    const d = new Date(today);
    d.setDate(d.getDate() + n);
    return d.toISOString().split('T')[0];
  };
  const daysAgo = (n: number) => daysFromNow(-n);

  return [
    { id: 'r1', property_id: 'prop-002', guest_name: 'Sarah Johnson', checkout_date: daysAgo(11), rating_deadline: daysFromNow(3), days_until_deadline: 3, is_urgent: false, submission_status: 'pending', property_name: 'Arrowhead Abode', market: 'scottsdale' },
    { id: 'r2', property_id: 'prop-010', guest_name: 'Michael Chen', checkout_date: daysAgo(12), rating_deadline: daysFromNow(2), days_until_deadline: 2, is_urgent: true, submission_status: 'pending', property_name: 'Palm Springs Modern', market: 'coachella' },
    { id: 'r3', property_id: 'prop-004', guest_name: 'Emily Rodriguez', checkout_date: daysAgo(13), rating_deadline: daysFromNow(1), days_until_deadline: 1, is_urgent: true, submission_status: 'pending', property_name: 'Cactus Cove Retreat', market: 'coachella' },
    { id: 'r4', property_id: 'prop-006', guest_name: 'David Kim', checkout_date: daysAgo(9), rating_deadline: daysFromNow(5), days_until_deadline: 5, is_urgent: false, submission_status: 'pending', property_name: 'Sedona Vista Casita', market: 'sedona' },
    { id: 'r5', property_id: 'prop-009', guest_name: 'Jessica Martinez', checkout_date: daysAgo(10), rating_deadline: daysFromNow(4), days_until_deadline: 4, is_urgent: false, submission_status: 'pending', property_name: 'Idyllwild Mountain Cabin', market: 'lake_arrowhead' },
  ];
}

export function mockReviews() {
  const daysAgo = (n: number) => {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return d.toISOString().split('T')[0];
  };
  return [
    { id: 'rv1', property_id: 'prop-002', channel: 'airbnb', guest_name: 'Sarah Johnson', review_date: daysAgo(3), rating: 5, review_text: 'Beautiful home with stunning views. Pool was perfect for our family. Will definitely book again!', response_status: 'pending', response_text: null, sentiment: 'positive', property_name: 'Arrowhead Abode', market: 'scottsdale' },
    { id: 'rv2', property_id: 'prop-003', channel: 'airbnb', guest_name: 'Robert Lee', review_date: daysAgo(5), rating: 3, review_text: 'The location was great but the AC struggled in the afternoon heat. Kitchen could use some updates.', response_status: 'pending', response_text: null, sentiment: 'neutral', property_name: 'Bellas Catalina Oasis', market: 'tucson' },
    { id: 'rv3', property_id: 'prop-010', channel: 'airbnb', guest_name: 'Amanda Foster', review_date: daysAgo(7), rating: 5, review_text: 'Absolutely incredible. The host was so responsive and the property exceeded every expectation.', response_status: 'posted', response_text: 'Thank you Amanda — so glad you enjoyed the stay!', sentiment: 'positive', property_name: 'Palm Springs Modern', market: 'coachella' },
    { id: 'rv4', property_id: 'prop-006', channel: 'vrbo', guest_name: 'Thomas Brown', review_date: daysAgo(8), rating: 5, review_text: 'Perfect Sedona escape. The fire pit and patio were the highlights of our trip.', response_status: 'posted', response_text: 'Thanks Thomas! We hope to see you back soon.', sentiment: 'positive', property_name: 'Sedona Vista Casita', market: 'sedona' },
    { id: 'rv5', property_id: 'prop-013', channel: 'airbnb', guest_name: 'Lisa Park', review_date: daysAgo(2), rating: 2, review_text: 'The photos did not match reality. Several appliances were broken and check-in was confusing.', response_status: 'pending', response_text: null, sentiment: 'negative', property_name: 'High Desert Ranch', market: 'tucson' },
    { id: 'rv6', property_id: 'prop-004', channel: 'airbnb', guest_name: 'Kevin Wright', review_date: daysAgo(4), rating: 5, review_text: 'Great pool, great location, exactly as advertised. Hosts were super communicative.', response_status: 'posted', response_text: 'So happy you enjoyed it, Kevin. Come back anytime!', sentiment: 'positive', property_name: 'Cactus Cove Retreat', market: 'coachella' },
  ];
}

// ============================================================
// Scorecards
// ============================================================

export function mockScorecards() {
  const month = new Date().toISOString().slice(0, 7);
  const daysAgo = (n: number) => {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return d.toISOString();
  };
  return [
    { id: 'sc1', property_id: 'prop-001', report_month: month, generated_at: daysAgo(2), generation_status: 'generated', delivery_method: null, delivered_at: null, lc_properties: { property_name: 'Peaceful Valley', market: 'tucson' } },
    { id: 'sc2', property_id: 'prop-002', report_month: month, generated_at: daysAgo(2), generation_status: 'sent', delivery_method: 'email', delivered_at: daysAgo(1), lc_properties: { property_name: 'Arrowhead Abode', market: 'scottsdale' } },
    { id: 'sc3', property_id: 'prop-003', report_month: month, generated_at: null, generation_status: 'pending', delivery_method: null, delivered_at: null, lc_properties: { property_name: 'Bellas Catalina Oasis', market: 'tucson' } },
    { id: 'sc4', property_id: 'prop-004', report_month: month, generated_at: daysAgo(3), generation_status: 'generated', delivery_method: null, delivered_at: null, lc_properties: { property_name: 'Cactus Cove Retreat', market: 'coachella' } },
    { id: 'sc5', property_id: 'prop-006', report_month: month, generated_at: daysAgo(4), generation_status: 'sent', delivery_method: 'email', delivered_at: daysAgo(3), lc_properties: { property_name: 'Sedona Vista Casita', market: 'sedona' } },
    { id: 'sc6', property_id: 'prop-010', report_month: month, generated_at: daysAgo(2), generation_status: 'sent', delivery_method: 'email', delivered_at: daysAgo(1), lc_properties: { property_name: 'Palm Springs Modern', market: 'coachella' } },
    { id: 'sc7', property_id: 'prop-013', report_month: month, generated_at: null, generation_status: 'pending', delivery_method: null, delivered_at: null, lc_properties: { property_name: 'High Desert Ranch', market: 'tucson' } },
    { id: 'sc8', property_id: 'prop-015', report_month: month, generated_at: daysAgo(2), generation_status: 'generated', delivery_method: null, delivered_at: null, lc_properties: { property_name: 'Coachella Festival House', market: 'coachella' } },
  ];
}

// ============================================================
// A/B Tests
// ============================================================

export function mockABTests() {
  const daysAgo = (n: number) => {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return d.toISOString();
  };
  return [
    {
      id: 't1', property_id: 'prop-002', test_type: 'hero_photo', thesis: 'Pool-forward hero shot will lift CVR by ~15% during shoulder season.',
      target_metric: 'conversion', status: 'active' as const,
      before_snapshot_date: daysAgo(14), before_metrics: { conversion: 2.4, ctr: 16.8 },
      change_description: 'Swapped exterior shot for pool-at-dusk lifestyle image',
      change_executed_date: daysAgo(13), after_snapshot_due_date: daysAgo(-7), after_snapshot_date: null, after_metrics: null,
      result: null, metric_lift: null, result_summary: null, decision: null,
      soak_period_days: 21, created_at: daysAgo(14), updated_at: daysAgo(13),
      lc_properties: { property_name: 'Arrowhead Abode', market: 'scottsdale' },
    },
    {
      id: 't2', property_id: 'prop-010', test_type: 'pricing', thesis: 'Tighten minimum stay from 3 → 2 nights mid-week to capture last-minute demand.',
      target_metric: 'occupancy', status: 'active' as const,
      before_snapshot_date: daysAgo(7), before_metrics: { occupancy: 88.4 },
      change_description: 'Mon-Wed min-stay reduced from 3 to 2 nights',
      change_executed_date: daysAgo(6), after_snapshot_due_date: daysAgo(-14), after_snapshot_date: null, after_metrics: null,
      result: null, metric_lift: null, result_summary: null, decision: null,
      soak_period_days: 21, created_at: daysAgo(7), updated_at: daysAgo(6),
      lc_properties: { property_name: 'Palm Springs Modern', market: 'coachella' },
    },
    {
      id: 't3', property_id: 'prop-004', test_type: 'title', thesis: 'Adding "Dog-Friendly" to title will lift impression share.',
      target_metric: 'impressions', status: 'completed' as const,
      before_snapshot_date: daysAgo(45), before_metrics: { impressions: 38.2 },
      change_description: 'Title updated: "Cactus Cove Retreat — Dog-Friendly Desert Escape"',
      change_executed_date: daysAgo(42), after_snapshot_due_date: daysAgo(21), after_snapshot_date: daysAgo(20),
      after_metrics: { impressions: 51.3 },
      result: 'positive' as const, metric_lift: 34.3,
      result_summary: 'Impression rate +34% vs control. Recommend roll-out to similar pet-friendly units.',
      decision: 'adopt', soak_period_days: 21, created_at: daysAgo(45), updated_at: daysAgo(20),
      lc_properties: { property_name: 'Cactus Cove Retreat', market: 'coachella' },
    },
    {
      id: 't4', property_id: 'prop-008', test_type: 'pricing', thesis: 'Lowering base rate 12% will rescue at-risk pace.',
      target_metric: 'revpar', status: 'completed' as const,
      before_snapshot_date: daysAgo(60), before_metrics: { revpar: 124.2, occupancy: 42.1 },
      change_description: 'Base price $199 → $175',
      change_executed_date: daysAgo(58), after_snapshot_due_date: daysAgo(37), after_snapshot_date: daysAgo(36),
      after_metrics: { revpar: 118.4, occupancy: 56.8 },
      result: 'negative' as const, metric_lift: -4.7,
      result_summary: 'RevPAR dropped 4.7% despite occupancy gain — price elasticity weaker than modeled. Reverting.',
      decision: 'revert', soak_period_days: 21, created_at: daysAgo(60), updated_at: daysAgo(36),
      lc_properties: { property_name: 'Phoenix Suns Hideaway', market: 'scottsdale' },
    },
    {
      id: 't5', property_id: 'prop-006', test_type: 'amenity', thesis: 'Adding hot tub photo as cover will lift wishlist saves.',
      target_metric: 'wishlists', status: 'snapshot_due' as const,
      before_snapshot_date: daysAgo(28), before_metrics: { wishlists: 84 },
      change_description: 'Hot tub night-shot moved to position 1 in photo carousel',
      change_executed_date: daysAgo(28), after_snapshot_due_date: daysAgo(7), after_snapshot_date: null, after_metrics: null,
      result: null, metric_lift: null, result_summary: null, decision: null,
      soak_period_days: 21, created_at: daysAgo(28), updated_at: daysAgo(28),
      lc_properties: { property_name: 'Sedona Vista Casita', market: 'sedona' },
    },
  ];
}
