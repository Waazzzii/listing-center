# Daily Asana Task Automation

**Phase:** D-6
**Status:** Approved for implementation
**Date:** 2026-08-12
**Author:** Jason Pratts (COO, ACME House Company)
**Builds on:** [Channel Distribution Audit](2026-08-08-channel-distribution-audit-design.md),
[Listing Health Check overview](../../listing-health-check-overview.md)

---

## Problem

The daily Listing Health Check produces a dashboard, a Slack post, and `worklist.csv` — but
nothing forces action. A finding can sit on the worklist indefinitely with no owner and no
reminder. There's also no fast path from "this unit has a problem" to "here's the unit in
Streamline" — `admin_url` in `worklist.csv` has been blank since the worklist shipped, because
`STREAMLINE_ADMIN_URL` in `channel_audit.py` was left as a placeholder and never set.

Separately, the routine itself runs as a locally-scheduled task
(`~/.claude/scheduled-tasks/channel-distribution-audit/SKILL.md`, cron `7 6 * * *`) tied to
Jason's machine. If the machine is off or asleep at 6am, the audit doesn't run.

## Goal

Every morning, in addition to the existing dashboard/Slack outputs, turn every High- and
Medium-severity finding into an owned, tracked Asana task — routed to the right person by
finding type and market — with a working Streamline deep link, so nothing needs a human to
first notice it before someone is accountable for it.

## Non-Goals (this phase)

- **Moving the routine to a cloud-scheduled agent.** Blocked: none of the six MCP connections
  the routine depends on (Streamline, Wazzi Data, KeyData, Reva, Asana, Slack) are registered
  as cloud connectors at claude.ai/customize/connectors — only wired into this local session.
  Per Jason's direction, this ships as a follow-up once those are connected. See **Deferred**.
- Two-way sync (someone editing the Asana task does not change the audit). The audit is the
  source of truth; Asana reflects it, not the reverse.
- Automated remediation. Tasks are escalation, not fixes.
- Changing what counts as a finding. This phase routes and packages existing `ISSUES` codes
  from `channel_audit.py` — it doesn't add or change checks.

## Design Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Which findings get tasks | All **High + Medium** severity codes | Confirmed with Jason. Low-severity codes (`no_guest_activity`, `no_property_stage`, `missing_neighborhood`, `missing_resort`) are weak signals per the existing doc and never generate a task |
| Task granularity | **One task per (unit, bucket)** | A unit with issues split across two owners (e.g. a channel gap and a wrong property group) gets two tasks, each listing only that owner's issues — keeps ownership unambiguous |
| Routing | **Four buckets**, mapped onto the existing `ISSUES` categories (see below) | Reuses the taxonomy already in the code instead of inventing a parallel one |
| De-dup / lifecycle | **Track + auto-open/auto-close** via a new `asana-tasks.csv` | Without this, a still-open issue would spawn a new task every morning. Separate file from `tracker-status.csv`, which stays team-owned and untouched |
| Computation vs. I/O split | **Python computes desired state; the routine executes Asana calls** | Matches the existing architecture — `channel_audit.py` stays deterministic and network-free; only the routine (which already does Artifact/Slack I/O) talks to Asana |
| First-run volume | **No cap — create everything** | Simplest option and matches what was asked for. Flagged to Jason: day one will likely create ~80-120 tasks (fewer than the raw issue count, since a unit's issues within one bucket collapse into a single task) |

## Architecture

### Fix: Streamline deep links

`STREAMLINE_ADMIN_URL` in `channel_audit.py` (currently `""`) is set to:

```python
STREAMLINE_ADMIN_URL = "https://admin.streamlinevrs.com/edit_home.html?home_id={unit_id}&activetab=0&need_update_parent=1"
```

This populates `admin_url` in `worklist.csv` (currently always blank) and is reused verbatim
in every Asana task body. No other change to `build_links()` is needed — it already calls
`STREAMLINE_ADMIN_URL.format(unit_id=unit_id)` whenever the constant is non-empty.

### Bucket → assignee mapping

Buckets are the existing `ISSUES` categories in `channel_audit.py`, not a new taxonomy:

| Bucket | Codes (severity) | Assignee |
|---|---|---|
| **Channel** | `missing_airbnb` (H), `missing_vrbo` (H), `dark_all_otas` (H), `online_bookings_off` (H), `reviews_without_listing_id` (H) | tom@acmehouseco.com |
| **KeyData** | `not_active_in_keydata` (H), `keydata_active_orphan` (M) | vanessa@acmehouseco.com |
| **Classification/Accounting** | `missing_area` (H), `group_state_mismatch` (H), `missing_merchant` (H), `missing_property_group` (M), `missing_accounting_ids` (M), `stage_live_not_renting` (M) | The unit's area GM (table below); **jason@acmehouseco.com** if the unit has no area |
| **Unassigned/triage** | `not_in_wazzi` (M), `orphan_in_wazzi` (M), and the (currently dormant) Wheelhouse codes if that source is ever re-enabled | No assignee — task is created but left in Asana's default unassigned state |

**Assumption flagged for review:** `stage_live_not_renting`, `missing_accounting_ids`, and the
Wazzi-orphan codes were not in Jason's original bullet list. They're placed above by category
(Classification/Accounting vs. general systems) rather than left unassigned — correct if wrong.

Area → GM table (all 12 values verified against the area strings `channel_audit.py` already
produces — `AZ_AREAS`, `CA_AREAS`, `PS_AREAS`):

| Area | Assignee |
|---|---|
| Central Coast | spencer@acmehouseco.com |
| Coachella | todd@acmehouseco.com |
| Flagstaff | taji@acmehouseco.com |
| HighDesert | todd@acmehouseco.com |
| IdyllwildTemecula | elizabeth@acmehouseco.com |
| Lake Arrowhead | michelle@acmehouseco.com |
| Orange County | kyle.rankin@acmehouseco.com |
| PalmSprings | todd@acmehouseco.com |
| Phoenix | mitchell@acmehouseco.com |
| PineTop | taji@acmehouseco.com |
| Sedona | taji@acmehouseco.com |
| Tucson | krista@acmehouseco.com |

A unit whose own issue *is* `missing_area` has no area to look up — it always lands on Jason,
which is the correct fallback, not a special case.

**Redundancy:** a unit with `dark_all_otas` does not also get separate `missing_airbnb` /
`missing_vrbo` lines in its task body — reuses the exact `redundant()` check `write_worklist()`
already applies, so the two outputs never disagree.

### New file: `audit-output/asana-tasks.csv`

The durable map the script diffs against every morning. Columns:

```
unit_id, bucket, task_gid, signature, assignee_email, opened_date, updated_date
```

`signature` is the sorted, pipe-joined list of issue codes currently open in that
(unit, bucket) — the change-detection key. `task_gid` is blank until the routine creates the
task and writes it back (see Lifecycle).

### New output: `audit-output/asana-actions.json`

Written by `channel_audit.py` on every run, computed by diffing today's qualifying findings
(grouped by unit × bucket) against `asana-tasks.csv`:

```json
{
  "to_create": [
    {"unit_id": "1101745", "bucket": "classification", "assignee_email": "jason@acmehouseco.com",
     "title": "[1101745] Hilltop Heaven — Missing area, dark on OTAs",
     "notes": "...", "signature": "dark_all_otas|missing_area"}
  ],
  "to_update": [
    {"unit_id": "...", "bucket": "...", "task_gid": "...", "title": "...", "notes": "...",
     "signature": "..."}
  ],
  "to_complete": [
    {"unit_id": "...", "bucket": "...", "task_gid": "..."}
  ]
}
```

- **`to_create`**: (unit, bucket) has qualifying findings today and no row in `asana-tasks.csv`.
- **`to_update`**: has a row, but `signature` changed (an issue was added or dropped from that
  bucket) — title/notes are regenerated.
- **`to_complete`**: has a row in `asana-tasks.csv` with no matching qualifying findings today
  — every issue in that bucket resolved.
- Unchanged (unit, bucket) pairs appear in none of the three lists — no Asana call needed.

### Task content

- **Title:** `[{streamline_unit_id}] {property_name} — {3–5 word summary}`, e.g.
  `[1101745] Hilltop Heaven — Missing area, dark on OTAs`. The summary reuses the same
  short-label join already used for the Slack "Top properties" list (`"; ".join(...)`, deduped).
- **Body:** the Streamline deep link, one paragraph per included issue (the existing
  description text from `ISSUES[code][3]`), then a "To fix" bullet list reusing the existing
  `what_to_fix` text already computed for `worklist.csv` — no new copy is written anywhere.

### Lifecycle (runs after `channel_audit.py`, before the commit step)

1. Script writes `asana-actions.json` as described above.
2. The routine reads it and, via the Asana MCP tool, against workspace `1207909907644766` /
   project `1217387159873687`:
   - `to_create` → create tasks (batched), assignee by email where the bucket has one, name +
     notes as computed.
   - `to_update` → update name + notes on the existing `task_gid`.
   - `to_complete` → mark the existing `task_gid` complete.
3. The routine writes the resulting `task_gid`s (for creates) back into `asana-tasks.csv`,
   removes completed rows, and refreshes `signature`/`updated_date` for updates. This is the
   one piece of state that has to be written by the routine rather than the script, since it
   depends on IDs Asana assigns — everything else about the file is script-computed.
4. `asana-tasks.csv` is committed alongside the rest of `audit-output/` in the existing commit
   step — no new git step needed.

## Routine changes (`~/.claude/scheduled-tasks/channel-distribution-audit/SKILL.md`)

- **STEP 8** (compute): unchanged invocation; note that it now also writes
  `audit-output/asana-actions.json`.
- **New STEP 10.5** (after Slack post, before commit): read `asana-actions.json` and execute
  the three action lists via the Asana MCP tool as described in Lifecycle above. If this step
  fails partway, report exactly which actions succeeded before the failure — never claim the
  full list ran.
- **STEP 11** (commit): unchanged — `git add audit-output` already picks up `asana-tasks.csv`.
- **STEP 12** (report): add Asana counts (created / updated / completed / current triage count)
  to the concise report-back.
- `Do NOT edit audit-output/tracker-status.csv` guidance is unchanged and now explicitly joined
  by `asana-tasks.csv` is script/routine-owned, not team-owned — the team should treat Asana
  itself, not this CSV, as the place to track status.

## Testing

- **Unit (Python):** bucket assignment across all `ISSUES` codes, including the "no area →
  Jason" fallback and the `dark_all_otas` redundancy suppression; signature diffing for all
  three transitions (create/update/complete); the case where a unit has qualifying findings
  in two buckets simultaneously (must produce two separate action entries).
- **Fixture:** a captured `asana-tasks.csv` from a prior "day" run through a changed
  `latest.json` to verify update/complete detection end-to-end.
- **Dry run:** first invocation reviewed with `asana-actions.json` inspected before any Asana
  call is made, given the expected ~80-120 tasks on day one.

## Rollout

1. Set `STREAMLINE_ADMIN_URL`; verify `worklist.csv` admin links populate on the next run.
2. Implement bucket mapping + `asana-actions.json` computation in `channel_audit.py`, unit
   tested against fixtures.
3. Dry run: generate `asana-actions.json` from tomorrow's real data, review the `to_create`
   list and its size/routing by hand before touching Asana.
4. Wire the routine's new STEP 10.5 to execute against the real Asana project, resolve
   assignee emails to Asana user GIDs once (cache in the routine step), confirm one task by
   hand.
5. Enable for a full run; watch the first morning's task count and routing before relying on
   it unattended.

## Success Criteria

- `admin_url` in `worklist.csv` is populated for every unit.
- Every High/Medium finding has exactly one open Asana task in the right bucket, with the
  correct assignee.
- No duplicate tasks for a persisting issue across days.
- A resolved issue's task is auto-completed within one day of resolution.
- Routine failure partway through Asana sync reports precisely what succeeded, never a blanket
  success or failure claim.

## Open Items

- **Confirm bucket placement** for `stage_live_not_renting`, `missing_accounting_ids`, and the
  Wazzi-orphan codes (flagged above under Bucket → assignee mapping).
- **Assignee resolution:** confirm whether the Asana MCP tool accepts an email directly as
  `assignee`, or whether user GIDs must be resolved once via a workspace users lookup and
  cached in the routine — decide during implementation.
- **First-run volume:** no cap is planned; Jason to watch the actual count on day one and
  decide if a cap is wanted later.

## Deferred: Cloud-based routine

The routine currently runs as a locally-scheduled task tied to Jason's machine
(`~/.claude/scheduled-tasks/channel-distribution-audit/SKILL.md`). Moving it to a cloud
routine (via `RemoteTrigger`/CCR) requires all six MCP connections it depends on — Streamline,
Wazzi Data, KeyData, Reva, Asana, and Slack — to be registered as connectors at
claude.ai/customize/connectors and attached to the routine's `mcp_connections`. None are
registered there today; they're only available in this local session.

Per Jason's direction (build the Asana automation now, cloud migration later), this is tracked
as a follow-up, not part of this phase. Once the six connectors are live, the cloud migration
is mechanical: same prompt content as the local `SKILL.md`, wrapped into a `RemoteTrigger`
routine with a `0 13 * * *` UTC cron (6am Pacific) and the six connectors attached.
