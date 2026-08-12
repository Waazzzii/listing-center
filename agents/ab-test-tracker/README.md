# Agent 7: A/B Test Tracker

## Purpose

Manages the full lifecycle of listing A/B tests: creation, snapshot capture, soak period management, result calculation, and pattern learning.

## Trigger

- **Scheduled:** Weekly (via Wazzi agent platform)
- **On-demand:** When a new test is created or a snapshot is manually requested

## Entry Point

`run-tracker.ts` — processes all non-terminal tests, captures due snapshots, calculates results.

## State Machine

```
pending -> active -> snapshot_due -> completed
                                  -> cancelled (manual)
```

- **pending:** Test created, waiting for before snapshot + change execution
- **active:** Change executed, soak period running
- **snapshot_due:** Soak period elapsed, after snapshot needed
- **completed:** After snapshot captured, result calculated

## Soak Periods by Test Type

| Test Type | Soak Period | Min Impressions | Snapshot Method |
|-----------|-------------|-----------------|-----------------|
| hero_photo | 14 days | 3,000 | Future-date range |
| title | 14 days | 3,000 | Future-date range |
| description | 28 days | 3,000 | Future-date range |
| cancellation_policy | 28 days | N/A | 10-day trailing |
| amenities | 14 days | 3,000 | Future-date range |
| pricing | 28 days | 3,000 | Trailing + forward |
| checkout_time | 28 days | 3,000 | Trailing + forward |

## Result Calculation

```
metric_lift = ((after_value - before_value) / before_value) * 100

positive:  lift > +5%
negative:  lift < -5%
no_change: -5% to +5% (noise band)
```

## Learning Engine

Aggregates patterns from all completed tests:
- Groups by test_type (and optionally by market/tier)
- Calculates success rate, average lift, confidence score
- Pattern eligible for Phase 3 autonomy when: 80%+ success across 10+ tests

## Files

- `snapshot-manager.ts` — Before/after metric capture, soak period config, result calculation
- `test-lifecycle.ts` — State machine logic
- `run-tracker.ts` — Orchestrator, processes all active tests
- `learning-engine.ts` — Pattern aggregation and autonomy scoring

## Dependencies

- `lc_ab_tests` table (Supabase)
- `lc_metric_snapshots` / `lc_latest_snapshots` views
- `lc_agent_executions` for run logging
