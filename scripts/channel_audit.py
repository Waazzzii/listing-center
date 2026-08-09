#!/usr/bin/env python3
"""
Listing Health Check — daily audit.

Reads raw payloads (fetched by the daily routine via MCP connections) and produces:

  audit-output/latest.json          — today's full result
  audit-output/history/<date>.json  — one snapshot per day, for deltas
  audit-output/report.html          — the dashboard published as an Artifact

All computation lives here so the routine only does I/O. Deterministic: same
inputs always produce the same output.

Checks performed, by category:

  DISTRIBUTION  Airbnb / VRBO listing IDs present on active+renting units;
                online bookings enabled; branded-site presence confirmed from
                KeyData's canonical site URL (confirm-only — see observe())
  SYSTEMS       Active in KeyData; KeyData tracking units Streamline does not
                rent; present in Wazzi Data; Wheelhouse presence/active/rate
                posting (pending an id mapping — see load_wheelhouse)
  ACCOUNTING    COPS account/bank IDs, scoped to markets that use them;
                merchant / payment gateway (needs --details)
  CLASSIFICATION  Area, neighborhood, location resort, property group present
                and internally consistent (AZ units in AZ groups, etc.)

Every check reports how many units it actually inspected. Absence is only ever
claimed from a source that looks complete — a dropped page or an unresolved id
mapping reports "not checked", never "no problems found".

Usage:
  python3 scripts/channel_audit.py \
      --streamline-group <file> [--streamline-group <file> ...] \
      --nonrenting <file> \
      [--wazzi <file> ...] [--keydata <file> ...] [--wheelhouse <file> ...] \
      [--details <file> ...] [--outdir audit-output] [--date YYYY-MM-DD]

Streamline group payloads must be fetched with show_ota_ids=true, otherwise
every OTA reads as missing.
"""

from __future__ import annotations

import argparse
import collections
import datetime as dt
import html
import json
import os
import re
import sys
from typing import Any

# --------------------------------------------------------------------------
# Channel registry
# --------------------------------------------------------------------------

AZ_AREAS = {"Phoenix", "Tucson", "Sedona", "Flagstaff", "PineTop", "HighDesert"}
CA_AREAS = {"Central Coast", "Orange County", "Lake Arrowhead", "IdyllwildTemecula"}
PS_AREAS = {"PalmSprings", "Coachella"}

CHANNELS: list[dict[str, Any]] = [
    {"code": "airbnb", "name": "Airbnb", "kind": "ota", "observable": True},
    {"code": "vrbo", "name": "VRBO", "kind": "ota", "observable": True},
    {"code": "booking", "name": "Booking.com", "kind": "ota", "observable": False},
    {"code": "acmehouseco", "name": "AcmeHouseCo.com", "kind": "branded_site",
     "observable": False, "host": "acmehouseco.com"},
    {"code": "casago", "name": "Casago.com", "kind": "branded_site",
     "observable": False, "host": "casago.com"},
    {"code": "casago_az", "name": "CasagoArizona.com", "kind": "branded_site",
     "observable": False, "host": "casagoarizona.com"},
    {"code": "casago_socal", "name": "CasagoSoCal.com", "kind": "branded_site",
     "observable": False, "host": "casagosocal.com"},
    {"code": "vacation_palm_springs", "name": "VacationPalmSprings.com", "kind": "branded_site",
     "observable": False, "host": "vacationpalmsprings.com"},
    {"code": "midstays", "name": "Midstays.com", "kind": "branded_site",
     "observable": False, "host": "midstays.com"},
    {"code": "vacasa", "name": "Vacasa.com", "kind": "niche_ota", "observable": False},
    {"code": "hopper", "name": "Hopper.com", "kind": "niche_ota", "observable": False},
    {"code": "crewdogs", "name": "Crewdogs.com", "kind": "niche_ota", "observable": False},
    {"code": "wander", "name": "Wander.com", "kind": "niche_ota", "observable": False},
    {"code": "whimstay", "name": "Whimstay.com", "kind": "niche_ota", "observable": False},
]

NICHE_DEFAULT_OFF = {"vacasa", "hopper", "crewdogs", "wander", "whimstay", "midstays"}

# Property-group prefix → the state its units should sit in. Used to catch a
# unit filed under the wrong regional group, which misroutes both distribution
# and accounting.
GROUP_STATE_PREFIX = {"AZ-": "AZ", "CA-": "CA"}

# Units that are not rentals at all. They should never be active in a system
# that meters or reports on rental performance.
ADMIN_UNIT_PATTERN = re.compile(
    r"office|test|reservation group|warehouse|storage|admin|do not|dnu|training",
    re.IGNORECASE,
)

# Issue catalogue: code → (category, label, severity, why it matters)
ISSUES: dict[str, tuple[str, str, str, str]] = {
    "missing_airbnb": ("distribution", "No Airbnb listing ID", "high",
                       "Unit is renting but carries no Airbnb ID in Streamline."),
    "missing_vrbo": ("distribution", "No VRBO listing ID", "high",
                     "Unit is renting but carries no VRBO ID in Streamline."),
    "dark_all_otas": ("distribution", "Dark on every verified OTA", "high",
                      "Neither Airbnb nor VRBO — the unit is invisible on both majors."),
    "online_bookings_off": ("distribution", "Online bookings disabled", "high",
                            "Streamline will not accept an online booking for this unit."),
    "not_in_wheelhouse": ("systems", "Not in Wheelhouse", "high",
                          "No Wheelhouse listing — the unit is not being revenue-managed."),
    "wheelhouse_inactive": ("systems", "Wheelhouse listing inactive", "high",
                            "Present in Wheelhouse but flagged inactive."),
    "wheelhouse_posting_off": ("systems", "Wheelhouse rate posting off", "medium",
                               "In Wheelhouse, but automatic rate posting is disabled, so "
                               "recommended prices never reach the unit."),
    "not_active_in_keydata": ("systems", "Not active in KeyData", "high",
                              "Renting in Streamline but not in KeyData's active set — "
                              "performance for this unit is not being tracked."),
    "keydata_active_orphan": ("systems", "Active in KeyData, not renting in Streamline", "medium",
                              "KeyData is tracking a unit Streamline does not list as "
                              "active and renting."),
    "not_in_wazzi": ("systems", "Missing from Wazzi Data", "medium",
                     "In Streamline but absent from Wazzi Data."),
    "orphan_in_wazzi": ("systems", "In Wazzi Data, not in Streamline", "medium",
                        "Wazzi Data carries a unit Streamline no longer returns."),
    "missing_accounting_ids": ("accounting", "No COPS account/bank ID", "medium",
                               "Unit sits in a market that uses COPS account/bank IDs but "
                               "has none. Only applied where the field is in use — it is "
                               "currently a Palm Springs convention, not portfolio-wide."),
    "missing_merchant": ("accounting", "No merchant / payment gateway", "high",
                         "No credit-card gateway on the unit — revenue has no confirmed "
                         "destination account."),
    "missing_area": ("classification", "No area assigned", "high",
                     "Without an area the unit cannot be routed to a brand site or region."),
    "missing_neighborhood": ("classification", "No neighborhood assigned", "low",
                             "Neighborhood drives site placement and search."),
    "missing_resort": ("classification", "No location resort assigned", "low",
                       "Location resort drives grouping on the branded sites."),
    "missing_property_group": ("classification", "No property group assigned", "medium",
                               "Property group drives reporting and accounting rollups."),
    "group_state_mismatch": ("classification", "Property group / state mismatch", "high",
                             "Unit sits in a regional group belonging to another state — "
                             "misroutes reporting and accounting."),
}

CATEGORY_LABELS = {
    "distribution": "Distribution",
    "systems": "Systems",
    "accounting": "Accounting",
    "classification": "Classification",
}


def expected_channels(unit: dict[str, Any]) -> set[str]:
    """Channels an active+renting unit is expected to be live on."""
    area = unit.get("location_area_name")
    expected = {"airbnb", "vrbo", "booking", "acmehouseco", "casago"}
    if area in AZ_AREAS:
        expected.add("casago_az")
    elif area in PS_AREAS:
        expected.update({"casago_socal", "vacation_palm_springs"})
    elif area in CA_AREAS:
        expected.add("casago_socal")
    return expected


CHANNEL_BY_CODE = {c["code"]: c for c in CHANNELS}


def observe(unit: dict[str, Any], channel_code: str, site_url: str = "") -> str:
    """Return 'live' | 'not_live' | 'unknown' for a unit on a channel.

    Airbnb/VRBO are authoritative: Streamline either holds a listing id or it
    does not, so absence is a real gap.

    Branded sites are confirm-only. KeyData stores ONE canonical site URL per
    unit, so a casago.com URL proves the unit is on Casago.com but says nothing
    about CasagoSoCal. A non-match therefore yields 'unknown', never 'not_live'
    — otherwise every unit would appear missing from five sites at once.
    """
    if channel_code in ("airbnb", "vrbo"):
        ota = unit.get("ota_listing_ids") or {}
        value = ota.get(channel_code)
        return "live" if value and str(value).strip() else "not_live"

    host = CHANNEL_BY_CODE.get(channel_code, {}).get("host")
    if host and site_url and host in site_url.lower():
        return "live"
    return "unknown"


def blank(value: Any) -> bool:
    return value is None or str(value).strip() == ""


# --------------------------------------------------------------------------
# Payload loading
# --------------------------------------------------------------------------


def load_json(path: str) -> Any:
    with open(path, encoding="utf-8") as handle:
        return json.load(handle)


def load_streamline_units(paths: list[str]) -> list[dict[str, Any]]:
    """Load and de-duplicate units across one or more GetPropertyList payloads."""
    by_id: dict[str, dict[str, Any]] = {}
    for path in paths:
        payload = load_json(path)
        data = payload.get("data", payload)
        units = data.get("property", data if isinstance(data, list) else [])
        if isinstance(units, dict):
            units = [units]
        for unit in units:
            unit_id = str(unit.get("id"))
            if unit_id in by_id:
                # MERGE, never replace. Payload shapes differ by fetch params —
                # a detailed payload fetched without show_ota_ids must not erase
                # OTA IDs supplied by an earlier one, or those units read as dark.
                by_id[unit_id].update(unit)
            else:
                by_id[unit_id] = dict(unit)
    if not by_id:
        raise SystemExit(f"No units found in: {', '.join(paths)}")
    return list(by_id.values())


def load_wazzi(paths: list[str]) -> dict[str, dict[str, Any]]:
    """unit_id → Wazzi row, across paginated list_properties payloads."""
    rows: dict[str, dict[str, Any]] = {}
    for path in paths:
        payload = load_json(path)
        items = payload.get("properties", payload if isinstance(payload, list) else [])
        for item in items:
            rows[str(item.get("unit_id"))] = item
    return rows


def load_keydata(paths: list[str]) -> dict[str, dict[str, Any]]:
    """Streamline unit_id → KeyData record.

    KeyData tracks properties from several sources; only rows with
    source == 'STREAMLN' carry a source_id that is a Streamline unit id.
    Rows from other sources (e.g. GOOGLE) are counted but not joined.
    """
    rows: dict[str, dict[str, Any]] = {}
    for path in paths:
        payload = load_json(path)
        items = payload.get("data", payload if isinstance(payload, list) else [])
        for item in items:
            if item.get("source") != "STREAMLN":
                continue
            source_id = str(item.get("source_id") or "").strip()
            if source_id:
                rows[source_id] = item
    return rows


def keydata_site_url(record: dict[str, Any]) -> str:
    """The branded-site URL KeyData holds for a unit, if any."""
    for entry in record.get("listing_urls") or []:
        if entry.get("url_type") == "URL" and (entry.get("url") or "").strip():
            return entry["url"].strip()
    return ""


def load_wheelhouse(paths: list[str]) -> dict[str, dict[str, Any]]:
    """Streamline unit_id → Wheelhouse listing, across paginated payloads."""
    rows: dict[str, dict[str, Any]] = {}
    for path in paths:
        payload = load_json(path)
        items = payload if isinstance(payload, list) else payload.get("listings", [])
        for item in items:
            rows[str(item.get("id"))] = item
    return rows


def area_of(unit: dict[str, Any]) -> str:
    return unit.get("location_area_name") or "(unassigned)"


# --------------------------------------------------------------------------
# Audit
# --------------------------------------------------------------------------


def build_audit(
    renting: list[dict[str, Any]],
    nonrenting: list[dict[str, Any]],
    wazzi: dict[str, dict[str, Any]],
    wheelhouse: dict[str, dict[str, Any]],
    keydata: dict[str, dict[str, Any]],
    details: dict[str, dict[str, Any]],
    run_date: str,
) -> dict[str, Any]:
    have_wazzi = bool(wazzi)
    have_wheelhouse = bool(wheelhouse)
    have_keydata = bool(keydata)
    detailed_units: set[str] = set()
    merchant_units: set[str] = set()

    # A source is only trusted for absence-claims when it looks complete.
    # Below the threshold we still report what we saw, but never assert that
    # an unseen unit is missing.
    COMPLETE_AT = 0.95
    # Wheelhouse's listing `id` is not always the Streamline unit id. If nothing
    # joins, the identifier mapping is unresolved — report that plainly rather
    # than reporting zero problems, which would read as a clean bill of health.
    wheelhouse_matched = sum(1 for u in renting if str(u.get("id")) in wheelhouse)
    wheelhouse_usable = have_wheelhouse and wheelhouse_matched > 0
    wheelhouse_complete = wheelhouse_usable and len(wheelhouse) >= COMPLETE_AT * len(renting)
    wazzi_matched = sum(1 for u in renting if str(u.get("id")) in wazzi)
    wazzi_complete = have_wazzi and len(wazzi) >= COMPLETE_AT * len(renting)
    keydata_matched = sum(1 for u in renting if str(u.get("id")) in keydata)
    keydata_usable = have_keydata and keydata_matched > 0
    keydata_complete = keydata_usable and len(keydata) >= COMPLETE_AT * len(renting)

    # Which areas actually use COPS account/bank IDs? Derived from the data
    # rather than hardcoded, so the check follows the convention as it spreads.
    cops_areas: set[str] = set()
    if have_wazzi:
        area_by_unit = {str(u.get("id")): area_of(u) for u in renting}
        for unit_id, row in wazzi.items():
            fields = row.get("custom_fields") or {}
            if not blank(fields.get("cops_aid")) or not blank(fields.get("cops_bid")):
                area = area_by_unit.get(unit_id) or row.get("location_area")
                if area:
                    cops_areas.add(area)

    census_by_area: dict[str, dict[str, int]] = collections.defaultdict(
        lambda: {"renting": 0, "non_renting": 0}
    )
    for unit in renting:
        census_by_area[area_of(unit)]["renting"] += 1
    for unit in nonrenting:
        census_by_area[area_of(unit)]["non_renting"] += 1

    coverage = {
        c["code"]: {
            "code": c["code"], "name": c["name"], "kind": c["kind"],
            "observable": c["observable"],
            "expected": 0, "live": 0, "missing": 0, "unknown": 0,
        }
        for c in CHANNELS
    }

    issues: list[dict[str, Any]] = []

    def flag(unit: dict[str, Any], code: str, detail: str = "") -> None:
        category, label, severity, _ = ISSUES[code]
        issues.append({
            "unit_id": str(unit.get("id")),
            "name": unit.get("name") or "(unnamed)",
            "area": area_of(unit),
            "property_group": unit.get("condo_type_group_name"),
            "issue": code,
            "category": category,
            "label": label,
            "severity": severity,
            "detail": detail,
        })

    for unit in renting:
        unit_id = str(unit.get("id"))
        kd = keydata.get(unit_id)
        site_url = keydata_site_url(kd) if kd else ""

        # --- distribution ---
        for code in expected_channels(unit):
            row = coverage[code]
            row["expected"] += 1
            state = observe(unit, code, site_url)
            if state == "live":
                row["live"] += 1
            elif state == "not_live":
                row["missing"] += 1
            else:
                row["unknown"] += 1

        ab = observe(unit, "airbnb") == "live"
        vr = observe(unit, "vrbo") == "live"
        if not ab:
            flag(unit, "missing_airbnb")
        if not vr:
            flag(unit, "missing_vrbo")
        if not ab and not vr:
            flag(unit, "dark_all_otas")
        if unit.get("online_bookings") == 0:
            flag(unit, "online_bookings_off")

        # --- systems ---
        if wheelhouse_usable:
            listing = wheelhouse.get(unit_id)
            if listing is None:
                # Only claim a unit is absent from Wheelhouse when we are
                # confident we fetched the whole listing set. A dropped page
                # must never masquerade as hundreds of missing units.
                if wheelhouse_complete:
                    flag(unit, "not_in_wheelhouse")
            else:
                if listing.get("is_active") is False:
                    flag(unit, "wheelhouse_inactive")
                prefs = listing.get("listing_preferences") or {}
                if prefs.get("automatic_rate_posting_enabled") is False:
                    flag(unit, "wheelhouse_posting_off")
        if wazzi_complete and unit_id not in wazzi:
            flag(unit, "not_in_wazzi")
        if keydata_complete and kd is None:
            flag(unit, "not_active_in_keydata")

        # --- accounting ---
        # Only assert a missing COPS ID in markets that actually use them.
        # Applying it portfolio-wide would flag ~1,069 units that were never
        # meant to carry the field.
        if have_wazzi and area_of(unit) in cops_areas:
            row = wazzi.get(unit_id)
            if row is not None:
                fields = row.get("custom_fields") or {}
                if blank(fields.get("cops_aid")) and blank(fields.get("cops_bid")):
                    flag(unit, "missing_accounting_ids")

        # --- classification ---
        # Area comes back on every payload shape, so it is always checkable.
        if blank(unit.get("location_area_name")):
            flag(unit, "missing_area")

        # Neighborhood / resort / property group only exist on the detailed
        # payload. Absent that, we must not flag — a missing FIELD is not a
        # missing VALUE, and treating it as one would flag the whole portfolio.
        detail = details.get(unit_id) or ({} if "condo_type_group_name" not in unit else unit)
        if detail:
            detailed_units.add(unit_id)
            if blank(detail.get("neighborhood_name")):
                flag(unit, "missing_neighborhood")
            if blank(detail.get("location_resort_name")):
                flag(unit, "missing_resort")
            group_name = detail.get("condo_type_group_name")
            if (blank(group_name) or group_name == "Default"
                    or blank(detail.get("property_group_id"))):
                flag(unit, "missing_property_group",
                     f"group={group_name or 'none'} id={detail.get('property_group_id') or 'none'}")
            elif unit.get("state_name") or detail.get("state_name"):
                state_name = unit.get("state_name") or detail.get("state_name")
                for prefix, state in GROUP_STATE_PREFIX.items():
                    if str(group_name).startswith(prefix) and state_name != state:
                        flag(unit, "group_state_mismatch",
                             f"group={group_name} but state={state_name}")

            # --- merchant (same detailed payload) ---
            if "cc_payment_gateway_info" in detail:
                merchant_units.add(unit_id)
                gateway = detail.get("cc_payment_gateway_info") or {}
                if blank(gateway.get("name")) and blank(gateway.get("settings_name")):
                    flag(unit, "missing_merchant")

    # Units KeyData lists as active that Streamline does not have as active+renting.
    if keydata_usable:
        renting_ids = {str(u.get("id")) for u in renting}
        nonrenting_ids = {str(u.get("id")) for u in nonrenting}
        for unit_id, row in keydata.items():
            if unit_id not in renting_ids:
                category, label, severity, _ = ISSUES["keydata_active_orphan"]
                kd_name = row.get("property_alias") or row.get("name") or ""
                if ADMIN_UNIT_PATTERN.search(kd_name):
                    reason = "admin/test unit — deactivate in KeyData"
                elif unit_id in nonrenting_ids:
                    reason = "non-renting in Streamline"
                else:
                    reason = "absent from Streamline entirely"
                issues.append({
                    "unit_id": unit_id,
                    "name": row.get("property_alias") or row.get("name") or "(unnamed)",
                    "area": row.get("source_complex") or "(unassigned)",
                    "property_group": None,
                    "issue": "keydata_active_orphan",
                    "category": category, "label": label, "severity": severity,
                    "detail": reason,
                })

    # Units Wazzi knows about that Streamline no longer returns.
    if wazzi_complete:
        streamline_ids = {str(u.get("id")) for u in renting} | {
            str(u.get("id")) for u in nonrenting
        }
        for unit_id, row in wazzi.items():
            if unit_id not in streamline_ids:
                category, label, severity, _ = ISSUES["orphan_in_wazzi"]
                issues.append({
                    "unit_id": unit_id,
                    "name": row.get("unit_name") or "(unnamed)",
                    "area": row.get("location_area") or "(unassigned)",
                    "property_group": None,
                    "issue": "orphan_in_wazzi",
                    "category": category, "label": label, "severity": severity,
                    "detail": "",
                })

    for row in coverage.values():
        row["coverage_pct"] = (
            round(row["live"] / row["expected"] * 100, 1) if row["expected"] else None
        )

    by_issue = collections.Counter(i["issue"] for i in issues)
    total_renting_units = len(renting)
    scope = {
        "classification_detail": len(detailed_units),
        "merchant": len(merchant_units),
        "wazzi": len(wazzi) if have_wazzi else 0,
        "wheelhouse": len(wheelhouse) if have_wheelhouse else 0,
        # Units we could actually inspect, not units that exist. These drive the
        # "checked N of M" column, which must never overstate what was examined.
        "wheelhouse_matched": wheelhouse_matched,
        "keydata": len(keydata) if have_keydata else 0,
        "keydata_matched": keydata_matched,
        "wazzi_matched": wazzi_matched,
        "cops_scope": sum(1 for u in renting if area_of(u) in cops_areas),
        "total_renting": total_renting_units,
    }
    summary = [
        {
            "issue": code,
            "label": ISSUES[code][1],
            "category": ISSUES[code][0],
            "severity": ISSUES[code][2],
            "why": ISSUES[code][3],
            "count": by_issue.get(code, 0),
            "checked": _covered(code, wazzi_complete, wheelhouse_complete, keydata_complete,
                                have_wazzi, wheelhouse_usable, keydata_usable,
                                detailed_units, merchant_units),
            "coverage": _coverage(code, scope),
        }
        for code in ISSUES
    ]

    total_renting, total_nonrenting = len(renting), len(nonrenting)
    return {
        "run_date": run_date,
        "generated_at": dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds"),
        "sources": {
            "streamline": True,
            "wazzi": have_wazzi,
            "wheelhouse": have_wheelhouse,
            "keydata": have_keydata,
            "wheelhouse id mapping": wheelhouse_usable,
            "unit detail": bool(detailed_units),
            "merchant": bool(merchant_units),
        },
        "scope": scope,
        "census": {
            "active_renting": total_renting,
            "non_renting": total_nonrenting,
            "total": total_renting + total_nonrenting,
            "wazzi_total": len(wazzi) if have_wazzi else None,
            "wheelhouse_total": len(wheelhouse) if have_wheelhouse else None,
            "keydata_total": len(keydata) if have_keydata else None,
            "by_area": dict(
                sorted(census_by_area.items(), key=lambda kv: -kv[1]["renting"])
            ),
        },
        "coverage": list(coverage.values()),
        "issue_summary": summary,
        "issues": sorted(issues, key=lambda i: (i["category"], i["issue"], i["area"], i["name"])),
        "channels_observable": [c["code"] for c in CHANNELS if c["observable"]],
        "niche_default_off": sorted(NICHE_DEFAULT_OFF),
    }


WHEELHOUSE_CHECKS = {"not_in_wheelhouse", "wheelhouse_inactive", "wheelhouse_posting_off"}
WAZZI_CHECKS = {"not_in_wazzi", "orphan_in_wazzi", "missing_accounting_ids"}
DETAIL_CHECKS = {"missing_neighborhood", "missing_resort", "missing_property_group",
                 "group_state_mismatch"}


KEYDATA_CHECKS = {"not_active_in_keydata", "keydata_active_orphan"}


def _covered(code: str, wazzi_complete: bool, wheelhouse_complete: bool,
             keydata_complete: bool, have_wazzi: bool, have_wheelhouse: bool,
             have_keydata: bool, detailed: set[str], merchant: set[str]) -> bool:
    if code in KEYDATA_CHECKS:
        return keydata_complete
    # Absence-claims require a complete source; presence-claims only require data.
    if code == "not_in_wheelhouse":
        return wheelhouse_complete
    if code in ("not_in_wazzi", "orphan_in_wazzi"):
        return wazzi_complete
    if code in WHEELHOUSE_CHECKS:
        return have_wheelhouse
    if code in WAZZI_CHECKS:
        return have_wazzi
    if code in DETAIL_CHECKS:
        return bool(detailed)
    if code == "missing_merchant":
        return bool(merchant)
    return True


def _coverage(code: str, scope: dict[str, int]) -> str:
    """How much of the renting portfolio this check actually inspected."""
    total = scope["total_renting"]
    if code in DETAIL_CHECKS:
        n = scope["classification_detail"]
    elif code == "missing_merchant":
        n = scope["merchant"]
    elif code == "missing_accounting_ids":
        n = scope["cops_scope"]
    elif code == "not_in_wheelhouse":
        n = total if scope["wheelhouse"] else 0
    elif code in WHEELHOUSE_CHECKS:
        n = scope["wheelhouse_matched"]
    elif code in ("not_in_wazzi", "orphan_in_wazzi"):
        n = total if scope["wazzi"] else 0
    elif code in ("not_active_in_keydata", "keydata_active_orphan"):
        n = total if scope["keydata"] else 0
    elif code in WAZZI_CHECKS:
        n = scope["wazzi_matched"]
    else:
        n = total
    return f"{n:,} of {total:,}"


def compute_deltas(current: dict[str, Any], prior: dict[str, Any] | None) -> dict[str, Any]:
    if not prior:
        return {"prior_date": None, "census": {}, "opened": [], "closed": [], "by_issue": {}}

    def key(issue: dict[str, Any]) -> str:
        return f"{issue['unit_id']}::{issue['issue']}"

    now = {key(i): i for i in current["issues"]}
    was = {key(i): i for i in prior.get("issues", [])}

    prior_counts = {s["issue"]: s["count"] for s in prior.get("issue_summary", [])}
    by_issue = {
        s["issue"]: s["count"] - prior_counts.get(s["issue"], 0)
        for s in current["issue_summary"]
        if s["issue"] in prior_counts
    }

    prior_census = prior.get("census", {})
    return {
        "prior_date": prior.get("run_date"),
        "census": {
            "active_renting": current["census"]["active_renting"] - prior_census.get("active_renting", 0),
            "non_renting": current["census"]["non_renting"] - prior_census.get("non_renting", 0),
        },
        "opened": [i for k, i in now.items() if k not in was],
        "closed": [i for k, i in was.items() if k not in now],
        "by_issue": by_issue,
    }


def load_prior(history_dir: str, run_date: str) -> dict[str, Any] | None:
    if not os.path.isdir(history_dir):
        return None
    dates = sorted(
        f[:-5] for f in os.listdir(history_dir) if f.endswith(".json") and f[:-5] < run_date
    )
    if not dates:
        return None
    return load_json(os.path.join(history_dir, f"{dates[-1]}.json"))


# --------------------------------------------------------------------------
# HTML report
# --------------------------------------------------------------------------


OFF_CELL = '<span class="d-flat">off</span>'
DASH_CELL = '<span class="d-flat">&mdash;</span>'


def esc(value: Any) -> str:
    return html.escape(str(value if value is not None else ""))


def delta_badge(value: int | None, invert: bool = False) -> str:
    if value is None or value == 0:
        return '<span class="d-flat">&mdash;</span>'
    good = (value < 0) if invert else (value > 0)
    return f'<span class="{"d-good" if good else "d-bad"}">{value:+d}</span>'


def render_html(audit: dict[str, Any], deltas: dict[str, Any]) -> str:
    census = audit["census"]
    cd = deltas.get("census", {})
    issue_delta = deltas.get("by_issue", {})
    high_open = sum(1 for i in audit["issues"] if i["severity"] == "high")

    coverage_rows = []
    for row in audit["coverage"]:
        if row["observable"]:
            pct = row["coverage_pct"]
            bar = "bar-good" if pct is not None and pct >= 99 else "bar-warn"
            cov = (f'<div class="bar"><span class="{bar}" style="width:{pct}%"></span></div>'
                   f'<span class="pct">{pct}%</span>')
            missing = (f'<strong class="{"num-bad" if row["missing"] else "num-ok"}">'
                       f'{row["missing"]}</strong>')
            live = str(row["live"])
        else:
            cov = '<span class="unverified">not verified yet</span>'
            missing = live = '<span class="d-flat">&mdash;</span>'
        expected_cell = str(row["expected"]) if row["expected"] else OFF_CELL
        coverage_rows.append(
            f'      <tr><td class="ch"><span class="dot dot-{esc(row["kind"])}"></span>'
            f'{esc(row["name"])}</td>'
            f'<td class="num">{expected_cell}</td>'
            f'<td class="num">{live}</td><td class="num">{missing}</td>'
            f'<td class="cov">{cov}</td></tr>'
        )

    check_rows = []
    for group in ("distribution", "systems", "accounting", "classification"):
        rows = [s for s in audit["issue_summary"] if s["category"] == group]
        check_rows.append(
            f'      <tr class="grouprow"><td colspan="5">{esc(CATEGORY_LABELS[group])}</td></tr>'
        )
        for s in rows:
            if not s["checked"]:
                count_cell = '<span class="unverified">not yet checked</span>'
                cov_cell = '<span class="unverified">needs API credentials</span>'
            else:
                cov_cell = f'<span class="pct">{esc(s["coverage"])}</span>'
                if s["count"]:
                    count_cell = (f'<strong class="num-bad">{s["count"]}</strong> '
                                  f'{delta_badge(issue_delta.get(s["issue"]), invert=True)}')
                else:
                    count_cell = (f'<span class="num-ok">0</span> '
                                  f'{delta_badge(issue_delta.get(s["issue"]), invert=True)}')
            check_rows.append(
                f'      <tr><td class="ch">{esc(s["label"])}</td>'
                f'<td><span class="sev sev-{esc(s["severity"])}">{esc(s["severity"])}</span></td>'
                f'<td class="num">{count_cell}</td>'
                f'<td class="num">{cov_cell}</td>'
                f'<td class="why">{esc(s["why"])}</td></tr>'
            )

    def issue_table(codes: list[str], limit: int = 60) -> str:
        rows = [i for i in audit["issues"] if i["issue"] in codes]
        if not rows:
            return '      <tr><td colspan="5" class="empty">Nothing flagged.</td></tr>'
        out = "".join(
            f'      <tr><td>{esc(i["name"])}</td><td>{esc(i["area"])}</td>'
            f'<td>{esc(i["property_group"] or "&mdash;")}</td>'
            f'<td><span class="tag">{esc(i["label"])}</span></td>'
            f'<td class="mono">{esc(i["unit_id"])}</td></tr>'
            for i in rows[:limit]
        )
        if len(rows) > limit:
            out += (f'      <tr><td colspan="5" class="empty">&hellip; and {len(rows) - limit} '
                    f'more in latest.json</td></tr>')
        return out

    dark_rows = issue_table(["dark_all_otas"])
    money_rows = issue_table(
        ["missing_accounting_ids", "not_in_wheelhouse", "wheelhouse_inactive",
         "wheelhouse_posting_off"]
    )
    systems_rows = issue_table(
        ["not_active_in_keydata", "keydata_active_orphan", "not_in_wazzi", "orphan_in_wazzi",
         "not_in_wheelhouse", "wheelhouse_inactive", "wheelhouse_posting_off"], limit=120
    )
    class_rows = issue_table(
        ["missing_area", "missing_property_group", "group_state_mismatch",
         "missing_neighborhood", "missing_resort"]
    )

    census_rows = "".join(
        f'      <tr><td>{esc(area)}</td><td class="num">{c["renting"]}</td>'
        f'<td class="num">{c["non_renting"]}</td>'
        f'<td class="num">{c["renting"] + c["non_renting"]}</td></tr>'
        for area, c in census["by_area"].items()
    )

    opened, closed = len(deltas.get("opened", [])), len(deltas.get("closed", []))
    prior_note = (f'vs. {esc(deltas["prior_date"])}' if deltas.get("prior_date")
                  else "first run &mdash; no prior day to compare")

    def change_list(items: list[dict[str, Any]]) -> str:
        return "".join(
            f'<li><strong>{esc(i["name"])}</strong> &mdash; {esc(i["label"])} '
            f'<span class="muted">({esc(i["area"])})</span></li>'
            for i in items[:20]
        ) or '<li class="muted">None</li>'

    src = audit["sources"]
    src_bits = ", ".join(
        f'{name} <span class="{"ok" if ok else "off"}">{"connected" if ok else "not connected"}</span>'
        for name, ok in (("Streamline", src["streamline"]), ("Wazzi Data", src["wazzi"]),
                         ("Wheelhouse", src["wheelhouse"]), ("Merchant / gateway", src["merchant"]))
    )

    reconciliation = ""
    if census.get("wazzi_total") is not None:
        diff = census["wazzi_total"] - census["total"]
        reconciliation = (
            f'Streamline <strong>{census["total"]:,}</strong> units &middot; '
            f'Wazzi Data <strong>{census["wazzi_total"]:,}</strong>'
            + (f' &middot; <strong class="num-bad">{diff:+d} discrepancy</strong>' if diff else
               ' &middot; <strong>reconciled</strong>')
        )
        if census.get("wheelhouse_total") is not None:
            reconciliation += f' &middot; Wheelhouse <strong>{census["wheelhouse_total"]:,}</strong>'

    return f"""<title>Listing Health Check — {esc(audit['run_date'])}</title>
<style>
  :root {{
    --paper: #f6f7f8; --panel: #ffffff; --ink: #14181b; --muted: #616a72;
    --line: #dfe3e6; --line-soft: #eaedef;
    --accent: #0f766e; --good: #15803d; --warn: #a16207; --bad: #b42318;
    --rail: #b42318;
  }}
  @media (prefers-color-scheme: dark) {{
    :root {{
      --paper: #101316; --panel: #171b1f; --ink: #e6e9ec; --muted: #8d969e;
      --line: #262c31; --line-soft: #1e2429;
      --accent: #2dd4bf; --good: #4ade80; --warn: #e0b341; --bad: #f2837b;
      --rail: #f2837b;
    }}
  }}
  :root[data-theme="dark"] {{
    --paper: #101316; --panel: #171b1f; --ink: #e6e9ec; --muted: #8d969e;
    --line: #262c31; --line-soft: #1e2429;
    --accent: #2dd4bf; --good: #4ade80; --warn: #e0b341; --bad: #f2837b;
    --rail: #f2837b;
  }}
  :root[data-theme="light"] {{
    --paper: #f6f7f8; --panel: #ffffff; --ink: #14181b; --muted: #616a72;
    --line: #dfe3e6; --line-soft: #eaedef;
    --accent: #0f766e; --good: #15803d; --warn: #a16207; --bad: #b42318;
    --rail: #b42318;
  }}
  * {{ box-sizing: border-box; }}
  body {{
    margin: 0; background: var(--paper); color: var(--ink);
    font: 15px/1.55 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto,
          ui-sans-serif, sans-serif;
    -webkit-font-smoothing: antialiased;
  }}
  .wrap {{ max-width: 1140px; margin: 0 auto; padding: 44px 24px 84px; }}
  .mast {{ display: flex; align-items: baseline; justify-content: space-between;
           flex-wrap: wrap; gap: 8px; padding-bottom: 16px;
           border-bottom: 2px solid var(--ink); }}
  h1 {{ font-size: 25px; font-weight: 680; letter-spacing: -0.025em; margin: 0;
        text-wrap: balance; }}
  .stamp {{ font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
            font-size: 12px; color: var(--muted); font-variant-numeric: tabular-nums; }}
  .sources {{ font-size: 12px; color: var(--muted); padding: 10px 0 0; }}
  .sources .ok {{ color: var(--good); }}
  .sources .off {{ color: var(--muted); }}
  .strip {{ display: grid; grid-template-columns: repeat(auto-fit, minmax(146px, 1fr));
            background: var(--panel); border: 1px solid var(--line); margin: 20px 0 10px; }}
  .cell {{ padding: 16px 18px; border-right: 1px solid var(--line-soft); }}
  .cell:last-child {{ border-right: none; }}
  .cell .n {{ font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
              font-size: 27px; font-weight: 600; letter-spacing: -0.03em;
              font-variant-numeric: tabular-nums; display: flex; align-items: baseline; gap: 7px; }}
  .cell .l {{ font-size: 10.5px; text-transform: uppercase; letter-spacing: 0.09em;
              color: var(--muted); margin-top: 5px; font-weight: 600; }}
  .cell.alert {{ box-shadow: inset 3px 0 0 var(--rail); }}
  .cell.alert .n {{ color: var(--bad); }}
  .recon {{ font-size: 13px; color: var(--muted); margin: 0 0 4px; }}
  h2 {{ font-size: 11px; text-transform: uppercase; letter-spacing: 0.11em;
        color: var(--muted); margin: 38px 0 12px; font-weight: 700; }}
  h2 .count {{ font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
               color: var(--ink); letter-spacing: 0; margin-left: 6px; }}
  table {{ width: 100%; border-collapse: collapse; font-size: 13.5px; }}
  .scroll {{ overflow-x: auto; background: var(--panel); border: 1px solid var(--line); }}
  th {{ text-align: left; font-size: 10.5px; text-transform: uppercase;
        letter-spacing: 0.07em; color: var(--muted); font-weight: 700;
        padding: 10px 14px; border-bottom: 1px solid var(--line); white-space: nowrap; }}
  td {{ padding: 9px 14px; border-bottom: 1px solid var(--line-soft); vertical-align: middle; }}
  tbody tr:last-child td {{ border-bottom: none; }}
  .grouprow td {{ background: var(--paper); font-size: 10.5px; font-weight: 700;
                  text-transform: uppercase; letter-spacing: 0.09em; color: var(--muted);
                  padding: 8px 14px; }}
  .num {{ text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap;
          font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }}
  .mono {{ font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
           font-size: 12px; color: var(--muted); }}
  .ch {{ font-weight: 560; white-space: nowrap; }}
  .why {{ color: var(--muted); font-size: 12.5px; }}
  .dot {{ display: inline-block; width: 6px; height: 6px; border-radius: 50%;
          margin-right: 10px; vertical-align: middle; }}
  .dot-ota {{ background: var(--accent); }}
  .dot-branded_site {{ background: var(--muted); }}
  .dot-niche_ota {{ background: var(--line); box-shadow: inset 0 0 0 1px var(--muted); }}
  #dark tbody tr td:first-child, #money tbody tr td:first-child,
  #systems tbody tr td:first-child, #classify tbody tr td:first-child {{ box-shadow: inset 3px 0 0 var(--rail); }}
  #dark tbody tr td.empty, #money tbody tr td.empty,
  #systems tbody tr td.empty, #classify tbody tr td.empty {{ box-shadow: none; }}
  .bar {{ display: inline-block; width: 96px; height: 5px; background: var(--line);
          overflow: hidden; vertical-align: middle; margin-right: 10px; }}
  .bar span {{ display: block; height: 100%; }}
  .bar-good {{ background: var(--good); }}
  .bar-warn {{ background: var(--warn); }}
  .pct {{ font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
          font-variant-numeric: tabular-nums; font-size: 12.5px; color: var(--muted); }}
  .cov {{ white-space: nowrap; }}
  .unverified {{ font-size: 12px; color: var(--muted); }}
  .num-bad {{ color: var(--bad); }}
  .num-ok {{ color: var(--muted); font-weight: 400; }}
  .sev {{ font-size: 10.5px; text-transform: uppercase; letter-spacing: 0.06em;
          font-weight: 700; padding: 1px 7px; border: 1px solid; }}
  .sev-high {{ color: var(--bad); border-color: var(--bad); }}
  .sev-medium {{ color: var(--warn); border-color: var(--warn); }}
  .sev-low {{ color: var(--muted); border-color: var(--line); }}
  .d-good {{ color: var(--good); font-size: 12px; font-variant-numeric: tabular-nums;
             font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }}
  .d-bad {{ color: var(--bad); font-size: 12px; font-variant-numeric: tabular-nums;
            font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }}
  .d-flat {{ color: var(--muted); font-size: 12px; }}
  .tag {{ display: inline-block; padding: 1px 8px; font-size: 11.5px;
          border: 1px solid var(--line); color: var(--muted); white-space: nowrap; }}
  .muted {{ color: var(--muted); }}
  .empty {{ color: var(--muted); text-align: center; padding: 22px; }}
  .note {{ border-left: 2px solid var(--accent); padding: 2px 0 2px 14px;
           font-size: 13px; color: var(--muted); margin-top: 14px; max-width: 78ch; }}
  .note strong, .note em {{ color: var(--ink); font-style: normal; }}
  .cols {{ display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }}
  @media (max-width: 700px) {{ .cols {{ grid-template-columns: 1fr; }} }}
  .colhead {{ font-size: 10.5px; text-transform: uppercase; letter-spacing: 0.09em;
              font-weight: 700; margin-bottom: 8px; }}
  ul.changes {{ margin: 0; padding-left: 17px; font-size: 13px; }}
  ul.changes li {{ margin-bottom: 5px; }}
  footer {{ margin-top: 46px; padding-top: 16px; border-top: 1px solid var(--line);
            font-size: 11.5px; color: var(--muted); max-width: 78ch; }}
  a {{ color: var(--accent); }}
  a:focus-visible {{ outline: 2px solid var(--accent); outline-offset: 2px; }}
</style>

<div class="wrap">
  <div class="mast">
    <h1>Listing Health Check</h1>
    <div class="stamp">{esc(audit['run_date'])} &middot; {prior_note}</div>
  </div>
  <div class="sources">Sources: {src_bits}</div>

  <div class="strip">
    <div class="cell">
      <div class="n">{census['active_renting']:,} {delta_badge(cd.get('active_renting'))}</div>
      <div class="l">Active &amp; Renting</div>
    </div>
    <div class="cell">
      <div class="n">{census['non_renting']:,} {delta_badge(cd.get('non_renting'))}</div>
      <div class="l">Non-Renting</div>
    </div>
    <div class="cell{' alert' if high_open else ''}">
      <div class="n">{high_open:,}</div>
      <div class="l">High-Severity Flags</div>
    </div>
    <div class="cell{' alert' if audit['issues'] else ''}">
      <div class="n">{len(audit['issues']):,}</div>
      <div class="l">Total Flags</div>
    </div>
    <div class="cell">
      <div class="n">{opened}&thinsp;/&thinsp;{closed}</div>
      <div class="l">Opened / Closed</div>
    </div>
  </div>
  <p class="recon">{reconciliation}</p>

  <h2>All checks</h2>
  <div class="scroll">
    <table>
      <thead><tr><th>Check</th><th>Severity</th><th class="num">Units flagged</th>
        <th class="num">Units checked</th><th>Why it matters</th></tr></thead>
      <tbody>
{chr(10).join(check_rows)}
      </tbody>
    </table>
  </div>

  <h2>Channel coverage</h2>
  <div class="scroll">
    <table>
      <thead><tr><th>Channel</th><th class="num">Expected</th><th class="num">Live</th>
        <th class="num">Missing</th><th>Coverage</th></tr></thead>
      <tbody>
{chr(10).join(coverage_rows)}
      </tbody>
    </table>
  </div>
  <div class="note">
    <strong>Airbnb</strong> and <strong>VRBO</strong> are fully verified from Streamline's OTA
    listing IDs, so a missing one is a real gap. <strong>Branded sites are confirm-only:</strong>
    KeyData stores a single canonical site URL per unit, so a Casago.com URL proves the unit is
    on Casago.com but says nothing about the other sites — everything unconfirmed reads
    <em>unknown</em>, never <em>missing</em>. Treat the branded-site <em>live</em> counts as a
    floor, not a score. Booking.com has no source yet. Niche channels
    ({esc(', '.join(audit['niche_default_off']))}) default to expected-off until we confirm
    intended distribution per unit.
  </div>

  <h2>Changed since last run</h2>
  <div class="cols">
    <div>
      <div class="colhead">Newly flagged <span class="mono">({opened})</span></div>
      <ul class="changes">{change_list(deltas.get('opened', []))}</ul>
    </div>
    <div>
      <div class="colhead">Resolved <span class="mono">({closed})</span></div>
      <ul class="changes">{change_list(deltas.get('closed', []))}</ul>
    </div>
  </div>

  <h2>Dark on every verified OTA</h2>
  <div class="scroll">
    <table id="dark">
      <thead><tr><th>Unit</th><th>Area</th><th>Issue</th><th>Detail</th>
        <th>Streamline ID</th></tr></thead>
      <tbody>
{dark_rows}
      </tbody>
    </table>
  </div>

  <h2>Systems reconciliation</h2>
  <div class="scroll">
    <table id="systems">
      <thead><tr><th>Unit</th><th>Area</th><th>Issue</th><th>Detail</th>
        <th>Streamline ID</th></tr></thead>
      <tbody>
{systems_rows}
      </tbody>
    </table>
  </div>

  <h2>Revenue &amp; accounting exposure</h2>
  <div class="scroll">
    <table id="money">
      <thead><tr><th>Unit</th><th>Area</th><th>Issue</th><th>Detail</th>
        <th>Streamline ID</th></tr></thead>
      <tbody>
{money_rows}
      </tbody>
    </table>
  </div>

  <h2>Classification problems</h2>
  <div class="scroll">
    <table id="classify">
      <thead><tr><th>Unit</th><th>Area</th><th>Issue</th><th>Detail</th>
        <th>Streamline ID</th></tr></thead>
      <tbody>
{class_rows}
      </tbody>
    </table>
  </div>

  <h2>Portfolio census by area</h2>
  <div class="scroll">
    <table>
      <thead><tr><th>Area</th><th class="num">Renting</th><th class="num">Non-Renting</th>
        <th class="num">Total</th></tr></thead>
      <tbody>
{census_rows}
      </tbody>
    </table>
  </div>

  <footer>
    Generated {esc(audit['generated_at'])}. Merchant / payment-gateway validation is not yet
    included &mdash; that field lives on the per-unit Streamline record and needs direct API
    credentials to pull at portfolio scale. Booking.com, branded-site and niche-channel
    verification arrive with URL crawling in the next phase.
  </footer>
</div>
"""


# --------------------------------------------------------------------------
# Entry point
# --------------------------------------------------------------------------


def main() -> int:
    parser = argparse.ArgumentParser(description="Listing Health Check")
    parser.add_argument("--streamline-group", action="append", default=[],
                        help="GetPropertyList payload, repeatable (show_ota_ids=true)")
    parser.add_argument("--renting", action="append", default=[],
                        help="Alias for --streamline-group")
    parser.add_argument("--nonrenting", required=True, action="append")
    parser.add_argument("--wazzi", action="append", default=[])
    parser.add_argument("--wheelhouse", action="append", default=[])
    parser.add_argument("--keydata", action="append", default=[],
                        help="KeyData list_pm_properties payload (is_active=true), repeatable")
    parser.add_argument("--details", action="append", default=[],
                        help="Per-unit detail map from fetch_streamline_details.py "
                             "(classification + merchant fields)")
    parser.add_argument("--outdir", default="audit-output")
    parser.add_argument("--date", default=dt.date.today().isoformat())
    args = parser.parse_args()

    renting_paths = args.streamline_group + args.renting
    if not renting_paths:
        print("ERROR: pass at least one --streamline-group (or --renting) payload.",
              file=sys.stderr)
        return 1

    renting = load_streamline_units(renting_paths)
    nonrenting = load_streamline_units(args.nonrenting)
    wazzi = load_wazzi(args.wazzi)
    wheelhouse = load_wheelhouse(args.wheelhouse)
    keydata = load_keydata(args.keydata)

    details: dict[str, dict[str, Any]] = {}
    for path in args.details:
        payload = load_json(path)
        rows = payload.get("units", payload) if isinstance(payload, dict) else payload
        if isinstance(rows, dict):
            details.update({str(k): v for k, v in rows.items()})
        else:
            details.update({str(r.get("id")): r for r in rows})

    if not any(u.get("ota_listing_ids") is not None for u in renting):
        print("ERROR: no unit carries ota_listing_ids. Refetch with show_ota_ids=true, "
              "otherwise every OTA reads as missing.", file=sys.stderr)
        return 1

    history_dir = os.path.join(args.outdir, "history")
    os.makedirs(history_dir, exist_ok=True)

    audit = build_audit(renting, nonrenting, wazzi, wheelhouse, keydata, details, args.date)
    deltas = compute_deltas(audit, load_prior(history_dir, args.date))
    audit["deltas"] = deltas

    for path in (os.path.join(history_dir, f"{args.date}.json"),
                 os.path.join(args.outdir, "latest.json")):
        with open(path, "w", encoding="utf-8") as handle:
            json.dump(audit, handle, indent=2)
    with open(os.path.join(args.outdir, "report.html"), "w", encoding="utf-8") as handle:
        handle.write(render_html(audit, deltas))

    census = audit["census"]
    print(f"Listing Health Check — {args.date}")
    print(f"  Active+Renting  : {census['active_renting']:,}")
    print(f"  Non-Renting     : {census['non_renting']:,}")
    if census.get("wazzi_total") is not None:
        print(f"  Wazzi Data      : {census['wazzi_total']:,} "
              f"({census['wazzi_total'] - census['total']:+d} vs Streamline)")
    if census.get("wheelhouse_total") is not None:
        print(f"  Wheelhouse      : {census['wheelhouse_total']:,}")
    if census.get("keydata_total") is not None:
        print(f"  KeyData (active): {census['keydata_total']:,} "
              f"({census['keydata_total'] - census['active_renting']:+d} vs renting)")
    print(f"  Flags (high/all): {sum(1 for i in audit['issues'] if i['severity'] == 'high'):,}"
          f" / {len(audit['issues']):,}")
    for s in audit["issue_summary"]:
        if s["checked"] and s["count"]:
            print(f"      {s['label']:<34} {s['count']:>5}")
        elif not s["checked"]:
            print(f"      {s['label']:<34}     ? (source not supplied)")
    if deltas.get("prior_date"):
        print(f"  vs {deltas['prior_date']}: {len(deltas['opened'])} newly flagged, "
              f"{len(deltas['closed'])} resolved")
    else:
        print("  (first run — no prior snapshot)")
    print(f"  Wrote {args.outdir}/latest.json, report.html, history/{args.date}.json")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
