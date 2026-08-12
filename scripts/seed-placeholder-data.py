#!/usr/bin/env python3
"""Seed realistic placeholder data into all Listing Center tables for UI/UX evaluation."""
import json
import random
import sys
import urllib.request
import urllib.error
from datetime import date, timedelta, datetime

SUPABASE_URL = "https://kwcwnaibioibwwmlywtt.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt3Y3duYWliaW9pYnd3bWx5d3R0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTU2OTY3NywiZXhwIjoyMDkxMTQ1Njc3fQ.xSk8L4xo_2ETXDL-YRJ1NFmhqond7cpgERVbySy6pJs"

random.seed(42)  # Reproducible results

# ─── Helpers ────────────────────────────────────────────────────────────────
def supabase_request(path, data, method='POST', prefer='return=minimal'):
    body = json.dumps(data).encode('utf-8')
    headers = {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_KEY,
        'Authorization': f'Bearer {SUPABASE_KEY}',
        'Prefer': prefer,
    }
    req = urllib.request.Request(f"{SUPABASE_URL}/rest/v1/{path}", data=body, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req) as resp:
            raw = resp.read().decode()
            if raw:
                return json.loads(raw)
            return []
    except urllib.error.HTTPError as e:
        err = e.read().decode()
        print(f"  ERROR {path}: {e.code} — {err[:300]}")
        return []

def supabase_get(path):
    headers = {
        'apikey': SUPABASE_KEY,
        'Authorization': f'Bearer {SUPABASE_KEY}',
    }
    req = urllib.request.Request(f"{SUPABASE_URL}/rest/v1/{path}", headers=headers)
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read().decode())

def supabase_rpc(fn_name, params=None):
    body = json.dumps(params or {}).encode('utf-8')
    headers = {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_KEY,
        'Authorization': f'Bearer {SUPABASE_KEY}',
    }
    req = urllib.request.Request(f"{SUPABASE_URL}/rest/v1/rpc/{fn_name}", data=body, headers=headers, method='POST')
    try:
        with urllib.request.urlopen(req) as resp:
            return resp.read().decode()
    except urllib.error.HTTPError as e:
        print(f"  RPC ERROR {fn_name}: {e.code} — {e.read().decode()[:300]}")

def iso(d):
    return d.isoformat()

TODAY = date(2026, 4, 6)

# ─── Step 1: Fetch existing properties ──────────────────────────────────────
print("Fetching properties from database...")
all_props = supabase_get("lc_properties?select=id,property_name,market,quality_tier&is_active=eq.true&limit=1051")
print(f"  Found {len(all_props)} active properties")

if not all_props:
    print("ERROR: No properties found. Run seed-from-mcp.py first.")
    sys.exit(1)

# Group by market
by_market = {}
for p in all_props:
    by_market.setdefault(p['market'], []).append(p)

print(f"  Markets: {', '.join(f'{m}({len(ps)})' for m, ps in sorted(by_market.items()))}")

# ─── Step 2: Assign Airbnb listing IDs + enrichment to a subset ─────────
print("\nEnriching properties with Airbnb IDs and details...")
PROPERTY_TYPES = ['entire_home', 'condo', 'villa', 'cabin', 'townhouse', 'casita']
enrichment_rows = []
for p in all_props:
    # Give ~90% of properties an Airbnb listing ID
    if random.random() < 0.90:
        listing_id = str(random.randint(10000000, 99999999))
        account_id = random.choice([1, 2, 3, 4, 5])
        bedrooms = random.choice([1, 2, 2, 3, 3, 3, 4, 4, 5, 6])
        bathrooms = bedrooms + random.choice([-1, 0, 0, 0.5, 1])
        max_occ = bedrooms * 2 + random.choice([0, 1, 2])
        prop_type = random.choice(PROPERTY_TYPES)
        tier = random.choices(
            ['standard', 'silver', 'gold', 'platinum', 'diamond'],
            weights=[40, 25, 20, 10, 5]
        )[0]
        enrichment_rows.append({
            'id': p['id'],
            'airbnb_listing_id': listing_id,
            'airbnb_account_id': account_id,
            'bedrooms': bedrooms,
            'bathrooms': bathrooms,
            'max_occupancy': max_occ,
            'property_type': prop_type,
            'quality_tier': tier,
        })
        p['airbnb_listing_id'] = listing_id
        p['quality_tier'] = tier
        p['bedrooms'] = bedrooms
    else:
        p['airbnb_listing_id'] = None

# Update properties in batches via PATCH
BATCH = 50
for i in range(0, len(enrichment_rows), BATCH):
    batch = enrichment_rows[i:i+BATCH]
    for row in batch:
        pid = row.pop('id')
        body = json.dumps(row).encode('utf-8')
        headers = {
            'Content-Type': 'application/json',
            'apikey': SUPABASE_KEY,
            'Authorization': f'Bearer {SUPABASE_KEY}',
            'Prefer': 'return=minimal',
        }
        req = urllib.request.Request(
            f"{SUPABASE_URL}/rest/v1/lc_properties?id=eq.{pid}",
            data=body, headers=headers, method='PATCH'
        )
        try:
            urllib.request.urlopen(req)
        except urllib.error.HTTPError as e:
            pass  # Non-critical
        row['id'] = pid  # Restore for later use
    if (i // BATCH) % 5 == 0:
        print(f"  Enriched {min(i+BATCH, len(enrichment_rows))}/{len(enrichment_rows)}...")

print(f"  Enriched {len(enrichment_rows)} properties with Airbnb data")

# ─── Step 3: Seed Airbnb accounts ──────────────────────────────────────────
print("\nSeeding Airbnb accounts...")
accounts = [
    {'id': 1, 'account_name': 'ACME AZ Primary', 'account_email': 'az1@acmehouse.com', 'listing_count': 320, 'markets': '{scottsdale,tucson,sedona}', 'is_active': True, 'last_scrape_date': iso(TODAY - timedelta(days=1)), 'last_scrape_status': 'success'},
    {'id': 2, 'account_name': 'ACME AZ Secondary', 'account_email': 'az2@acmehouse.com', 'listing_count': 180, 'markets': '{scottsdale,tucson}', 'is_active': True, 'last_scrape_date': iso(TODAY - timedelta(days=1)), 'last_scrape_status': 'success'},
    {'id': 3, 'account_name': 'ACME Coachella', 'account_email': 'cv@acmehouse.com', 'listing_count': 250, 'markets': '{coachella}', 'is_active': True, 'last_scrape_date': iso(TODAY - timedelta(days=1)), 'last_scrape_status': 'success'},
    {'id': 4, 'account_name': 'ACME Central Coast', 'account_email': 'cc@acmehouse.com', 'listing_count': 120, 'markets': '{central_coast}', 'is_active': True, 'last_scrape_date': iso(TODAY - timedelta(days=2)), 'last_scrape_status': 'success'},
    {'id': 5, 'account_name': 'ACME Sedona', 'account_email': 'sedona@acmehouse.com', 'listing_count': 80, 'markets': '{sedona}', 'is_active': True, 'last_scrape_date': iso(TODAY - timedelta(days=1)), 'last_scrape_status': 'success'},
]
supabase_request('lc_airbnb_accounts', accounts, prefer='resolution=merge-duplicates')
print(f"  Inserted {len(accounts)} accounts")

# ─── Step 4: Seed metric snapshots (12 weeks of history) ───────────────────
print("\nSeeding metric snapshots (12 weeks of history)...")

# Health status profiles — determines metric ranges
HEALTH_PROFILES = {
    'green': {
        'impression_rate': (60.0, 80.0), 'ctr': (15.0, 30.0), 'conversion': (3.0, 6.0),
        'occupancy': (70.0, 95.0), 'rating': (4.7, 5.0), 'page_views': (800, 2000),
    },
    'blue_spell': {
        'impression_rate': (70.0, 90.0), 'ctr': (20.0, 35.0), 'conversion': (4.0, 8.0),
        'occupancy': (80.0, 98.0), 'rating': (4.8, 5.0), 'page_views': (1200, 3000),
    },
    'yellow': {
        'impression_rate': (45.0, 65.0), 'ctr': (10.0, 18.0), 'conversion': (2.0, 4.0),
        'occupancy': (50.0, 75.0), 'rating': (4.3, 4.7), 'page_views': (400, 1000),
    },
    'orange': {
        'impression_rate': (30.0, 50.0), 'ctr': (6.0, 12.0), 'conversion': (1.0, 2.5),
        'occupancy': (35.0, 55.0), 'rating': (4.0, 4.5), 'page_views': (200, 600),
    },
    'red': {
        'impression_rate': (10.0, 35.0), 'ctr': (2.0, 8.0), 'conversion': (0.3, 1.5),
        'occupancy': (15.0, 40.0), 'rating': (3.5, 4.2), 'page_views': (50, 300),
    },
}

FUNNEL_BOTTLENECKS = {
    'green': 'none', 'blue_spell': 'none',
    'yellow': random.choice(['top', 'mid', 'bottom']),
    'orange': random.choice(['top', 'mid']),
    'red': 'top',
}

# Select a representative subset (~150 properties across all markets/tiers)
# for 12-week history. Give ALL properties at least a latest snapshot.
sample_props_for_history = random.sample(all_props, min(150, len(all_props)))
sample_ids = {p['id'] for p in sample_props_for_history}

# Properties with Airbnb IDs get snapshots
props_with_airbnb = [p for p in all_props if p.get('airbnb_listing_id')]

# Assign health statuses with realistic distribution
def assign_health():
    return random.choices(
        ['green', 'blue_spell', 'yellow', 'orange', 'red'],
        weights=[35, 10, 25, 20, 10]
    )[0]

# Pre-assign a stable health per property (with some drift over weeks)
prop_health = {}
for p in props_with_airbnb:
    prop_health[p['id']] = assign_health()

snapshot_rows = []
weeks = 12

for p in props_with_airbnb:
    health = prop_health[p['id']]
    profile = HEALTH_PROFILES[health]
    has_history = p['id'] in sample_ids

    num_weeks = weeks if has_history else 1  # Only latest week for non-sample props
    for w in range(num_weeks):
        snap_date = TODAY - timedelta(weeks=num_weeks - 1 - w)

        # Add some week-over-week variance
        variance = 1.0 + random.uniform(-0.08, 0.08)

        imp_rate = round(random.uniform(*profile['impression_rate']) * variance, 1)
        ctr = round(random.uniform(*profile['ctr']) * variance, 1)
        conv = round(random.uniform(*profile['conversion']) * variance, 2)
        occ = round(random.uniform(*profile['occupancy']) * variance, 1)
        rating = round(min(5.0, random.uniform(*profile['rating'])), 2)
        pvs = int(random.uniform(*profile['page_views']) * variance)
        impressions = int(pvs * (imp_rate / 100))

        # Derive other metrics
        adr = round(random.uniform(150, 650), 2)
        nights_booked = int(occ / 100 * 28)
        nights_blocked = random.randint(0, 7)
        unbooked = 28 - nights_booked - nights_blocked
        check_ins = max(1, nights_booked // random.randint(2, 5))
        avg_los = round(nights_booked / max(1, check_ins), 1)
        wishlist = int(pvs * random.uniform(0.02, 0.08))
        review_count = random.randint(5, 200)
        five_star_pct = round(rating * 20 - random.uniform(0, 5), 1)
        cancel_rate = round(random.uniform(0, 5), 1)
        returning_rate = round(random.uniform(5, 25), 1)
        lead_time = round(random.uniform(7, 60), 1)

        # Funnel bottleneck
        if health in ('green', 'blue_spell'):
            bottleneck = 'none'
        else:
            bottleneck = random.choice(['top', 'mid', 'bottom'])

        # Priority score (higher = more urgent)
        priority_map = {'red': (80, 100), 'orange': (60, 80), 'yellow': (40, 60), 'green': (10, 40), 'blue_spell': (0, 10)}
        priority = round(random.uniform(*priority_map[health]), 1)

        # Previous health status (occasionally different for transitions)
        prev_health = health
        if random.random() < 0.15:
            prev_health = random.choice(['green', 'yellow', 'orange', 'red'])

        snapshot_rows.append({
            'property_id': p['id'],
            'snapshot_date': iso(snap_date),
            'snapshot_source': 'airbnb',
            'scrape_completeness': 'complete',
            'pages_scraped': 5,
            'airbnb_overall_conversion_rate': conv,
            'airbnb_first_page_impression_rate': imp_rate,
            'airbnb_search_to_listing_ctr': ctr,
            'airbnb_listing_to_booking_conversion': conv,
            'airbnb_page_views': pvs,
            'airbnb_first_page_impressions': impressions,
            'airbnb_wishlist_additions': wishlist,
            'airbnb_booking_lead_time_days': lead_time,
            'airbnb_returning_guest_rate': returning_rate,
            'airbnb_occupancy_rate': occ,
            'airbnb_nights_booked': nights_booked,
            'airbnb_nights_blocked': nights_blocked,
            'airbnb_unbooked_nights': max(0, unbooked),
            'airbnb_check_ins': check_ins,
            'airbnb_cancellation_rate': cancel_rate,
            'airbnb_avg_length_of_stay_days': avg_los,
            'airbnb_avg_nightly_rate': adr,
            'airbnb_overall_rating': rating,
            'airbnb_5star_overall_pct': five_star_pct,
            'airbnb_review_count': review_count,
            'airbnb_superhost_status': 'Superhost' if rating >= 4.8 else 'Not Superhost',
            'airbnb_has_issues': health == 'red' and random.random() < 0.3,
            'health_status': health,
            'previous_health_status': prev_health,
            'priority_score': priority,
            'funnel_bottleneck': bottleneck,
        })

print(f"  Prepared {len(snapshot_rows)} snapshot rows")

# Insert in batches
SNAP_BATCH = 200
total_inserted = 0
for i in range(0, len(snapshot_rows), SNAP_BATCH):
    batch = snapshot_rows[i:i+SNAP_BATCH]
    body = json.dumps(batch).encode('utf-8')
    headers = {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_KEY,
        'Authorization': f'Bearer {SUPABASE_KEY}',
        'Prefer': 'resolution=merge-duplicates,return=minimal',
    }
    req = urllib.request.Request(
        f"{SUPABASE_URL}/rest/v1/lc_metric_snapshots",
        data=body, headers=headers, method='POST'
    )
    try:
        urllib.request.urlopen(req)
        total_inserted += len(batch)
    except urllib.error.HTTPError as e:
        err = e.read().decode()
        print(f"  ERROR batch {i}: {e.code} — {err[:300]}")
    if (i // SNAP_BATCH) % 10 == 0:
        print(f"  Inserted {total_inserted}/{len(snapshot_rows)} snapshots...")

print(f"  Total snapshots inserted: {total_inserted}")

# ─── Step 5: Refresh materialized view ──────────────────────────────────────
print("\nRefreshing lc_latest_snapshots materialized view...")
supabase_rpc('refresh_latest_snapshots')
print("  Done")

# ─── Step 6: Seed scrape runs ──────────────────────────────────────────────
print("\nSeeding scrape runs (12 weeks)...")
scrape_runs = []
for w in range(12):
    run_date = TODAY - timedelta(weeks=11 - w)
    props_scraped = random.randint(880, 950)
    props_expected = 951
    completeness = round(props_scraped / props_expected * 100, 1)
    duration = random.randint(3600, 7200)
    scrape_runs.append({
        'run_date': iso(run_date),
        'run_type': 'weekly_scan',
        'accounts_processed': 5,
        'accounts_failed': 0 if random.random() > 0.1 else 1,
        'properties_scraped': props_scraped,
        'properties_expected': props_expected,
        'completeness_pct': completeness,
        'started_at': f"{iso(run_date)}T02:00:00Z",
        'completed_at': f"{iso(run_date)}T{2 + duration // 3600:02d}:{(duration % 3600) // 60:02d}:00Z",
        'duration_seconds': duration,
    })
supabase_request('lc_scrape_runs', scrape_runs, prefer='return=minimal')
print(f"  Inserted {len(scrape_runs)} scrape runs")

# ─── Step 7: Seed agent executions ─────────────────────────────────────────
print("\nSeeding agent executions...")
AGENT_TYPES = [
    ('data-collection', 'weekly_scan'),
    ('funnel-analysis', 'analysis_run'),
    ('ab-test-tracker', 'snapshot_check'),
    ('review-manager', 'review_scan'),
    ('scorecard-generator', 'monthly_generation'),
]

agent_rows = []
for w in range(8):
    run_date = TODAY - timedelta(weeks=7 - w)
    for agent_name, exec_type in AGENT_TYPES:
        started = f"{iso(run_date)}T{random.randint(2,6):02d}:{random.randint(0,59):02d}:00Z"
        duration_min = random.randint(5, 90)
        status = 'completed' if random.random() > 0.05 else 'failed'
        props_proc = random.randint(800, 951)
        agent_rows.append({
            'agent_name': agent_name,
            'execution_type': exec_type,
            'started_at': started,
            'completed_at': f"{iso(run_date)}T{random.randint(3,8):02d}:{random.randint(0,59):02d}:00Z",
            'status': status,
            'properties_processed': props_proc,
            'properties_skipped': random.randint(0, 20),
            'results_summary': json.dumps({
                'properties_analyzed': props_proc,
                'issues_found': random.randint(10, 80),
                'recommendations_created': random.randint(5, 30),
            }),
        })

# Add a "running" execution for today
agent_rows.append({
    'agent_name': 'data-collection',
    'execution_type': 'weekly_scan',
    'started_at': f"{iso(TODAY)}T02:00:00Z",
    'status': 'running',
    'properties_processed': 342,
    'properties_skipped': 0,
})

supabase_request('lc_agent_executions', agent_rows, prefer='return=minimal')
print(f"  Inserted {len(agent_rows)} agent executions")

# ─── Step 8: Seed recommendations ──────────────────────────────────────────
print("\nSeeding recommendations...")

RECOMMENDATION_TEMPLATES = [
    {
        'type': 'title_optimization', 'funnel_stage': 'top',
        'title': 'Optimize listing title for search visibility',
        'description': 'Current title lacks key search terms. Adding "Pool" and "Mountain View" could improve first-page impression rate by 15-25%.',
        'predicted_impact': '+15-25% impression rate',
        'severity': 'high',
    },
    {
        'type': 'photo_reorder', 'funnel_stage': 'mid',
        'title': 'Reorder cover photos to highlight amenities',
        'description': 'Hero photo shows exterior but pool/hot tub photos drive 2x more clicks. Move pool photo to position 1.',
        'predicted_impact': '+10-18% CTR',
        'severity': 'medium',
    },
    {
        'type': 'pricing_adjustment', 'funnel_stage': 'bottom',
        'title': 'Reduce minimum stay during shoulder season',
        'description': 'Current 4-night minimum is blocking 60% of search queries. Reducing to 2 nights would capture short-stay demand.',
        'predicted_impact': '+20-30% conversion rate',
        'severity': 'high',
    },
    {
        'type': 'description_update', 'funnel_stage': 'mid',
        'title': 'Update listing description with local attractions',
        'description': 'Listing description is generic. Adding specific local attractions and distance info improves engagement metrics.',
        'predicted_impact': '+5-10% CTR',
        'severity': 'low',
    },
    {
        'type': 'amenity_highlight', 'funnel_stage': 'mid',
        'title': 'Add missing amenity tags',
        'description': 'Property has EV charger, game room, and heated pool but these are not in Airbnb amenity list. Adding them improves search matching.',
        'predicted_impact': '+8-12% impression rate',
        'severity': 'medium',
    },
    {
        'type': 'review_response', 'funnel_stage': 'bottom',
        'title': 'Respond to recent negative review',
        'description': 'A 3-star review from 5 days ago mentions cleanliness. Unresponded reviews reduce booking confidence. Draft a professional response.',
        'predicted_impact': 'Protects conversion rate',
        'severity': 'high',
    },
    {
        'type': 'cancellation_policy', 'funnel_stage': 'bottom',
        'title': 'Switch to flexible cancellation policy',
        'description': 'Strict policy is deterring bookings. Similar properties with Flexible policy see 15% higher conversion.',
        'predicted_impact': '+12-15% conversion rate',
        'severity': 'medium',
    },
    {
        'type': 'instant_book', 'funnel_stage': 'bottom',
        'title': 'Enable Instant Book',
        'description': 'Property requires manual approval. Enabling Instant Book improves search ranking and conversion by removing friction.',
        'predicted_impact': '+20-30% bookings',
        'severity': 'high',
    },
]

# Pick ~80 properties to have recommendations
rec_props = random.sample(props_with_airbnb, min(80, len(props_with_airbnb)))
rec_rows = []
statuses = ['pending', 'pending', 'pending', 'approved', 'approved', 'rejected', 'deferred', 'auto_executed']

for p in rec_props:
    num_recs = random.randint(1, 3)
    templates = random.sample(RECOMMENDATION_TEMPLATES, min(num_recs, len(RECOMMENDATION_TEMPLATES)))
    for tmpl in templates:
        status = random.choice(statuses)
        created = TODAY - timedelta(days=random.randint(0, 21))
        rec = {
            'property_id': p['id'],
            'agent_name': 'funnel-analysis',
            'recommendation_type': tmpl['type'],
            'title': tmpl['title'],
            'description': tmpl['description'],
            'predicted_impact': tmpl['predicted_impact'],
            'diagnosed_issue': f"Low {tmpl['funnel_stage']} funnel performance detected",
            'funnel_stage': tmpl['funnel_stage'],
            'severity': tmpl['severity'],
            'status': status,
            'created_at': f"{iso(created)}T10:00:00Z",
            'updated_at': f"{iso(created)}T10:00:00Z",
        }
        if status == 'approved':
            rec['reviewed_by'] = 'Jason Pratts'
            rec['reviewed_at'] = f"{iso(created + timedelta(days=1))}T14:00:00Z"
        elif status == 'rejected':
            rec['reviewed_by'] = 'Jason Pratts'
            rec['reviewed_at'] = f"{iso(created + timedelta(days=1))}T14:00:00Z"
            rec['rejection_reason'] = 'Owner prefers current approach'
        elif status == 'deferred':
            rec['defer_until'] = iso(created + timedelta(days=30))
        rec_rows.append(rec)

for i in range(0, len(rec_rows), BATCH):
    supabase_request('lc_recommendations', rec_rows[i:i+BATCH], prefer='return=minimal')
print(f"  Inserted {len(rec_rows)} recommendations")

# ─── Step 9: Seed A/B tests ────────────────────────────────────────────────
print("\nSeeding A/B tests...")

TEST_TEMPLATES = [
    {
        'test_type': 'title', 'target_metric': 'airbnb_first_page_impression_rate',
        'thesis': 'Adding "Private Pool" to title will increase search impressions',
        'change_description': 'Updated title from "Beautiful Desert Home" to "Beautiful Desert Home w/ Private Pool & Mountain Views"',
    },
    {
        'test_type': 'photos', 'target_metric': 'airbnb_search_to_listing_ctr',
        'thesis': 'Pool photo as cover image will improve CTR over exterior shot',
        'change_description': 'Swapped cover photo from front exterior to pool/patio twilight shot',
    },
    {
        'test_type': 'pricing', 'target_metric': 'airbnb_listing_to_booking_conversion',
        'thesis': 'Reducing minimum stay from 4 to 2 nights will increase conversion',
        'change_description': 'Changed minimum stay from 4 nights to 2 nights for weekday bookings',
    },
    {
        'test_type': 'description', 'target_metric': 'airbnb_search_to_listing_ctr',
        'thesis': 'Adding structured highlights section will increase listing engagement',
        'change_description': 'Added "Top 5 reasons guests love this home" section to description',
    },
]

test_props = random.sample(props_with_airbnb, min(30, len(props_with_airbnb)))
test_rows = []

for i, p in enumerate(test_props):
    tmpl = TEST_TEMPLATES[i % len(TEST_TEMPLATES)]
    # Mix of statuses
    if i < 8:
        status = 'active'
        before_date = TODAY - timedelta(days=random.randint(14, 28))
        before_metrics = {'value': round(random.uniform(10, 40), 1)}
        test_rows.append({
            'property_id': p['id'],
            'test_type': tmpl['test_type'],
            'thesis': tmpl['thesis'],
            'target_metric': tmpl['target_metric'],
            'before_snapshot_date': iso(before_date),
            'before_metrics': json.dumps(before_metrics),
            'change_description': tmpl['change_description'],
            'change_executed_date': iso(before_date + timedelta(days=1)),
            'after_snapshot_due_date': iso(before_date + timedelta(days=28)),
            'status': 'active',
            'minimum_impressions': 3000,
            'soak_period_days': 21,
        })
    elif i < 20:
        # Completed tests with results
        before_date = TODAY - timedelta(days=random.randint(35, 60))
        before_val = round(random.uniform(10, 40), 1)
        lift = round(random.uniform(-5, 25), 1)
        after_val = round(before_val + lift, 1)
        result = 'positive' if lift > 3 else ('negative' if lift < -2 else 'no_change')
        decision = 'keep_change' if result == 'positive' else ('revert' if result == 'negative' else 'keep_monitoring')

        test_rows.append({
            'property_id': p['id'],
            'test_type': tmpl['test_type'],
            'thesis': tmpl['thesis'],
            'target_metric': tmpl['target_metric'],
            'before_snapshot_date': iso(before_date),
            'before_metrics': json.dumps({'value': before_val}),
            'change_description': tmpl['change_description'],
            'change_executed_date': iso(before_date + timedelta(days=1)),
            'after_snapshot_due_date': iso(before_date + timedelta(days=28)),
            'after_snapshot_date': iso(before_date + timedelta(days=28)),
            'after_metrics': json.dumps({'value': after_val}),
            'status': 'completed',
            'result': result,
            'metric_lift': lift,
            'result_summary': f"{'Positive' if result == 'positive' else 'Negative' if result == 'negative' else 'Neutral'}: {tmpl['target_metric']} moved from {before_val}% to {after_val}% ({'+' if lift > 0 else ''}{lift}%)",
            'decision': decision,
            'minimum_impressions': 3000,
            'soak_period_days': 21,
        })
    else:
        # Pending tests
        test_rows.append({
            'property_id': p['id'],
            'test_type': tmpl['test_type'],
            'thesis': tmpl['thesis'],
            'target_metric': tmpl['target_metric'],
            'change_description': tmpl['change_description'],
            'status': 'pending',
            'minimum_impressions': 3000,
        })

supabase_request('lc_ab_tests', test_rows, prefer='return=minimal')
print(f"  Inserted {len(test_rows)} A/B tests")

# ─── Step 10: Seed reviews ─────────────────────────────────────────────────
print("\nSeeding reviews...")

REVIEW_TEMPLATES = [
    {'rating': 5, 'sentiment': 'positive', 'themes': ['cleanliness', 'location', 'amenities'],
     'text': 'Absolutely stunning property! The pool was crystal clear, the kitchen was fully stocked, and the mountain views were breathtaking. Would definitely book again!'},
    {'rating': 5, 'sentiment': 'positive', 'themes': ['hospitality', 'communication'],
     'text': 'Best vacation rental experience ever. The team was incredibly responsive and even left us local restaurant recommendations. The property exceeded all expectations.'},
    {'rating': 4, 'sentiment': 'positive', 'themes': ['location', 'value'],
     'text': 'Great location and good value for the price. Property was clean and well-maintained. Only minor issue was the WiFi being slow at times.'},
    {'rating': 4, 'sentiment': 'mixed', 'themes': ['cleanliness', 'maintenance'],
     'text': 'Nice property overall but a few maintenance items need attention. The hot tub cover was torn and one of the bathroom faucets was leaking. Otherwise a solid stay.'},
    {'rating': 3, 'sentiment': 'mixed', 'themes': ['cleanliness', 'accuracy'],
     'text': 'The property looks different from the photos. It was clean enough but felt dated. The pool area needs some TLC. Average experience for the price point.'},
    {'rating': 2, 'sentiment': 'negative', 'themes': ['cleanliness', 'maintenance', 'communication'],
     'text': 'Disappointing stay. Found the property not fully cleaned on arrival, AC was struggling in the heat, and it took hours to get a response from support. Not what we expected.'},
    {'rating': 5, 'sentiment': 'positive', 'themes': ['amenities', 'family-friendly'],
     'text': 'Perfect family getaway! Kids loved the pool and game room. The kitchen had everything we needed. Already planning our return trip for next year!'},
    {'rating': 4, 'sentiment': 'positive', 'themes': ['location', 'check-in'],
     'text': 'Smooth check-in process and great location close to everything. The property was exactly as described. Would recommend to friends and family.'},
]

GUEST_NAMES = [
    'Sarah M.', 'James T.', 'Maria G.', 'Robert K.', 'Jennifer L.', 'Michael D.',
    'Ashley R.', 'David W.', 'Lisa P.', 'Christopher B.', 'Amanda F.', 'Daniel H.',
    'Emily S.', 'Matthew C.', 'Rachel N.', 'Andrew V.', 'Jessica A.', 'Ryan O.',
    'Samantha E.', 'Kevin J.', 'Lauren M.', 'Brandon T.', 'Nicole W.', 'Justin H.',
]

RESPONSE_TEMPLATES = [
    "Thank you so much for your wonderful review, {guest}! We're thrilled you enjoyed your stay and the {feature}. We look forward to welcoming you back!",
    "We appreciate your feedback, {guest}. We're glad you had a great experience. Your kind words mean a lot to our team!",
    "Thank you for staying with us, {guest}! We're sorry about the {issue}. Our team has already addressed this. We hope to host you again soon!",
]

review_props = random.sample(props_with_airbnb, min(200, len(props_with_airbnb)))
review_rows = []

for p in review_props:
    num_reviews = random.randint(1, 5)
    for _ in range(num_reviews):
        tmpl = random.choice(REVIEW_TEMPLATES)
        review_date = TODAY - timedelta(days=random.randint(1, 90))
        guest = random.choice(GUEST_NAMES)

        # Response status
        if review_date < TODAY - timedelta(days=14):
            resp_status = random.choice(['responded', 'responded', 'responded', 'skipped'])
            resp_text = random.choice(RESPONSE_TEMPLATES).format(guest=guest, feature='amazing amenities', issue='minor inconvenience') if resp_status == 'responded' else None
        elif review_date < TODAY - timedelta(days=3):
            resp_status = random.choice(['responded', 'draft_ready', 'pending'])
            resp_text = random.choice(RESPONSE_TEMPLATES).format(guest=guest, feature='beautiful property', issue='WiFi issue') if resp_status in ('responded', 'draft_ready') else None
        else:
            resp_status = random.choice(['pending', 'draft_ready'])
            resp_text = random.choice(RESPONSE_TEMPLATES).format(guest=guest, feature='pool area', issue='issue') if resp_status == 'draft_ready' else None

        review_rows.append({
            'property_id': p['id'],
            'channel': random.choice(['airbnb', 'airbnb', 'airbnb', 'vrbo', 'google']),
            'guest_name': guest,
            'review_date': iso(review_date),
            'rating': tmpl['rating'],
            'review_text': tmpl['text'],
            'response_status': resp_status,
            'response_text': resp_text,
            'sentiment': tmpl['sentiment'],
            'themes': json.dumps(tmpl['themes']),
            'source': 'scrape',
        })

for i in range(0, len(review_rows), BATCH):
    supabase_request('lc_reviews', review_rows[i:i+BATCH], prefer='return=minimal')
print(f"  Inserted {len(review_rows)} reviews")

# ─── Step 11: Seed guest ratings (pending submissions) ─────────────────────
print("\nSeeding guest ratings...")

rating_props = random.sample(props_with_airbnb, min(40, len(props_with_airbnb)))
rating_rows = []

for p in rating_props:
    checkout = TODAY - timedelta(days=random.randint(1, 12))
    deadline = checkout + timedelta(days=14)
    rating_rows.append({
        'property_id': p['id'],
        'airbnb_account_id': random.choice([1, 2, 3, 4, 5]),
        'guest_name': random.choice(GUEST_NAMES),
        'checkout_date': iso(checkout),
        'rating_deadline': iso(deadline),
        'submission_status': 'pending',
    })

supabase_request('lc_guest_ratings', rating_rows, prefer='return=minimal')
print(f"  Inserted {len(rating_rows)} guest ratings")

# ─── Step 12: Seed change log ──────────────────────────────────────────────
print("\nSeeding change log entries...")

CHANGE_TYPES = [
    ('title_update', 'listing_title', 'Beautiful Desert Retreat', 'Beautiful Desert Retreat w/ Private Pool & Mountain Views'),
    ('photo_reorder', 'cover_photo', 'exterior_front.jpg', 'pool_twilight.jpg'),
    ('pricing_change', 'minimum_stay', '4 nights', '2 nights'),
    ('description_update', 'description', 'Original description...', 'Updated description with highlights...'),
    ('amenity_update', 'amenities', 'Pool, WiFi, Kitchen', 'Pool, WiFi, Kitchen, EV Charger, Game Room'),
    ('policy_change', 'cancellation_policy', 'Strict', 'Flexible'),
]

change_props = random.sample(props_with_airbnb, min(50, len(props_with_airbnb)))
change_rows = []

for p in change_props:
    num_changes = random.randint(1, 3)
    for _ in range(num_changes):
        ct = random.choice(CHANGE_TYPES)
        change_date = TODAY - timedelta(days=random.randint(1, 45))
        approval = random.choice(['pending', 'approved', 'approved', 'approved', 'rejected'])
        change_rows.append({
            'property_id': p['id'],
            'change_date': f"{iso(change_date)}T10:00:00Z",
            'change_type': ct[0],
            'change_source': random.choice(['ai_agent', 'ai_agent', 'manual']),
            'field_changed': ct[1],
            'old_value': ct[2],
            'new_value': ct[3],
            'thesis': f"Changing {ct[1]} to improve funnel metrics",
            'diagnosed_issue': f"Below-benchmark performance in {random.choice(['top', 'mid', 'bottom'])} funnel",
            'predicted_impact': f"+{random.randint(5, 25)}% improvement",
            'approval_status': approval,
            'execution_status': 'completed' if approval == 'approved' else 'not_started',
        })

for i in range(0, len(change_rows), BATCH):
    supabase_request('lc_change_log', change_rows[i:i+BATCH], prefer='return=minimal')
print(f"  Inserted {len(change_rows)} change log entries")

# ─── Step 13: Seed owner scorecards ────────────────────────────────────────
print("\nSeeding owner scorecards...")

scorecard_props = random.sample(props_with_airbnb, min(60, len(props_with_airbnb)))
scorecard_rows = []

for p in scorecard_props:
    for month_offset in range(3):
        report_month = date(2026, 4 - month_offset, 1)
        health = prop_health.get(p['id'], 'unknown')
        scorecard_data = {
            'health_status': health,
            'occupancy_rate': round(random.uniform(40, 95), 1),
            'avg_nightly_rate': round(random.uniform(180, 550), 2),
            'total_revenue': round(random.uniform(2000, 15000), 2),
            'review_score': round(random.uniform(4.0, 5.0), 2),
            'review_count': random.randint(2, 15),
            'funnel_metrics': {
                'impression_rate': round(random.uniform(30, 80), 1),
                'ctr': round(random.uniform(5, 30), 1),
                'conversion': round(random.uniform(1, 6), 2),
            },
            'recommendations': [
                'Consider updating listing photos for summer season',
                'Review pricing strategy for upcoming holiday weekends',
            ],
            'market_comparison': {
                'occupancy_vs_market': round(random.uniform(-10, 15), 1),
                'rate_vs_market': round(random.uniform(-50, 80), 2),
            },
        }

        gen_status = 'completed' if month_offset > 0 else random.choice(['completed', 'pending', 'pending'])
        scorecard_rows.append({
            'property_id': p['id'],
            'report_month': iso(report_month),
            'generated_at': f"{iso(report_month + timedelta(days=3))}T08:00:00Z" if gen_status == 'completed' else None,
            'generation_status': gen_status,
            'scorecard_data': json.dumps(scorecard_data),
            'delivery_method': 'email' if gen_status == 'completed' else None,
            'delivered_at': f"{iso(report_month + timedelta(days=3))}T09:00:00Z" if gen_status == 'completed' and month_offset > 0 else None,
        })

for i in range(0, len(scorecard_rows), BATCH):
    supabase_request('lc_owner_scorecards', scorecard_rows[i:i+BATCH], prefer='resolution=merge-duplicates,return=minimal')
print(f"  Inserted {len(scorecard_rows)} owner scorecards")

# ─── Step 14: Seed competitor snapshots ─────────────────────────────────────
print("\nSeeding competitor snapshots...")

MARKETS = ['scottsdale', 'tucson', 'sedona', 'coachella', 'central_coast']
comp_rows = []

for market in MARKETS:
    for comp_num in range(5):
        listing_id = f"comp-{market[:3]}-{comp_num+1:03d}"
        for w in range(4):
            snap_date = TODAY - timedelta(weeks=3 - w)
            comp_rows.append({
                'market': market,
                'competitor_listing_id': listing_id,
                'snapshot_date': iso(snap_date),
                'cancellation_policy': random.choice(['Flexible', 'Moderate', 'Strict']),
                'nightly_rate_range': f"${random.randint(150, 400)}-${random.randint(400, 800)}",
                'review_score': round(random.uniform(4.0, 5.0), 2),
                'review_count': random.randint(20, 500),
                'guest_favorites': random.random() > 0.7,
                'min_stay': random.choice([1, 2, 2, 3, 4]),
                'on_first_page': random.random() > 0.4,
            })

for i in range(0, len(comp_rows), BATCH):
    supabase_request('lc_competitor_snapshots', comp_rows[i:i+BATCH], prefer='return=minimal')
print(f"  Inserted {len(comp_rows)} competitor snapshots")

# ─── Final refresh ──────────────────────────────────────────────────────────
print("\nFinal refresh of materialized view...")
supabase_rpc('refresh_latest_snapshots')

print(f"""
{'='*60}
SEED COMPLETE!
{'='*60}

Summary:
  Properties enriched:  {len(enrichment_rows)}
  Airbnb accounts:      {len(accounts)}
  Metric snapshots:     {total_inserted}
  Scrape runs:          {len(scrape_runs)}
  Agent executions:     {len(agent_rows)}
  Recommendations:      {len(rec_rows)}
  A/B tests:            {len(test_rows)}
  Reviews:              {len(review_rows)}
  Guest ratings:        {len(rating_rows)}
  Change log entries:   {len(change_rows)}
  Owner scorecards:     {len(scorecard_rows)}
  Competitor snapshots: {len(comp_rows)}

Materialized view refreshed. Reload http://localhost:3000 to see the data!
""")
