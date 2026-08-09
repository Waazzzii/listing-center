#!/usr/bin/env python3
"""
Channel Distribution Audit — V0 daily run.

Reads raw Streamline `GetPropertyList` payloads (fetched by the daily routine via
the Streamline MCP connection) and produces:

  audit-output/latest.json          — today's full audit result
  audit-output/history/<date>.json  — one snapshot per day, for deltas
  audit-output/report.html          — the dashboard published as an Artifact

All computation lives here so the routine only has to do I/O. Deterministic:
same inputs always produce the same output.

Usage:
  python3 scripts/channel_audit.py \
      --renting     <path to active+renting payload> \
      --nonrenting  <path to non-renting payload> \
      [--outdir audit-output] [--date YYYY-MM-DD]

The renting payload must be fetched with show_ota_ids=true so the OTA columns
are populated; without it every OTA reads as missing.
"""

from __future__ import annotations

import argparse
import collections
import datetime as dt
import html
import json
import os
import sys
from typing import Any

# --------------------------------------------------------------------------
# Channel registry — V0.
#
# `observable` marks channels we can actually verify from Streamline config
# today. Everything else is tracked but reports as unverified rather than
# being silently scored as live or broken.
# --------------------------------------------------------------------------

AZ_AREAS = {"Phoenix", "Tucson", "Sedona", "Flagstaff", "PineTop", "HighDesert"}
CA_AREAS = {"Central Coast", "Orange County", "Lake Arrowhead", "IdyllwildTemecula"}
PS_AREAS = {"PalmSprings", "Coachella"}

CHANNELS: list[dict[str, Any]] = [
    {"code": "airbnb", "name": "Airbnb", "kind": "ota", "observable": True},
    {"code": "vrbo", "name": "VRBO", "kind": "ota", "observable": True},
    {"code": "booking", "name": "Booking.com", "kind": "ota", "observable": False},
    {"code": "acmehouseco", "name": "AcmeHouseCo.com", "kind": "branded_site", "observable": False},
    {"code": "casago", "name": "Casago.com", "kind": "branded_site", "observable": False},
    {"code": "casago_az", "name": "CasagoArizona.com", "kind": "branded_site", "observable": False},
    {"code": "casago_socal", "name": "CasagoSoCal.com", "kind": "branded_site", "observable": False},
    {"code": "vacation_palm_springs", "name": "VacationPalmSprings.com", "kind": "branded_site", "observable": False},
    {"code": "midstays", "name": "Midstays.com", "kind": "branded_site", "observable": False},
    {"code": "vacasa", "name": "Vacasa.com", "kind": "niche_ota", "observable": False},
    {"code": "hopper", "name": "Hopper.com", "kind": "niche_ota", "observable": False},
    {"code": "crewdogs", "name": "Crewdogs.com", "kind": "niche_ota", "observable": False},
    {"code": "wander", "name": "Wander.com", "kind": "niche_ota", "observable": False},
    {"code": "whimstay", "name": "Whimstay.com", "kind": "niche_ota", "observable": False},
]

# Niche channels default to expected=false until ops confirms intent per unit.
# Defaulting them true would manufacture thousands of false gaps on day one.
NICHE_DEFAULT_OFF = {"vacasa", "hopper", "crewdogs", "wander", "whimstay", "midstays"}


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
    # Unknown/null area gets no brand site — surfaced as a data-quality flag.
    return expected


def observe(unit: dict[str, Any], channel_code: str) -> str:
    """Return 'live' | 'not_live' | 'unknown' for a unit on a channel."""
    if channel_code in ("airbnb", "vrbo"):
        ota = unit.get("ota_listing_ids") or {}
        value = ota.get(channel_code)
        return "live" if value and str(value).strip() else "not_live"
    return "unknown"


# --------------------------------------------------------------------------
# Payload loading
# --------------------------------------------------------------------------


def load_units(path: str) -> list[dict[str, Any]]:
    """Load a Streamline GetPropertyList payload into a list of unit dicts."""
    with open(path, encoding="utf-8") as handle:
        payload = json.load(handle)

    data = payload.get("data", payload)
    units = data.get("property", data if isinstance(data, list) else [])
    if isinstance(units, dict):  # single-unit responses come back unwrapped
        units = [units]
    if not units:
        raise SystemExit(f"No units found in payload: {path}")
    return units


def area_of(unit: dict[str, Any]) -> str:
    return unit.get("location_area_name") or "(unassigned)"


# --------------------------------------------------------------------------
# Audit
# --------------------------------------------------------------------------


def build_audit(
    renting: list[dict[str, Any]],
    nonrenting: list[dict[str, Any]],
    run_date: str,
) -> dict[str, Any]:
    channel_by_code = {c["code"]: c for c in CHANNELS}

    census_by_area: dict[str, dict[str, int]] = collections.defaultdict(
        lambda: {"renting": 0, "non_renting": 0}
    )
    for unit in renting:
        census_by_area[area_of(unit)]["renting"] += 1
    for unit in nonrenting:
        census_by_area[area_of(unit)]["non_renting"] += 1

    coverage: dict[str, dict[str, Any]] = {}
    for channel in CHANNELS:
        coverage[channel["code"]] = {
            "code": channel["code"],
            "name": channel["name"],
            "kind": channel["kind"],
            "observable": channel["observable"],
            "expected": 0,
            "live": 0,
            "missing": 0,
            "unknown": 0,
        }

    gaps: list[dict[str, Any]] = []
    unassigned_area: list[dict[str, Any]] = []

    for unit in renting:
        unit_id = str(unit.get("id"))
        name = unit.get("name") or "(unnamed)"
        area = area_of(unit)
        if not unit.get("location_area_name"):
            unassigned_area.append({"unit_id": unit_id, "name": name})

        for code in expected_channels(unit):
            row = coverage[code]
            row["expected"] += 1
            state = observe(unit, code)
            if state == "live":
                row["live"] += 1
            elif state == "not_live":
                row["missing"] += 1
                gaps.append(
                    {
                        "unit_id": unit_id,
                        "name": name,
                        "area": area,
                        "channel": code,
                        "channel_name": channel_by_code[code]["name"],
                        "gap_type": "missing",
                        "severity": "high",
                    }
                )
            else:
                row["unknown"] += 1

    for row in coverage.values():
        row["coverage_pct"] = (
            round(row["live"] / row["expected"] * 100, 1) if row["expected"] else None
        )

    # Units dark on every observable OTA at once — the sharpest signal we have.
    observable_otas = [c["code"] for c in CHANNELS if c["observable"]]
    dark_units = [
        {
            "unit_id": str(u.get("id")),
            "name": u.get("name") or "(unnamed)",
            "area": area_of(u),
            "address": u.get("address"),
            "city": u.get("city"),
        }
        for u in renting
        if all(observe(u, code) == "not_live" for code in observable_otas)
    ]

    total_renting = len(renting)
    total_nonrenting = len(nonrenting)

    return {
        "run_date": run_date,
        "generated_at": dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds"),
        "census": {
            "active_renting": total_renting,
            "non_renting": total_nonrenting,
            "total": total_renting + total_nonrenting,
            "by_area": {
                area: counts
                for area, counts in sorted(
                    census_by_area.items(), key=lambda kv: -kv[1]["renting"]
                )
            },
        },
        "coverage": list(coverage.values()),
        "gaps": sorted(gaps, key=lambda g: (g["channel"], g["area"], g["name"])),
        "dark_units": sorted(dark_units, key=lambda u: (u["area"], u["name"])),
        "data_quality": {"unassigned_area": unassigned_area},
        "channels_observable": observable_otas,
        "channels_unverified": [c["code"] for c in CHANNELS if not c["observable"]],
        "niche_default_off": sorted(NICHE_DEFAULT_OFF),
    }


def compute_deltas(current: dict[str, Any], prior: dict[str, Any] | None) -> dict[str, Any]:
    """Day-over-day change. Returns an empty-but-shaped dict on the first run."""
    if not prior:
        return {
            "prior_date": None,
            "census": {},
            "gaps_opened": [],
            "gaps_closed": [],
            "coverage": {},
        }

    def gap_key(gap: dict[str, Any]) -> str:
        return f"{gap['unit_id']}::{gap['channel']}"

    current_gaps = {gap_key(g): g for g in current["gaps"]}
    prior_gaps = {gap_key(g): g for g in prior.get("gaps", [])}

    prior_coverage = {c["code"]: c for c in prior.get("coverage", [])}
    coverage_delta = {}
    for row in current["coverage"]:
        was = prior_coverage.get(row["code"])
        if was:
            coverage_delta[row["code"]] = {
                "live": row["live"] - was.get("live", 0),
                "missing": row["missing"] - was.get("missing", 0),
            }

    prior_census = prior.get("census", {})
    return {
        "prior_date": prior.get("run_date"),
        "census": {
            "active_renting": current["census"]["active_renting"]
            - prior_census.get("active_renting", 0),
            "non_renting": current["census"]["non_renting"]
            - prior_census.get("non_renting", 0),
            "total": current["census"]["total"] - prior_census.get("total", 0),
        },
        "gaps_opened": [g for k, g in current_gaps.items() if k not in prior_gaps],
        "gaps_closed": [g for k, g in prior_gaps.items() if k not in current_gaps],
        "coverage": coverage_delta,
    }


def load_prior(history_dir: str, run_date: str) -> dict[str, Any] | None:
    """Most recent history snapshot strictly before run_date."""
    if not os.path.isdir(history_dir):
        return None
    dates = sorted(
        f[:-5] for f in os.listdir(history_dir) if f.endswith(".json") and f[:-5] < run_date
    )
    if not dates:
        return None
    with open(os.path.join(history_dir, f"{dates[-1]}.json"), encoding="utf-8") as handle:
        return json.load(handle)


# --------------------------------------------------------------------------
# HTML report
# --------------------------------------------------------------------------


def esc(value: Any) -> str:
    return html.escape(str(value if value is not None else ""))


def delta_badge(value: int | None, invert: bool = False) -> str:
    """Render a signed delta. invert=True means 'up is bad' (e.g. missing count)."""
    if value is None or value == 0:
        return '<span class="d-flat">—</span>'
    good = (value < 0) if invert else (value > 0)
    cls = "d-good" if good else "d-bad"
    return f'<span class="{cls}">{value:+d}</span>'


def render_html(audit: dict[str, Any], deltas: dict[str, Any]) -> str:
    census = audit["census"]
    cd = deltas.get("census", {})
    covd = deltas.get("coverage", {})

    coverage_rows = []
    for row in audit["coverage"]:
        d = covd.get(row["code"], {})
        if row["observable"]:
            pct = row["coverage_pct"]
            bar_class = "bar-good" if pct is not None and pct >= 99 else "bar-warn"
            state_cell = (
                f'<div class="bar"><span class="{bar_class}" style="width:{pct}%"></span></div>'
                f'<span class="pct">{pct}%</span>'
            )
            missing_cell = (
                f'<strong class="{"num-bad" if row["missing"] else "num-ok"}">{row["missing"]}</strong> '
                f'{delta_badge(d.get("missing"), invert=True)}'
            )
            live_cell = f'{row["live"]} {delta_badge(d.get("live"))}'
        else:
            state_cell = '<span class="unverified">not verified in V0</span>'
            missing_cell = '<span class="d-flat">—</span>'
            live_cell = '<span class="d-flat">—</span>'

        coverage_rows.append(
            f"""      <tr>
        <td class="ch"><span class="dot dot-{esc(row['kind'])}"></span>{esc(row['name'])}</td>
        <td class="num">{row['expected'] or '<span class="d-flat">off</span>'}</td>
        <td class="num">{live_cell}</td>
        <td class="num">{missing_cell}</td>
        <td class="cov">{state_cell}</td>
      </tr>"""
        )

    gap_rows = "".join(
        f"""      <tr>
        <td>{esc(g['name'])}</td>
        <td>{esc(g['area'])}</td>
        <td><span class="tag">{esc(g['channel_name'])}</span></td>
        <td class="mono">{esc(g['unit_id'])}</td>
      </tr>"""
        for g in audit["gaps"]
    ) or '      <tr><td colspan="4" class="empty">No gaps on observable channels.</td></tr>'

    dark_rows = "".join(
        f"""      <tr>
        <td>{esc(u['name'])}</td>
        <td>{esc(u['area'])}</td>
        <td>{esc(u['address'])}, {esc(u['city'])}</td>
        <td class="mono">{esc(u['unit_id'])}</td>
      </tr>"""
        for u in audit["dark_units"]
    ) or '      <tr><td colspan="4" class="empty">No units dark on all observable OTAs.</td></tr>'

    census_rows = "".join(
        f"""      <tr>
        <td>{esc(area)}</td>
        <td class="num">{counts['renting']}</td>
        <td class="num">{counts['non_renting']}</td>
        <td class="num">{counts['renting'] + counts['non_renting']}</td>
      </tr>"""
        for area, counts in census["by_area"].items()
    )

    opened = len(deltas.get("gaps_opened", []))
    closed = len(deltas.get("gaps_closed", []))
    prior_note = (
        f"vs. {esc(deltas['prior_date'])}"
        if deltas.get("prior_date")
        else "first run — no prior day to compare"
    )

    opened_list = "".join(
        f"<li><strong>{esc(g['name'])}</strong> — {esc(g['channel_name'])} <span class=\"muted\">({esc(g['area'])})</span></li>"
        for g in deltas.get("gaps_opened", [])[:25]
    ) or '<li class="muted">None</li>'
    closed_list = "".join(
        f"<li><strong>{esc(g['name'])}</strong> — {esc(g['channel_name'])} <span class=\"muted\">({esc(g['area'])})</span></li>"
        for g in deltas.get("gaps_closed", [])[:25]
    ) or '<li class="muted">None</li>'

    unassigned = audit["data_quality"]["unassigned_area"]
    unassigned_note = (
        f'{len(unassigned)} unit(s) have no area assigned in Streamline, so no brand-site '
        f'expectation can be derived: ' + ", ".join(esc(u["name"]) for u in unassigned)
        if unassigned
        else "Every unit has an area assigned."
    )

    return f"""<title>Channel Distribution Audit — {esc(audit['run_date'])}</title>
<style>
  /* Slate-biased neutrals; teal accent kept distinct from semantic status color. */
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
  .wrap {{ max-width: 1100px; margin: 0 auto; padding: 44px 24px 84px;
           display: flex; flex-direction: column; gap: 8px; }}

  /* ---- masthead ---- */
  .mast {{ display: flex; align-items: baseline; justify-content: space-between;
           flex-wrap: wrap; gap: 8px; padding-bottom: 18px;
           border-bottom: 2px solid var(--ink); }}
  h1 {{ font-size: 25px; font-weight: 680; letter-spacing: -0.025em; margin: 0;
        text-wrap: balance; }}
  .stamp {{ font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
            font-size: 12px; color: var(--muted); font-variant-numeric: tabular-nums; }}

  /* ---- summary strip: one divided band, not floating cards ---- */
  .strip {{ display: grid; grid-template-columns: repeat(auto-fit, minmax(148px, 1fr));
            background: var(--panel); border: 1px solid var(--line);
            margin: 22px 0 10px; }}
  .cell {{ padding: 16px 18px; border-right: 1px solid var(--line-soft); }}
  .cell:last-child {{ border-right: none; }}
  .cell .n {{ font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
              font-size: 27px; font-weight: 600; letter-spacing: -0.03em;
              font-variant-numeric: tabular-nums; display: flex;
              align-items: baseline; gap: 7px; }}
  .cell .l {{ font-size: 10.5px; text-transform: uppercase; letter-spacing: 0.09em;
              color: var(--muted); margin-top: 5px; font-weight: 600; }}
  .cell.alert {{ box-shadow: inset 3px 0 0 var(--rail); }}
  .cell.alert .n {{ color: var(--bad); }}

  /* ---- sections ---- */
  h2 {{ font-size: 11px; text-transform: uppercase; letter-spacing: 0.11em;
        color: var(--muted); margin: 38px 0 12px; font-weight: 700; }}
  h2 .count {{ font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
               color: var(--ink); letter-spacing: 0; margin-left: 6px; }}

  /* ---- tables ---- */
  table {{ width: 100%; border-collapse: collapse; font-size: 13.5px; }}
  .scroll {{ overflow-x: auto; background: var(--panel); border: 1px solid var(--line); }}
  th {{ text-align: left; font-size: 10.5px; text-transform: uppercase;
        letter-spacing: 0.07em; color: var(--muted); font-weight: 700;
        padding: 10px 14px; border-bottom: 1px solid var(--line);
        white-space: nowrap; }}
  td {{ padding: 9px 14px; border-bottom: 1px solid var(--line-soft);
        vertical-align: middle; }}
  tbody tr:last-child td {{ border-bottom: none; }}
  .num {{ text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap;
          font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }}
  .mono {{ font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
           font-size: 12px; color: var(--muted); }}
  .ch {{ font-weight: 560; white-space: nowrap; }}
  .dot {{ display: inline-block; width: 6px; height: 6px; border-radius: 50%;
          margin-right: 10px; vertical-align: middle; }}
  .dot-ota {{ background: var(--accent); }}
  .dot-branded_site {{ background: var(--muted); }}
  .dot-niche_ota {{ background: var(--line); box-shadow: inset 0 0 0 1px var(--muted); }}

  /* severity rail on rows that need action */
  #gaps tbody tr td:first-child {{ box-shadow: inset 3px 0 0 var(--rail); }}
  #dark tbody tr td:first-child {{ box-shadow: inset 3px 0 0 var(--rail); }}
  #gaps tbody tr td.empty, #dark tbody tr td.empty {{ box-shadow: none; }}

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
           font-size: 13px; color: var(--muted); margin-top: 14px; max-width: 74ch; }}
  .note strong, .note em {{ color: var(--ink); font-style: normal; }}
  .cols {{ display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }}
  @media (max-width: 700px) {{ .cols {{ grid-template-columns: 1fr; }} }}
  .colhead {{ font-size: 10.5px; text-transform: uppercase; letter-spacing: 0.09em;
              font-weight: 700; margin-bottom: 8px; }}
  ul.changes {{ margin: 0; padding-left: 17px; font-size: 13px; }}
  ul.changes li {{ margin-bottom: 5px; }}
  footer {{ margin-top: 46px; padding-top: 16px; border-top: 1px solid var(--line);
            font-size: 11.5px; color: var(--muted); max-width: 74ch; }}
  a {{ color: var(--accent); }}
  a:focus-visible, [tabindex]:focus-visible {{ outline: 2px solid var(--accent);
                                               outline-offset: 2px; }}
</style>

<div class="wrap">
  <div class="mast">
    <h1>Channel Distribution Audit</h1>
    <div class="stamp">{esc(audit['run_date'])} &middot; {prior_note} &middot; source: Streamline</div>
  </div>

  <div class="strip">
    <div class="cell">
      <div class="n">{census['active_renting']:,} {delta_badge(cd.get('active_renting'))}</div>
      <div class="l">Active &amp; Renting</div>
    </div>
    <div class="cell">
      <div class="n">{census['non_renting']:,} {delta_badge(cd.get('non_renting'))}</div>
      <div class="l">Non-Renting</div>
    </div>
    <div class="cell{' alert' if audit['gaps'] else ''}">
      <div class="n">{len(audit['gaps'])}</div>
      <div class="l">Open Gaps</div>
    </div>
    <div class="cell{' alert' if audit['dark_units'] else ''}">
      <div class="n">{len(audit['dark_units'])}</div>
      <div class="l">Dark on All OTAs</div>
    </div>
    <div class="cell">
      <div class="n">{opened}&thinsp;/&thinsp;{closed}</div>
      <div class="l">Opened / Closed</div>
    </div>
  </div>

  <h2>Channel coverage</h2>
  <div class="scroll">
    <table>
      <thead><tr>
        <th>Channel</th><th class="num">Expected</th><th class="num">Live</th>
        <th class="num">Missing</th><th>Coverage</th>
      </tr></thead>
      <tbody>
{chr(10).join(coverage_rows)}
      </tbody>
    </table>
  </div>
  <div class="note">
    Only <strong>Airbnb</strong> and <strong>VRBO</strong> are verified in V0 — both read
    directly from Streamline's OTA listing IDs. The remaining channels are tracked but show
    <em>not verified</em> rather than a misleading green. Niche channels
    ({esc(', '.join(audit['niche_default_off']))}) default to expected-off until ops confirms
    intended distribution per unit.
  </div>

  <h2>Changed since last run</h2>
  <div class="cols">
    <div>
      <div class="colhead">Gaps opened <span class="mono">({opened})</span></div>
      <ul class="changes">{opened_list}</ul>
    </div>
    <div>
      <div class="colhead">Gaps closed <span class="mono">({closed})</span></div>
      <ul class="changes">{closed_list}</ul>
    </div>
  </div>

  <h2>Units dark on every verified OTA <span class="count">{len(audit['dark_units'])}</span></h2>
  <div class="scroll">
    <table id="dark">
      <thead><tr><th>Unit</th><th>Area</th><th>Address</th><th>Streamline ID</th></tr></thead>
      <tbody>
{dark_rows}
      </tbody>
    </table>
  </div>

  <h2>All open gaps <span class="count">{len(audit['gaps'])}</span></h2>
  <div class="scroll">
    <table id="gaps">
      <thead><tr><th>Unit</th><th>Area</th><th>Channel</th><th>Streamline ID</th></tr></thead>
      <tbody>
{gap_rows}
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
  <div class="note">{unassigned_note}</div>

  <footer>
    Generated {esc(audit['generated_at'])} &middot; V0 config-only audit.
    URL crawling, Booking.com, branded-site and niche-channel verification are deferred to V2.
  </footer>
</div>
"""


# --------------------------------------------------------------------------
# Entry point
# --------------------------------------------------------------------------


def main() -> int:
    parser = argparse.ArgumentParser(description="Channel Distribution Audit — V0")
    parser.add_argument("--renting", required=True, help="active+renting payload (show_ota_ids=true)")
    parser.add_argument("--nonrenting", required=True, help="non-renting payload")
    parser.add_argument("--outdir", default="audit-output")
    parser.add_argument("--date", default=dt.date.today().isoformat())
    args = parser.parse_args()

    renting = load_units(args.renting)
    nonrenting = load_units(args.nonrenting)

    with_ota = sum(1 for u in renting if u.get("ota_listing_ids") is not None)
    if with_ota == 0:
        print(
            "ERROR: no unit carries ota_listing_ids. Refetch the renting payload with "
            "show_ota_ids=true, otherwise every OTA reads as missing.",
            file=sys.stderr,
        )
        return 1

    history_dir = os.path.join(args.outdir, "history")
    os.makedirs(history_dir, exist_ok=True)

    audit = build_audit(renting, nonrenting, args.date)
    deltas = compute_deltas(audit, load_prior(history_dir, args.date))
    audit["deltas"] = deltas

    with open(os.path.join(history_dir, f"{args.date}.json"), "w", encoding="utf-8") as handle:
        json.dump(audit, handle, indent=2)
    with open(os.path.join(args.outdir, "latest.json"), "w", encoding="utf-8") as handle:
        json.dump(audit, handle, indent=2)
    with open(os.path.join(args.outdir, "report.html"), "w", encoding="utf-8") as handle:
        handle.write(render_html(audit, deltas))

    census = audit["census"]
    print(f"Channel Distribution Audit — {args.date}")
    print(f"  Active+Renting : {census['active_renting']:,}")
    print(f"  Non-Renting    : {census['non_renting']:,}")
    print(f"  Open gaps      : {len(audit['gaps'])}")
    print(f"  Dark on all OTAs: {len(audit['dark_units'])}")
    if deltas.get("prior_date"):
        print(
            f"  vs {deltas['prior_date']}: {len(deltas['gaps_opened'])} opened, "
            f"{len(deltas['gaps_closed'])} closed"
        )
    else:
        print("  (first run — no prior snapshot)")
    if with_ota < len(renting):
        print(f"  NOTE: {len(renting) - with_ota} unit(s) had no ota_listing_ids field at all")
    print(f"  Wrote {args.outdir}/latest.json, report.html, history/{args.date}.json")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
