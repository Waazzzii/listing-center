#!/usr/bin/env python3
"""Seed realistic Wheelhouse KPI, Health Score, and Revenue Projection data into Listing Center tables."""
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

def iso(d):
    return d.isoformat()

TODAY = date(2026, 4, 10)

# ─── Market seasonality profiles (April context) ─────────────────────────────
# AZ markets are in shoulder season (cooling down from peak winter)
# CA markets are picking up (spring/summer ramp)
MARKET_SEASONALITY = {
    'Scottsdale':       {'occ_range': (45, 70), 'rate_mult': 0.85, 'demand': 'shoulder'},
    'Tucson':           {'occ_range': (40, 65), 'rate_mult': 0.80, 'demand': 'shoulder'},
    'Sedona':           {'occ_range': (55, 80), 'rate_mult': 1.00, 'demand': 'strong'},
    'Coachella Valley': {'occ_range': (60, 85), 'rate_mult': 1.10, 'demand': 'peak'},
    'Central Coast':    {'occ_range': (50, 75), 'rate_mult': 0.95, 'demand': 'ramp_up'},
    'Orange County':    {'occ_range': (55, 80), 'rate_mult': 1.05, 'demand': 'ramp_up'},
    'Flagstaff':        {'occ_range': (40, 60), 'rate_mult': 0.75, 'demand': 'shoulder'},
}
DEFAULT_SEASONALITY = {'occ_range': (45, 70), 'rate_mult': 0.90, 'demand': 'shoulder'}

# Quality tier → base asking rate range
TIER_RATE_RANGES = {
    'standard':  (150, 250),
    'silver':    (200, 350),
    'gold':      (300, 500),
    'platinum':  (450, 650),
    'diamond':   (550, 800),
}
DEFAULT_RATE_RANGE = (200, 400)

# Wheelhouse flag options
WH_FLAGS = [
    'stale_rates', 'low_occupancy', 'high_vacancy', 'rate_drop_detected',
    'competitor_undercut', 'event_spike_missed', 'minimum_stay_too_high',
    'base_price_outdated', 'seasonal_adjustment_needed',
]


# ─── Step 1: Fetch existing properties ──────────────────────────────────────
print("Fetching active properties from lc_properties...")
all_props = supabase_get(
    "lc_properties?select=id,property_name,market,quality_tier,quality_tier_numeric,bedrooms,airbnb_listing_id"
    "&is_active=eq.true&limit=1100"
)
print(f"  Found {len(all_props)} active properties")

if not all_props:
    print("ERROR: No properties found. Run seed-from-mcp.py and seed-placeholder-data.py first.")
    sys.exit(1)

# Group by market for reporting
by_market = {}
for p in all_props:
    by_market.setdefault(p.get('market', 'Unknown'), []).append(p)
print(f"  Markets: {', '.join(f'{m}({len(ps)})' for m, ps in sorted(by_market.items()))}")


# ═══════════════════════════════════════════════════════════════════════════════
# Step 2: Seed lc_wheelhouse_kpis — 1 row per property
# ═══════════════════════════════════════════════════════════════════════════════
print("\nSeeding lc_wheelhouse_kpis (one row per property, one at a time)...")

wh_inserted = 0
wh_errors = 0

for i, p in enumerate(all_props):
    market = p.get('market', 'Unknown')
    tier = p.get('quality_tier', 'standard') or 'standard'
    season = MARKET_SEASONALITY.get(market, DEFAULT_SEASONALITY)
    rate_range = TIER_RATE_RANGES.get(tier, DEFAULT_RATE_RANGE)

    # Occupancy — market-driven with some randomness
    occ_30d = round(random.uniform(*season['occ_range']), 1)
    occ_120d = round(occ_30d + random.uniform(-8, 8), 1)
    occ_120d = max(15, min(95, occ_120d))

    # Available nights
    available_30d = random.randint(22, 30)
    available_120d = random.randint(90, 120)

    # Booked nights
    booked_30d = int(available_30d * occ_30d / 100)
    booked_120d = int(available_120d * occ_120d / 100)

    # Asking rate — tier + market multiplier
    base_rate = round(random.uniform(*rate_range) * season['rate_mult'], 2)
    avg_nightly = round(base_rate * random.uniform(0.85, 1.10), 2)

    # RevPAR
    revpar = round(base_rate * occ_30d / 100, 2)
    adj_revpar = round(avg_nightly * occ_30d / 100, 2)
    revpar_120d = round(base_rate * occ_120d / 100, 2)

    # Base price: recommended vs selected
    recommended = round(base_rate * random.uniform(0.95, 1.10), 2)
    conservative = round(recommended * 0.85, 2)
    aggressive = round(recommended * 1.20, 2)

    # ~70% aligned (within 5%), ~30% misaligned
    if random.random() < 0.70:
        selected = round(recommended * random.uniform(0.97, 1.03), 2)
    else:
        # Misaligned — either too high or too low
        direction = random.choice([-1, 1])
        selected = round(recommended * (1 + direction * random.uniform(0.10, 0.30)), 2)

    price_alignment = round((selected - recommended) / recommended * 100, 1) if recommended > 0 else 0

    # Anchor credibility
    anchor_cred = random.randint(40, 95)
    anchor_price = round(recommended * random.uniform(0.90, 1.15), 2)

    # Auto-rate posting: 60% enabled
    auto_rates = random.random() < 0.60

    # Last booked
    days_since_booked = random.randint(0, 21)
    last_booked = f"{iso(TODAY - timedelta(days=days_since_booked))}T{random.randint(8,22):02d}:{random.randint(0,59):02d}:00Z"

    # Wheelhouse flags — most properties have none, ~20% have 1-2 flags
    flags = []
    if random.random() < 0.20:
        num_flags = random.randint(1, 2)
        flags = random.sample(WH_FLAGS, num_flags)

    row = {
        'property_id': p['id'],
        'sync_date': iso(TODAY),
        'channel': 'airbnb',
        'adjusted_occupancy_30d': occ_30d,
        'occupancy_30d': round(occ_30d + random.uniform(-3, 3), 1),
        'available_nights_30d': available_30d,
        'average_asking_rate': base_rate,
        'average_nightly_rate': avg_nightly,
        'adjusted_nightly_revpar': adj_revpar,
        'nightly_revpar': revpar,
        'last_booked_at': last_booked,
        'booked_nights_30d': booked_30d,
        'adjusted_occupancy_120d': occ_120d,
        'occupancy_120d': round(occ_120d + random.uniform(-3, 3), 1),
        'available_nights_120d': available_120d,
        'booked_nights_120d': booked_120d,
        'nightly_revpar_120d': revpar_120d,
        'base_price_selected': selected,
        'base_price_recommended': recommended,
        'base_price_conservative': conservative,
        'base_price_aggressive': aggressive,
        'anchor_credibility': anchor_cred,
        'anchor_price': anchor_price,
        'price_alignment_pct': price_alignment,
        'wheelhouse_flags': json.dumps(flags),
        'auto_rate_posting_enabled': auto_rates,
    }

    result = supabase_request('lc_wheelhouse_kpis', row, prefer='return=minimal')
    if result == []:
        wh_inserted += 1
    else:
        wh_errors += 1

    if (i + 1) % 100 == 0:
        print(f"  Progress: {i + 1}/{len(all_props)} ({wh_inserted} inserted, {wh_errors} errors)")

    # Store computed values on the property dict for use in later steps
    p['_occ_30d'] = occ_30d
    p['_occ_120d'] = occ_120d
    p['_base_rate'] = base_rate
    p['_revpar'] = revpar
    p['_selected'] = selected
    p['_recommended'] = recommended
    p['_price_alignment'] = price_alignment
    p['_auto_rates'] = auto_rates
    p['_flags'] = flags

print(f"  Done: {wh_inserted} inserted, {wh_errors} errors")


# ═══════════════════════════════════════════════════════════════════════════════
# Step 3: Seed lc_health_scores — 1 row per property
# ═══════════════════════════════════════════════════════════════════════════════
print("\nSeeding lc_health_scores (one row per property, one at a time)...")

# Component weights
WEIGHTS = {
    'search_visibility': 15,
    'ctr': 12,
    'conversion': 15,
    'listing_completeness': 8,
    'guest_rating': 12,
    'base_price_alignment': 10,
    'revenue_vs_projection': 10,
    'forward_occupancy': 10,
    'pricing_strategy': 8,
}

def grade_from_score(score):
    if score >= 80: return 'A'
    if score >= 60: return 'B'
    if score >= 40: return 'C'
    if score >= 20: return 'D'
    return 'F'

hs_inserted = 0
hs_errors = 0

for i, p in enumerate(all_props):
    occ = p.get('_occ_30d', 55)
    rate = p.get('_base_rate', 250)
    alignment = abs(p.get('_price_alignment', 0))
    has_flags = len(p.get('_flags', [])) > 0
    tier = p.get('quality_tier', 'standard') or 'standard'

    # Search visibility score: based on occupancy as proxy
    search_vis = int(min(100, max(10, occ * 1.2 + random.randint(-10, 10))))

    # CTR score
    ctr_score = int(min(100, max(10, random.randint(30, 85) + (10 if tier in ('gold', 'platinum', 'diamond') else 0))))

    # Conversion score
    conv_score = int(min(100, max(10, random.randint(25, 80) + (15 if occ > 65 else -5))))

    # Listing completeness — most are decent, some are lacking
    completeness = random.choices([95, 88, 80, 70, 55, 40], weights=[30, 25, 20, 15, 7, 3])[0]
    completeness += random.randint(-5, 5)
    completeness = max(10, min(100, completeness))

    # Guest rating score
    rating_score = int(min(100, max(10, random.randint(50, 95) + (10 if tier in ('platinum', 'diamond') else 0))))

    # Base price alignment score (closer to recommended = higher)
    if alignment < 3:
        price_align_score = random.randint(85, 100)
    elif alignment < 8:
        price_align_score = random.randint(60, 85)
    elif alignment < 15:
        price_align_score = random.randint(35, 60)
    else:
        price_align_score = random.randint(10, 40)

    # Revenue vs projection score
    rev_proj_score = int(min(100, max(10, random.randint(35, 90))))

    # Forward occupancy score
    fwd_occ_score = int(min(100, max(10, p.get('_occ_120d', 50) * 1.1 + random.randint(-10, 10))))

    # Pricing strategy score (auto-rates + no flags = higher)
    pricing_strat = random.randint(50, 85)
    if p.get('_auto_rates', False):
        pricing_strat += 10
    if has_flags:
        pricing_strat -= 15
    pricing_strat = max(10, min(100, pricing_strat))

    # Weighted composite
    components = {
        'search_visibility': search_vis,
        'ctr': ctr_score,
        'conversion': conv_score,
        'listing_completeness': completeness,
        'guest_rating': rating_score,
        'base_price_alignment': price_align_score,
        'revenue_vs_projection': rev_proj_score,
        'forward_occupancy': fwd_occ_score,
        'pricing_strategy': pricing_strat,
    }
    overall = round(sum(components[k] * WEIGHTS[k] for k in WEIGHTS) / sum(WEIGHTS.values()))
    overall = max(0, min(100, overall))
    grade = grade_from_score(overall)

    # Previous score (slightly different for delta)
    prev_score = overall + random.randint(-12, 8)
    prev_score = max(0, min(100, prev_score))
    delta = overall - prev_score

    # Channels active
    r = random.random()
    if r < 0.30:
        channels = ["airbnb", "vrbo", "booking"]
    elif r < 0.70:
        channels = ["airbnb", "vrbo"]
    else:
        channels = ["airbnb"]

    row = {
        'property_id': p['id'],
        'score_date': iso(TODAY),
        'overall_score': overall,
        'overall_grade': grade,
        'search_visibility_score': search_vis,
        'ctr_score': ctr_score,
        'conversion_score': conv_score,
        'listing_completeness_score': completeness,
        'guest_rating_score': rating_score,
        'base_price_alignment_score': price_align_score,
        'revenue_vs_projection_score': rev_proj_score,
        'forward_occupancy_score': fwd_occ_score,
        'pricing_strategy_score': pricing_strat,
        'weights': json.dumps(WEIGHTS),
        'previous_score': prev_score,
        'score_delta': delta,
        'channels_active': json.dumps(channels),
    }

    result = supabase_request('lc_health_scores', row, prefer='return=minimal')
    if result == []:
        hs_inserted += 1
    else:
        hs_errors += 1

    if (i + 1) % 100 == 0:
        print(f"  Progress: {i + 1}/{len(all_props)} ({hs_inserted} inserted, {hs_errors} errors)")

    # Store for revenue step
    p['_health_score'] = overall

print(f"  Done: {hs_inserted} inserted, {hs_errors} errors")


# ═══════════════════════════════════════════════════════════════════════════════
# Step 4: Seed lc_revenue_projections — 1 row per property
# ═══════════════════════════════════════════════════════════════════════════════
print("\nSeeding lc_revenue_projections (one row per property, one at a time)...")

MONTHS = [
    ('Apr 2026', 30),
    ('May 2026', 31),
    ('Jun 2026', 30),
    ('Jul 2026', 31),
]

# Market monthly demand multipliers (relative to base)
MONTHLY_DEMAND = {
    'Scottsdale':       [0.70, 0.50, 0.40, 0.35],   # AZ cooling off into summer
    'Tucson':           [0.65, 0.45, 0.35, 0.30],
    'Sedona':           [0.90, 0.85, 0.75, 0.70],   # Stays decent
    'Coachella Valley': [1.10, 0.80, 0.55, 0.40],   # Post-festival drop
    'Central Coast':    [0.80, 0.90, 1.00, 1.10],   # CA ramps into summer
    'Orange County':    [0.85, 0.95, 1.10, 1.20],
    'Flagstaff':        [0.60, 0.75, 0.90, 1.00],   # Summer is peak
}
DEFAULT_DEMAND = [0.75, 0.70, 0.65, 0.60]

rp_inserted = 0
rp_errors = 0

for i, p in enumerate(all_props):
    market = p.get('market', 'Unknown')
    tier = p.get('quality_tier', 'standard') or 'standard'
    rate = p.get('_base_rate', 250)
    occ_30d = p.get('_occ_30d', 55)
    revpar = p.get('_revpar', 120)

    demand_curve = MONTHLY_DEMAND.get(market, DEFAULT_DEMAND)

    # Base monthly projected revenue = rate * nights_in_month * expected_occ * demand_mult
    month_data = {}
    total_proj = 0
    total_booked = 0
    total_actual = 0

    for m_idx, (label, days) in enumerate(MONTHS):
        demand_mult = demand_curve[m_idx]
        expected_occ = min(0.95, (occ_30d / 100) * demand_mult + random.uniform(-0.05, 0.05))
        projected = round(rate * days * expected_occ, 2)
        projected = max(500, projected)  # Minimum floor

        if m_idx == 0:
            # April — we're 10 days in, so ~33% through
            # Actual = revenue already earned (first 10 days)
            actual = round(projected * random.uniform(0.25, 0.40), 2)
            # Booked = actual + remaining confirmed reservations
            booked = round(projected * random.uniform(0.55, 0.85), 2)
        elif m_idx == 1:
            # May — future month, no actual yet
            actual = 0
            booked = round(projected * random.uniform(0.30, 0.65), 2)
        elif m_idx == 2:
            # June — further out
            actual = 0
            booked = round(projected * random.uniform(0.15, 0.45), 2)
        else:
            # July — furthest out
            actual = 0
            booked = round(projected * random.uniform(0.05, 0.30), 2)

        pct = round(booked / projected * 100, 1) if projected > 0 else 0

        month_data[m_idx] = {
            'label': label,
            'projected': projected,
            'actual': actual,
            'booked': booked,
            'pct': pct,
        }
        total_proj += projected
        total_booked += booked
        total_actual += actual

    total_pct = round(total_booked / total_proj * 100, 1) if total_proj > 0 else 0

    # Pace status based on total pct to projection
    if total_pct >= 65:
        pace = 'ahead'
    elif total_pct >= 45:
        pace = 'on_track'
    elif total_pct >= 30:
        pace = 'behind'
    else:
        pace = 'at_risk'

    row = {
        'property_id': p['id'],
        'projection_date': iso(TODAY),
        'month_1_label': month_data[0]['label'],
        'month_1_projected': month_data[0]['projected'],
        'month_1_actual': month_data[0]['actual'],
        'month_1_booked': month_data[0]['booked'],
        'month_1_pct_to_projection': month_data[0]['pct'],
        'month_2_label': month_data[1]['label'],
        'month_2_projected': month_data[1]['projected'],
        'month_2_actual': month_data[1]['actual'],
        'month_2_booked': month_data[1]['booked'],
        'month_2_pct_to_projection': month_data[1]['pct'],
        'month_3_label': month_data[2]['label'],
        'month_3_projected': month_data[2]['projected'],
        'month_3_actual': month_data[2]['actual'],
        'month_3_booked': month_data[2]['booked'],
        'month_3_pct_to_projection': month_data[2]['pct'],
        'month_4_label': month_data[3]['label'],
        'month_4_projected': month_data[3]['projected'],
        'month_4_actual': month_data[3]['actual'],
        'month_4_booked': month_data[3]['booked'],
        'month_4_pct_to_projection': month_data[3]['pct'],
        'total_projected': round(total_proj, 2),
        'total_booked': round(total_booked, 2),
        'total_actual': round(total_actual, 2),
        'total_pct_to_projection': total_pct,
        'pace_status': pace,
        'avg_asking_rate': rate,
        'revpar': revpar,
    }

    result = supabase_request('lc_revenue_projections', row, prefer='return=minimal')
    if result == []:
        rp_inserted += 1
    else:
        rp_errors += 1

    if (i + 1) % 100 == 0:
        print(f"  Progress: {i + 1}/{len(all_props)} ({rp_inserted} inserted, {rp_errors} errors)")

print(f"  Done: {rp_inserted} inserted, {rp_errors} errors")


# ═══════════════════════════════════════════════════════════════════════════════
# Summary
# ═══════════════════════════════════════════════════════════════════════════════
print("\n" + "=" * 60)
print("SEED COMPLETE")
print("=" * 60)
print(f"  Properties processed:      {len(all_props)}")
print(f"  lc_wheelhouse_kpis:        {wh_inserted} rows")
print(f"  lc_health_scores:          {hs_inserted} rows")
print(f"  lc_revenue_projections:    {rp_inserted} rows")
print(f"  Total errors:              {wh_errors + hs_errors + rp_errors}")
print()
print("Next steps:")
print("  1. Run the migration SQL (migration-wheelhouse-tables.sql) in Supabase SQL editor")
print("  2. Then run this seed script: python3 seed-wheelhouse-data.py")
print("  3. The lc_command_grid view will automatically reflect the seeded data")
