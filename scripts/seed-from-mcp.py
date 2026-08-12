#!/usr/bin/env python3
"""Seed lc_properties from MCP Streamline export file."""
import json
import sys
import urllib.request
import urllib.error

INPUT_FILE = sys.argv[1] if len(sys.argv) > 1 else "/Users/jasonpratts/.claude/projects/-Users-jasonpratts-D2C-Internal-Code/4c05940f-b078-4ddf-80a3-9161c45e9b8d/tool-results/mcp-182489f5-dea7-4ab0-85f7-93ab31c31419-get_property_list-1775569881237.txt"

SUPABASE_URL = "https://kwcwnaibioibwwmlywtt.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt3Y3duYWliaW9pYnd3bWx5d3R0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTU2OTY3NywiZXhwIjoyMDkxMTQ1Njc3fQ.xSk8L4xo_2ETXDL-YRJ1NFmhqond7cpgERVbySy6pJs"

MARKET_MAP = {
    'Phoenix': 'scottsdale',
    'PalmSprings': 'coachella',
    'Coachella': 'coachella',
    'HighDesert': 'coachella',
    'Tucson': 'tucson',
    'Sedona': 'sedona',
    'Flagstaff': 'sedona',
    'PineTop': 'sedona',
    'IdyllwildTemecula': 'central_coast',
}

print(f"Reading {INPUT_FILE}...")
with open(INPUT_FILE) as f:
    data = json.load(f)

text_content = data[0]['text']
parsed = json.loads(text_content)
props = parsed['data']['property']
print(f"Found {len(props)} properties from Streamline")

rows = []
skipped = 0
for p in props:
    area = p.get('location_area_name', '')
    market = MARKET_MAP.get(area)
    if not market:
        print(f"  Skipping unknown area: {area} (unit {p['id']})")
        skipped += 1
        continue
    rows.append({
        'streamline_unit_id': str(p['id']),
        'property_name': p.get('name', f"Unit {p['id']}"),
        'market': market,
        'quality_tier': 'standard',
        'is_active': True,
    })

print(f"Prepared {len(rows)} rows ({skipped} skipped)")

BATCH_SIZE = 100
total_inserted = 0
errors = 0

for i in range(0, len(rows), BATCH_SIZE):
    batch = rows[i:i+BATCH_SIZE]
    body = json.dumps(batch).encode('utf-8')

    req = urllib.request.Request(
        f"{SUPABASE_URL}/rest/v1/lc_properties",
        data=body,
        headers={
            'Content-Type': 'application/json',
            'apikey': SUPABASE_KEY,
            'Authorization': f'Bearer {SUPABASE_KEY}',
            'Prefer': 'resolution=merge-duplicates',
        },
        method='POST'
    )

    try:
        with urllib.request.urlopen(req) as resp:
            total_inserted += len(batch)
            print(f"  {total_inserted}/{len(rows)}...")
    except urllib.error.HTTPError as e:
        error_body = e.read().decode()
        print(f"  ERROR batch {i}: {e.code} — {error_body[:300]}")
        errors += 1

print(f"\nDone! {total_inserted} properties inserted, {errors} errors")
