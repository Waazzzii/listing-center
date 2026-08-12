#!/usr/bin/env python3
"""
Seed script for lc_agent_actions, lc_exposure_benchmarks, and lc_test_learnings.
Creates realistic agent actions across all action types and statuses.

Usage:
  python3 scripts/seed-agent-actions.py

Requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY env vars.
"""

import os, json, random, sys
from datetime import datetime, timedelta
from urllib.request import Request, urlopen

SUPABASE_URL = os.environ.get("SUPABASE_URL", os.environ.get("NEXT_PUBLIC_SUPABASE_URL", ""))
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")

if not SUPABASE_URL or not SUPABASE_KEY:
    print("ERROR: Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY")
    sys.exit(1)

BASE = SUPABASE_URL.rstrip("/") + "/rest/v1"
HEADERS = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json",
    "Prefer": "return=minimal",
}


def post(table: str, row: dict):
    """Insert a single row."""
    req = Request(f"{BASE}/{table}", data=json.dumps(row).encode(), headers=HEADERS, method="POST")
    try:
        urlopen(req)
    except Exception as e:
        print(f"  ERROR inserting into {table}: {e}")
        return False
    return True


def get(table: str, params: str = "") -> list:
    """Fetch rows from a table."""
    url = f"{BASE}/{table}?{params}" if params else f"{BASE}/{table}"
    req = Request(url, headers={**HEADERS, "Prefer": ""})
    try:
        resp = urlopen(req)
        return json.loads(resp.read())
    except Exception as e:
        print(f"  ERROR reading {table}: {e}")
        return []


# ──────────────────────────────────────────────────────────────────────────────
# Fetch existing properties
# ──────────────────────────────────────────────────────────────────────────────

print("Fetching properties...")
properties = get("lc_properties", "select=id,property_name,market,quality_tier,airbnb_listing_id&is_active=eq.true&limit=200")
if not properties:
    print("No active properties found. Run seed scripts first.")
    sys.exit(1)

print(f"  Found {len(properties)} active properties")

# ──────────────────────────────────────────────────────────────────────────────
# Seed exposure benchmarks
# ──────────────────────────────────────────────────────────────────────────────

print("\nSeeding lc_exposure_benchmarks...")

MARKETS = ["scottsdale", "tucson", "sedona", "coachella", "central_coast", "orange_county", "lake_arrowhead"]
TIERS = ["standard", "silver", "gold", "platinum", "diamond"]
SEASONS = ["peak", "shoulder", "low"]
CHANNELS = ["airbnb", "vrbo", "booking"]

TIER_BASE = {"standard": 1.0, "silver": 1.1, "gold": 1.2, "platinum": 1.3, "diamond": 1.4}
SEASON_MULT = {"peak": 1.3, "shoulder": 1.0, "low": 0.7}

bench_count = 0
for market in MARKETS:
    for tier in TIERS:
        for season in SEASONS:
            for channel in CHANNELS:
                t = TIER_BASE[tier]
                s = SEASON_MULT[season]
                ch = 1.0 if channel == "airbnb" else (0.7 if channel == "vrbo" else 0.5)

                row = {
                    "market": market,
                    "quality_tier": tier,
                    "season": season,
                    "channel": channel,
                    "expected_impression_rate": round(0.35 * t * s * ch, 3),
                    "expected_ctr": round(0.055 * t * ch, 3),
                    "expected_conversion": round(0.025 * t * ch, 3),
                    "impression_rate_floor": round(0.20 * t * s * ch, 3),
                    "ctr_floor": round(0.035 * t * ch, 3),
                    "conversion_floor": round(0.015 * t * ch, 3),
                    "expected_search_rank_pctile": round(0.30 / t, 2),
                    "min_photo_count": 20 if tier in ("standard", "silver") else 25,
                    "min_amenity_count": 25 + TIERS.index(tier) * 5,
                    "min_review_score": 4.3 + TIERS.index(tier) * 0.1,
                    "min_review_count": 3 + TIERS.index(tier) * 2,
                    "min_response_rate": 0.90,
                    "strikethrough_discount_pct": 10,
                    "email_placement_discount_pct": 20,
                    "custom_promotion_min_pct": 10,
                    "expected_revpar": round((100 + TIERS.index(tier) * 50) * s, 0),
                    "expected_occupancy_30d": round(0.60 * s, 2),
                    "expected_adr": round((150 + TIERS.index(tier) * 80) * s, 0),
                    "is_active": True,
                }
                if post("lc_exposure_benchmarks", row):
                    bench_count += 1

    sys.stdout.write(f"\r  {market}: {bench_count} benchmarks")
    sys.stdout.flush()

print(f"\n  Total benchmarks: {bench_count}")


# ──────────────────────────────────────────────────────────────────────────────
# Seed agent actions
# ──────────────────────────────────────────────────────────────────────────────

print("\nSeeding lc_agent_actions...")

ACTION_TEMPLATES = [
    # Pricing actions (Wheelhouse API)
    {
        "agent_name": "pricing_optimizer",
        "action_type": "rate_change",
        "action_category": "pricing",
        "execution_channel": "wheelhouse_api",
        "title_template": "Raise base price from ${old} to ${new}",
        "description_template": "120d occupancy is {occ}% — room to raise base price. Wheelhouse recommends ${rec}.",
        "expected_impact": "Expected +8-12% RevPAR increase with minimal occupancy impact",
    },
    {
        "agent_name": "pricing_optimizer",
        "action_type": "custom_rate_set",
        "action_category": "pricing",
        "execution_channel": "wheelhouse_api",
        "title_template": "Set custom rate ${rate} for event weekend {dates}",
        "description_template": "Major event detected in market. Demand surge expected — setting premium floor.",
        "expected_impact": "Expected 20-40% ADR increase for event dates",
    },
    # Discount actions (Playwright)
    {
        "agent_name": "discount_optimizer",
        "action_type": "discount_set",
        "action_category": "discount",
        "execution_channel": "playwright_airbnb",
        "title_template": "Set {type} discount to {pct}% to trigger strikethrough",
        "description_template": "60-day median is ${median}. At {pct}% off, listing qualifies for strikethrough pricing display — outsized visibility.",
        "expected_impact": "Expected +15-25% impression rate from strikethrough display",
    },
    {
        "agent_name": "discount_optimizer",
        "action_type": "promotion_set",
        "action_category": "discount",
        "execution_channel": "playwright_airbnb",
        "title_template": "Activate 20% custom promotion for email placement",
        "description_template": "Property is pacing behind projection. 20% promotion triggers Airbnb email feature — massive demand boost.",
        "expected_impact": "Expected +30-50% impression rate from email feature placement",
    },
    {
        "agent_name": "discount_optimizer",
        "action_type": "discount_set",
        "action_category": "discount",
        "execution_channel": "playwright_airbnb",
        "title_template": "Set weekly discount to {pct}% for longer stays",
        "description_template": "Longer stays reduce turnover costs by ~$150/turn. Weekly discount incentivizes 7+ night bookings.",
        "expected_impact": "Expected +5% occupancy, reduced turnover costs",
    },
    # Content actions (Playwright)
    {
        "agent_name": "content_optimizer",
        "action_type": "title_update",
        "action_category": "content",
        "execution_channel": "playwright_airbnb",
        "title_template": "Rewrite listing title for better CTR",
        "description_template": "Current title is generic. Proposed: lead with key amenity (pool/view/location) and market name for search ranking.",
        "expected_impact": "Expected +5-15% CTR improvement",
    },
    {
        "agent_name": "content_optimizer",
        "action_type": "description_update",
        "action_category": "content",
        "execution_channel": "playwright_airbnb",
        "title_template": "Update listing description — missing conversion-critical details",
        "description_template": "Description missing: coffee station, sleep quality, workspace, kitchen details. Each missing detail costs ~1% of potential bookers.",
        "expected_impact": "Expected +0.5-2.0% absolute conversion lift",
    },
    {
        "agent_name": "content_optimizer",
        "action_type": "amenity_toggle",
        "action_category": "content",
        "execution_channel": "playwright_airbnb",
        "title_template": "Enable {count} missing amenities",
        "description_template": "Amenity audit found {count} amenities present but not checked on listing. Every amenity improves search ranking.",
        "expected_impact": "Improved search ranking and filtering visibility",
    },
    # Exposure actions (Playwright)
    {
        "agent_name": "exposure_optimizer",
        "action_type": "cancellation_policy_change",
        "action_category": "exposure",
        "execution_channel": "playwright_airbnb",
        "title_template": "Switch to flexible cancellation for shoulder season",
        "description_template": "Cancellation policy is a multiplier on Airbnb True Negative Score. Flexible policy boosts search rank during low-demand periods.",
        "expected_impact": "Expected +5-15% impression rate boost",
    },
    {
        "agent_name": "exposure_optimizer",
        "action_type": "instant_book_toggle",
        "action_category": "exposure",
        "execution_channel": "playwright_airbnb",
        "title_template": "Enable Instant Book for higher search placement",
        "description_template": "Instant Book listings get priority in Airbnb search. Currently disabled.",
        "expected_impact": "Expected +10-20% impression rate, Airbnb search boost",
    },
    {
        "agent_name": "exposure_optimizer",
        "action_type": "min_nights_change",
        "action_category": "exposure",
        "execution_channel": "playwright_vrbo",
        "title_template": "Reduce VRBO min nights from {old} to {new} for gap filling",
        "description_template": "Orphan gaps detected between bookings. Reducing min nights allows gap fills that would otherwise be lost revenue.",
        "expected_impact": "Expected 2-5 additional bookings per quarter",
    },
]

STATUSES = ["proposed", "proposed", "proposed", "approved", "approved", "auto_approved",
            "executing", "completed", "completed", "completed", "completed", "failed", "reverted"]

now = datetime.utcnow()
action_count = 0
sample_properties = random.sample(properties, min(80, len(properties)))

for prop in sample_properties:
    # Each property gets 1-4 actions
    num_actions = random.randint(1, 4)
    templates = random.sample(ACTION_TEMPLATES, min(num_actions, len(ACTION_TEMPLATES)))

    for tmpl in templates:
        status = random.choice(STATUSES)
        confidence = round(random.uniform(30, 95), 1)
        priority = random.choices(["critical", "high", "normal", "low"], weights=[5, 15, 60, 20])[0]

        # Generate realistic payload
        old_price = random.randint(150, 500)
        new_price = old_price + random.randint(10, 50)
        pct = random.choice([10, 15, 20])
        median = old_price + random.randint(-30, 30)

        title = tmpl["title_template"].replace("${old}", str(old_price)).replace("${new}", str(new_price))
        title = title.replace("${rate}", str(new_price)).replace("{dates}", "Apr 18-20")
        title = title.replace("{type}", random.choice(["weekly", "monthly", "early bird"]))
        title = title.replace("{pct}", str(pct)).replace("{count}", str(random.randint(3, 8)))
        title = title.replace("{old}", str(random.randint(3, 5))).replace("{new}", "2")

        desc = tmpl["description_template"].replace("${median}", str(median))
        desc = desc.replace("{occ}", str(random.randint(35, 85))).replace("${rec}", str(new_price))
        desc = desc.replace("{pct}", str(pct)).replace("{count}", str(random.randint(3, 8)))

        created_at = (now - timedelta(days=random.randint(0, 14), hours=random.randint(0, 23))).isoformat() + "Z"

        row = {
            "property_id": prop["id"],
            "agent_name": tmpl["agent_name"],
            "action_type": tmpl["action_type"],
            "action_category": tmpl["action_category"],
            "execution_channel": tmpl["execution_channel"],
            "title": title,
            "description": desc,
            "payload": json.dumps({
                "listing_id": prop.get("airbnb_listing_id") or "unknown",
                "base_price": new_price if "rate" in tmpl["action_type"] else None,
                "percentage": pct if "discount" in tmpl["action_type"] or "promotion" in tmpl["action_type"] else None,
            }),
            "expected_impact": tmpl["expected_impact"],
            "confidence_score": confidence,
            "status": status,
            "priority": priority,
            "requires_approval": confidence < 80,
            "is_revertible": True,
            "auto_revert_if_regression": random.random() > 0.5,
            "created_at": created_at,
            "updated_at": created_at,
        }

        # Add timestamps based on status
        if status in ("approved", "auto_approved", "executing", "completed", "failed", "reverted"):
            row["approved_by"] = random.choice(["jason", "larissa", "system"])
            row["approved_at"] = (datetime.fromisoformat(created_at.rstrip("Z")) + timedelta(hours=random.randint(1, 12))).isoformat() + "Z"

        if status in ("executing", "completed", "failed", "reverted"):
            row["executed_at"] = (datetime.fromisoformat(created_at.rstrip("Z")) + timedelta(hours=random.randint(12, 48))).isoformat() + "Z"

        if status == "completed":
            row["execution_result"] = json.dumps({"success": True, "note": "Executed successfully"})
            due = datetime.fromisoformat(created_at.rstrip("Z")) + timedelta(days=random.randint(7, 21))
            row["measurement_due_at"] = due.isoformat() + "Z"

        if status == "failed":
            row["execution_error"] = random.choice([
                "Playwright session timed out",
                "OTA rate limit exceeded",
                "Element not found on page",
                "Session expired, re-authentication required",
            ])

        if status == "reverted":
            row["reverted_at"] = (datetime.fromisoformat(created_at.rstrip("Z")) + timedelta(days=random.randint(3, 10))).isoformat() + "Z"
            row["revert_reason"] = random.choice([
                "Impression rate dropped 12% after change",
                "Owner requested revert",
                "CTR regression detected",
                "Auto-reverted: metrics below threshold",
            ])

        if post("lc_agent_actions", row):
            action_count += 1

    if action_count % 20 == 0:
        sys.stdout.write(f"\r  {action_count} actions seeded...")
        sys.stdout.flush()

print(f"\r  Total actions: {action_count}          ")


# ──────────────────────────────────────────────────────────────────────────────
# Seed test learnings
# ──────────────────────────────────────────────────────────────────────────────

print("\nSeeding lc_test_learnings...")

LEARNING_TEMPLATES = [
    {"action_type": "rate_change", "action_category": "pricing", "change": "Raised base price 10%", "metric": "revpar", "outcome": "positive", "lift": (5, 15)},
    {"action_type": "rate_change", "action_category": "pricing", "change": "Raised base price 20%", "metric": "revpar", "outcome": "negative", "lift": (-10, -3)},
    {"action_type": "discount_set", "action_category": "discount", "change": "Set 15% custom promotion for strikethrough", "metric": "impression_rate", "outcome": "positive", "lift": (15, 35)},
    {"action_type": "discount_set", "action_category": "discount", "change": "Set 20% promotion for email placement", "metric": "impression_rate", "outcome": "positive", "lift": (25, 60)},
    {"action_type": "discount_set", "action_category": "discount", "change": "Set 10% weekly discount", "metric": "occupancy_30d", "outcome": "positive", "lift": (3, 10)},
    {"action_type": "title_update", "action_category": "content", "change": "Added pool/view to title", "metric": "ctr", "outcome": "positive", "lift": (10, 40)},
    {"action_type": "description_update", "action_category": "content", "change": "Added 8 missing detail sections", "metric": "conversion", "outcome": "positive", "lift": (5, 20)},
    {"action_type": "cancellation_policy_change", "action_category": "exposure", "change": "Switched to flexible policy in shoulder season", "metric": "impression_rate", "outcome": "positive", "lift": (5, 18)},
    {"action_type": "instant_book_toggle", "action_category": "exposure", "change": "Enabled Instant Book", "metric": "impression_rate", "outcome": "positive", "lift": (8, 22)},
    {"action_type": "amenity_toggle", "action_category": "content", "change": "Enabled 5 missing amenities", "metric": "impression_rate", "outcome": "neutral", "lift": (-2, 5)},
]

learning_count = 0
for _ in range(120):
    tmpl = random.choice(LEARNING_TEMPLATES)
    market = random.choice(MARKETS)
    tier = random.choice(TIERS)
    season = random.choice(SEASONS)

    lift = round(random.uniform(*tmpl["lift"]), 1)
    before = round(random.uniform(0.02, 0.50) * 100, 1)
    after = round(before * (1 + lift / 100), 1)

    row = {
        "action_type": tmpl["action_type"],
        "action_category": tmpl["action_category"],
        "market": market,
        "quality_tier": tier,
        "season": season,
        "property_type": random.choice(["house", "condo", "townhouse"]),
        "bedrooms": random.randint(1, 6),
        "change_summary": tmpl["change"],
        "outcome": tmpl["outcome"],
        "primary_metric_name": tmpl["metric"],
        "primary_metric_before": before,
        "primary_metric_after": after,
        "primary_metric_lift_pct": lift,
        "soak_period_days": random.choice([7, 14, 21, 28]),
        "sample_size": random.randint(1, 15),
        "confidence": round(random.uniform(40, 95), 1),
    }

    if post("lc_test_learnings", row):
        learning_count += 1

print(f"  Total learnings: {learning_count}")

print("\nSeed complete!")
print(f"  Benchmarks: {bench_count}")
print(f"  Actions: {action_count}")
print(f"  Learnings: {learning_count}")
