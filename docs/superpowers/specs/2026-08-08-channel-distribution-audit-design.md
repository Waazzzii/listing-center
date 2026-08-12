# Channel Distribution Audit

**Phase:** D-5
**Status:** Approved for implementation
**Date:** 2026-08-08
**Author:** Jason Pratts (COO, ACME House Company)
**Builds on:** [Listing Visibility & Performance Diagnostic Layer](2026-04-15-listing-visibility-diagnostic-layer.md)

---

## Problem

Units are missing from channels and nobody finds out until someone notices by accident.

Listing Center already reconciles Streamline against Airbnb, VRBO, and Booking.com via
`lc_listing_presence`. That table infers what a unit *should* be on from whether a listing ID
exists on `lc_properties` — which is circular. A unit missing from VRBO has no VRBO listing ID,
so it never produces a presence row, so it never appears as a gap. The system can only report
what exists, never what is absent.

Three further gaps in today's coverage:

- Distribution spans **14 channels**, not three. Branded sites, niche OTAs, and Vacasa.com are
  entirely unmodeled.
- Whether a unit is correctly represented in the four underlying **systems** — Wazzi Data,
  Streamline, Wheelhouse, KeyData — is never checked. A Non-Renting unit still priced by
  Wheelhouse is invisible today.
- There is no **portfolio census**. Nobody can answer "how many units are Active + Renting right
  now, and what changed since yesterday."

Evidence the problem is real: the prior spec built against "~1,060 units across 9 area names."
Streamline returns **1,344 active + renting units across 13 areas** as of 2026-08-08. Listing
Center's own inventory is ~280 units behind reality.

## Goal

A daily audit that, for every unit × channel and every unit × system, compares what we
**expect** against what we **observe**, and turns every discrepancy into an owned, tracked,
escalated item — with a portfolio census and day-over-day status deltas alongside it.

## Non-Goals (V1)

- **URL crawling.** No external HTTP fetches of listing pages. V1 verifies configuration only.
  Deferred to V2; the schema reserves `public_url` per unit × channel so crawling layers on with
  no migration.
- Impressions, discount configuration, content quality, pricing analysis. Explicitly back-pocket
  per user direction: "right now I just don't know if everything is up everywhere as it should be."
- Automated remediation. The audit escalates; humans fix.
- Retiring `lc_listing_presence` and the existing Phase D scraper work. They remain for the
  content/performance diagnostic path and are unaffected.

## Current-State Findings

Established by direct API probing on 2026-08-08:

| Finding | Detail | Consequence |
|---|---|---|
| Portfolio size | 1,344 active+renting, 237 non-renting, 1,581 total | `lc_properties` is ~280 units stale |
| Areas | 13 (Palm Springs 401, Phoenix 305, Tucson 152, Central Coast 110, Coachella 88, Lake Arrowhead 75, Orange County 62, Flagstaff 48, Sedona 41, Pinetop 27, Idyllwild/Temecula 24, High Desert 9) | Market→brand-site rules must cover all 13 |
| Unassigned area | 2 units have `location_area_name: null` | Cannot derive expected brand site; flagged for review |
| Renting Type | `owning_type_id` (1=Renting, 2=Non-Renting, 99=Bullpen) | Available; drives expectation |
| Property Status | `status_id` / `status_name` (Active/Inactive) | Available; note it lacks the "Active w/ Future Blocks" option seen in the Streamline UI |
| **Property Stage** | **Not exposed via API** | Custom fields not flagged "Show on Site" are omitted. V1 ships without it |
| **Property Status (UI dropdown)** | **Not exposed via API** | Same cause. Distinct from `status_id` |
| Branded site URL | `seo_page_url` (e.g. `casagosocal.com/vacation-rentals/palm-springs/...`) | Observable signal for brand sites |
| Casago.com URL | `flyer_url` (e.g. `casago.com/rental/1093036.html`) | Observable signal |
| Website suppression | `not_show_on_website` (0/1) | Drives branded-site expectation |
| Vacasa mapping | `variable_vacasa_unit_id` custom field | Observable signal for Vacasa.com |
| OTA IDs | `show_ota_ids` param returns Airbnb/VRBO codes | Observable signal for Big 3 |
| Distribution Channel Settings | `show_registration_numbers` on `get_property_list` reads from it; `distributor_code` filters by it | Likely richest per-channel signal — see Spike 1 |
| Rate limit | **100 requests/minute** (error E0013) | Per-unit loops over 1,581 units cost ~16 min |
| Pagination | `get_property_list` is **not** paginated — returns all rows in one response | Inventory sync is cheap; enrichment is the expensive part |
| Permissions | `GetDistributionChannels` returns E0014 "Method is not allowed for this token" | Cannot enumerate channel definitions directly |
| Naming smell | Stage encoded in property names ("3963 E Calle San Antonio - ONBOARDING") | Audit must not depend on name parsing |

## Design Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Expected channel set | **Explicit per-unit matrix** | User direction. Precise, no rules to argue about at escalation time |
| Matrix population | **Seeded from rules, then human-owned, with drift alerts** | Day one is pre-filled and reviewable, not blank; a nightly check flags units whose Streamline status has diverged from what the matrix assumed |
| Verification depth | **Systems + config reconciliation only** | User direction. Ships in weeks, no anti-bot risk. Crawling is V2 |
| Escalation | **Slack digest + Asana tasks + dashboard + weekly scorecard feed** | User direction |
| Channel modeling | **Registry table, not enum** | Today's `CHECK (ota IN ('airbnb','vrbo','booking'))` is exactly why adding 11 channels is painful. Channel #15 becomes an INSERT |
| Systems modeling | **Systems are channels with `kind='system'`** | They answer the same question; one engine, not two |
| Niche channel default | **`expected=false` until a human turns it on** | Defaulting six unknown channels true across 1,344 units manufactures ~8,000 false gaps on day one and destroys trust in the report |
| Source failure | **Stale, never `not_live`** | An API outage must not manufacture gaps or Asana tasks |

## Architecture

### Data Model

Seven tables. All prefixed `lc_`, all service-role RLS consistent with Phase D.

#### `lc_channels` — registry

18 seed rows: 14 channels + 4 systems.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `code` | text UNIQUE | `airbnb`, `vrbo`, `booking`, `vacasa`, `casago`, `casago_az`, `casago_socal`, `midstays`, `vacation_palm_springs`, `acmehouseco`, `hopper`, `crewdogs`, `wander`, `whimstay`, `sys_wazzi`, `sys_streamline`, `sys_wheelhouse`, `sys_keydata` |
| `display_name` | text | |
| `kind` | text | `ota` \| `branded_site` \| `niche_ota` \| `system` |
| `verification_method` | text | `ota_listing_id` \| `seo_page_url` \| `flyer_url` \| `custom_field` \| `system_api` \| `none` |
| `verification_config` | jsonb | e.g. `{"field":"variable_vacasa_unit_id"}`, `{"host":"casagosocal.com"}` |
| `owner_team` | text | Asana routing |
| `audit_enabled` | boolean | Lets a channel be registered before it is auditable |

Seeding rules live in code (see Expectation Rules), not in this table.

#### `lc_unit_channel_expectation` — the matrix

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `unit_id` | uuid FK → `lc_properties` | |
| `channel_id` | uuid FK → `lc_channels` | |
| `expected` | boolean NOT NULL | |
| `expectation_source` | text | `seeded_rule` \| `human` |
| `set_by` | text | |
| `set_at` | timestamptz | |
| `note` | text | Required when `expectation_source='human'` |
| `rule_signature` | jsonb | Streamline field values at seeding: `{owning_type_id, status_id, not_show_on_website, area}` |
| `public_url` | text | Reserved for V2 crawling |

**Unique:** `(unit_id, channel_id)`

#### `lc_unit_channel_state` — current observation

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `unit_id`, `channel_id` | uuid FK | |
| `state` | text | `live` \| `not_live` \| `unknown` |
| `evidence` | text | `config` \| `listing_id` \| `system_api` \| `none` |
| `source` | text | `streamline` \| `wazzi` \| `wheelhouse` \| `keydata` |
| `detail` | jsonb | Raw values behind the determination |
| `last_checked_at` | timestamptz | Ages when a source fails — drives staleness rendering |
| `state_since` | timestamptz | |

**Unique:** `(unit_id, channel_id)`

#### `lc_unit_channel_event` — append-only transitions

`id`, `unit_id`, `channel_id`, `from_state`, `to_state`, `evidence`, `detail` jsonb,
`occurred_at`. Written only when state actually changes.

**Index:** `(occurred_at DESC)`, `(unit_id, occurred_at DESC)`

#### `lc_channel_gap` — stateful discrepancies

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `unit_id`, `channel_id` | uuid FK | |
| `gap_type` | text | `missing` \| `unexpected_live` \| `system_missing` \| `status_conflict` \| `expectation_stale` |
| `severity` | text | `high` \| `medium` \| `low`. **high** = `unexpected_live` (a unit bookable that should be dark) or a Big-3/system gap on an active+renting unit; **medium** = branded-site `missing`, `status_conflict`; **low** = `expectation_stale`, niche-channel gaps |
| `opened_at` | timestamptz | |
| `closed_at` | timestamptz | NULL while open |
| `close_reason` | text | `resolved` \| `expectation_changed` \| `unit_deactivated` |
| `asana_task_gid` | text | One task per gap, for the gap's lifetime |
| `is_baseline` | boolean | True for gaps found in the first run — suppresses individual Asana tasks |
| `detail` | jsonb | |

**Partial unique:** `(unit_id, channel_id, gap_type) WHERE closed_at IS NULL` — the constraint
that makes duplicate-task creation structurally impossible.

#### `lc_portfolio_census` — daily counts

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `census_date` | date | |
| `market` | text | `__ALL__` row for portfolio totals |
| `renting_type` | text | `renting` \| `non_renting` \| `bullpen` |
| `status` | text | `active` \| `inactive` |
| `unit_count` | int | |
| `delta_vs_prior` | int | |

**Unique:** `(census_date, market, renting_type, status)`

#### `lc_audit_run` — run records

`id`, `started_at`, `finished_at`, `mode` (`live` \| `dry_run` \| `baseline`), `status`,
`per_source_status` jsonb (`{"wheelhouse":"ok","keydata":"failed"}`), `counts` jsonb, `error`.

#### Extensions to `lc_properties`

Add `owning_type_id` int, `status_id` int, `not_show_on_website` boolean, `seo_page_url` text,
`flyer_url` text, `vacasa_unit_id` text, `location_area_name` text, `streamline_synced_at`
timestamptz.

### Expectation Rules

Used for the initial seed and for drift detection. **Not** consulted at escalation time — the
matrix is the authority.

```
if owning_type_id != 1 (Renting)        → expected = false for ALL channels
if status_id != 1 (Active)              → expected = false for ALL channels
otherwise:
  Big 3 OTAs        (airbnb, vrbo, booking)             → true
  Systems           (sys_wazzi, sys_streamline,
                     sys_wheelhouse, sys_keydata)       → true
  Direct sites      (acmehouseco, casago)               → true unless not_show_on_website = 1
  Market brand site → true unless not_show_on_website = 1:
      AZ areas   (Phoenix, Tucson, Sedona, Flagstaff,
                  Pinetop, High Desert)                 → casago_az
      CA areas   (Central Coast, Orange County,
                  Lake Arrowhead, Idyllwild/Temecula)   → casago_socal
      Palm Springs, Coachella                           → casago_socal AND
                                                          vacation_palm_springs
      null area                                         → no brand site; flag for review
  Niche  (hopper, crewdogs, wander, whimstay,
          midstays, vacasa)                             → false
```

**Drift detection:** nightly, recompute `rule_signature` for each unit and compare against the
stored value on its expectation rows. Any difference opens an `expectation_stale` gap — routed
to its own queue, never mixed with channel gaps, because the fix is "update the matrix," not
"list the property somewhere."

**Property Stage:** absent from V1. When Streamline admin flags the custom field "Show on Site,"
it enters `rule_signature` and refines the rules (Off boarding / Terminated / On Hold →
expected false everywhere). Tracked as Follow-up 1.

### Observation Logic

Per channel, `state` is derived as:

| Channel(s) | `live` when | Evidence |
|---|---|---|
| airbnb, vrbo, booking | OTA listing ID present for that OTA | `listing_id` |
| casago | `flyer_url` present AND `not_show_on_website = 0` | `config` |
| casago_az, casago_socal | `seo_page_url` host matches channel host AND `not_show_on_website = 0` | `config` |
| vacasa | `variable_vacasa_unit_id` non-empty | `config` |
| sys_streamline | unit returned by the Streamline inventory sync. A unit present in `lc_properties` but **absent** from every sync call is `not_live` → opens `system_missing`, catching deletions | `system_api` |
| sys_wazzi | row exists in `lc_properties` and `is_active` | `system_api` |
| sys_wheelhouse | listing returned by Wheelhouse `get_listings` | `system_api` |
| sys_keydata | property returned by KeyData `list_pm_properties` | `system_api` |
| acmehouseco, midstays, vacation_palm_springs, hopper, crewdogs, wander, whimstay | — | `none` → `state='unknown'` |

Seven channels resolve to `unknown` in V1. They render grey ("no evidence"), never false green.
Three of them — acmehouseco, midstays, vacation_palm_springs — become observable if Spike 1
confirms Distribution Channel Settings are readable.

**Cross-system matching:** Wheelhouse and KeyData records match on Streamline unit ID. A record
matching only by address is **not** auto-linked; it opens a `status_conflict` gap for human
confirmation. A wrong auto-match is worse than a known gap.

**`status_conflict`** fires when a system disagrees with Streamline's intent — e.g. Streamline
says Non-Renting while Wheelhouse actively prices the unit.

### Daily Job

`GET /api/cron/channel-audit`, scheduled `0 5 * * *` (ahead of the existing 6:03am agent crons).
Vercel cron entry added to `vercel.json`. Accepts `?mode=dry_run|baseline`.

**Stage 1 — Inventory sync.** Four `get_property_list` calls: active+renting; non-renting
(`owning_type_id=2, show_all_units=true`); bullpen (`owning_type_id=99, show_all_units=true`);
inactive (`status_id=2`). Each returns all rows in one response. Upsert into `lc_properties` in
chunks of 500. Units in `lc_properties` returned by none of the four are marked absent.

**Stage 2 — Enrichment.** Preferred path: one further `get_property_list` with
`additional_variables=true, show_ota_ids=true, show_registration_numbers=true` (Spike 1). Fallback:
throttled `get_property_info` loop at 90 req/min — full pass weekly, daily limited to units that
are new or whose status changed.

**Stage 3 — System inventories.** Wheelhouse `get_listings`, KeyData `list_pm_properties`, Wazzi
from Supabase. Each wrapped so a failure marks that source failed without aborting the run.

**Stage 4 — Census + deltas.** Counts by market × renting type × status; diff against the prior
census date; per-unit status transitions written to `lc_unit_channel_event`.

**Stage 5 — Reconcile.** For each unit × channel: compare expectation to state, open gaps that
should exist, close gaps that no longer apply. Then drift detection.

**Stage 6 — Notify.** Slack digest, Asana sync, weekly rollup on Mondays.

**Failure handling.** A failed source leaves its states untouched — `last_checked_at` ages, the
cell renders stale, and no gap opens or closes from that source. `per_source_status` records it
and the digest states it plainly.

### Outputs

**Slack digest (6:00am).** Census with deltas → named status flips overnight → channel coverage
table (expected / live / missing / unknown per channel) → new gaps today → gaps aged >7 days →
any failed source → link to the dashboard. Uses the existing `src/lib/slack.ts`.

**Asana.** One task per gap, routed by `lc_channels.owner_team` + market. Title: `Missing from
VRBO — {unit name} ({market})`. Body: evidence, why expected, deep link. On close: comment and
complete. Guards: baseline gaps produce **one summary task per market** (13) instead of
thousands; post-baseline creation caps at **25 tasks/day** with overflow rolled into a single
digest task.

**Dashboard** (extends `/listings`):
- Census strip with deltas
- **Channel coverage matrix** — per channel: expected, live, missing, unknown, coverage %.
  `coverage % = live ÷ expected`, with `unknown` counted against coverage (not silently
  excluded) but always displayed as its own column so a low score reads as "unverified" rather
  than "broken"
- Gap queue, filterable by channel / market / gap type / age
- Unit detail: 18-cell expectation-vs-state grid with evidence and last-checked per cell, and
  **inline matrix editing** — expectation is edited next to its consequence

**Weekly rollup.** Token-authenticated `GET /api/audit/weekly` returning coverage % per channel,
gaps opened/closed, median days-to-close, and census trend. Computed on request from
`lc_portfolio_census`, `lc_channel_gap`, and `lc_unit_channel_state` — no additional rollup
table, since those three already hold every input. Consumed by `scorecard.casagod2c.com`, a
separate application that pulls from this endpoint.

## Testing

- **Unit:** expectation derivation across the rule matrix (including null-area and Bullpen
  units); gap open/close/dedup including the partial-unique constraint; census delta math
  including first-day (no prior) and market-appearing/disappearing cases.
- **Fixture:** captured real Streamline payloads (active+renting 1,344; non-renting 237; a
  single `get_property_info` with custom fields) drive the sync and observation logic.
- **Failure-path:** a failed source leaves states untouched and opens zero gaps — the highest
  value test in the suite.
- **Dry-run:** computes everything, writes an `lc_audit_run` record, sends nothing. Used to
  rehearse the baseline before it touches Asana.

## Rollout

1. Migration + registry seed (18 channels).
2. Inventory sync alone, run once — closes the ~280-unit staleness. Verify count reconciles
   to 1,344 / 237.
3. Matrix seed from rules. Review a sample per market before proceeding.
4. Observation + reconciliation, `mode=dry_run`. Review gap counts for plausibility.
5. `mode=baseline` — opens gaps, creates 13 summary tasks.
6. Enable daily cron, Slack digest, per-gap Asana tasks.
7. Weekly rollup endpoint + scorecard consumption.

## Success Criteria

- `lc_properties` reconciles to Streamline within 1 unit, verified daily.
- Every active+renting unit has 18 expectation rows.
- Daily job completes in under 10 minutes.
- Census and day-over-day status deltas published to Slack every morning.
- Channel coverage % per channel visible on one screen.
- Zero duplicate Asana tasks for a given open gap.
- A simulated source outage produces zero gaps and zero tasks.

## Open Items

**Spike 1 (do first, 30 min).** Confirm whether `get_property_list` with
`additional_variables=true, show_ota_ids=true, show_registration_numbers=true` returns the
enrichment fields in bulk. If yes, the daily sync is ~4 calls and three currently-`unknown`
channels may become observable. If no, the throttled weekly enrichment fallback applies.

**Spike 2.** Confirm the Wheelhouse and KeyData identifiers that join to Streamline unit IDs,
and measure how many records join cleanly vs. fall to address matching.

**Follow-up 1.** Streamline admin to flag Property Stage and Property Status "Show on Site" so
they enter the API. Refines expectation rules; not a V1 blocker.

**Follow-up 2.** The 2 units with `location_area_name: null` need an area assigned in Streamline
before brand-site expectation can be derived for them.

**Follow-up 3.** Ops to confirm intended distribution for Hopper, Crewdogs, Wander, Whimstay,
Midstays, and Vacasa so the matrix can be flipped on per unit. Until then those channels report
expectation-off and are excluded from coverage %.

**Assumption.** `scorecard.casagod2c.com` is a separate application that will pull
`GET /api/audit/weekly`. If it instead reads Supabase directly, the endpoint is unnecessary and
the weekly table alone suffices.

## Deferred to V2

- URL crawling for all 14 channels — turns `unknown` into verified, and catches the case where
  config is correct but the listing is dark.
- Per-unit public URL discovery for channels lacking a stored URL.
- Impressions, discount counts, content configuration — the "later" items explicitly parked.
