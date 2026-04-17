# Agent 8: Owner Scorecard Generator

## Purpose

Generates monthly per-property listing scorecards that provide owners with a clear, professional summary of their property's performance. This is a key differentiator — no other VRM company offers this level of data-driven transparency to owners.

## Cadence

- **Monthly** — runs on the 1st of each month (or on-demand via UI)
- Generates scorecards for the **previous** month

## Data Sources

| Source | Table | What It Provides |
|--------|-------|-----------------|
| Metric Snapshots | `lc_metric_snapshots` | Latest + prior month metrics for MoM comparison |
| Reviews | `lc_reviews` | Monthly review count, ratings, sentiment |
| Change Log | `lc_change_log` | Optimizations made during the month |
| Recommendations | `lc_recommendations` | Pending actions (upcoming work) |
| Benchmarks | `lc_benchmarks` | Tier-based performance positioning |

## Scorecard Sections

1. **Listing Health** — Key funnel metrics (impression rate, CTR, conversion, occupancy, ADR, rating) with month-over-month changes
2. **Reviews** — Count, average rating, sentiment breakdown, highlights
3. **Optimizations Made** — Changes executed this month with rationale
4. **Competitive Context** — How the property compares to benchmark for its tier and market
5. **Upcoming Actions** — Pending recommendations that will be addressed

## Output

- Scorecard data stored as JSONB in `lc_owner_scorecards.scorecard_data`
- HTML rendering via `scorecard-renderer.ts` for PDF generation (Puppeteer)
- React preview via `ScorecardTemplate.tsx` for in-app review

## Files

| File | Purpose |
|------|---------|
| `scorecard-builder.ts` | Assembles scorecard JSON from multiple data sources |
| `scorecard-renderer.ts` | Generates HTML and PDF output |
| `run-scorecard-generator.ts` | Monthly orchestrator — iterates all properties |

## Status Flow

```
pending → generated → reviewed → sent
                    → failed (retry)
```

## Delivery (Phase 4 — TBD)

PDF delivery infrastructure is placeholder. Future options:
- Email via SendGrid/Postmark
- Owner portal download
- Slack notification with PDF attachment
