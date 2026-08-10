# Listing Health Check — How It Works

**For:** Tom Feldhausen, Hayley, Larissa Pederson
**From:** Jason Pratts
**Status:** Running daily since 2026-08-08

---

## Why this exists

We had no reliable way to answer a basic question on any given day: **is every unit
actually live everywhere it should be, and set up correctly in the systems behind it?**

We were finding gaps by accident. A property would sit dark on VRBO for weeks, or keep
earning while its performance went untracked, and nobody knew until someone happened to
look. This runs that check every morning across all 1,344 renting units and tells us what
changed since yesterday.

## How it runs

| | |
|---|---|
| **Schedule** | Every morning, automatically |
| **Sources** | Streamline, Wazzi Data, KeyData, Reva (Wheelhouse pending — see Blocked) |
| **Outputs** | A dashboard that refreshes at the same link, and a post to `#revenue-pulse` |
| **History** | Every run is saved, so day-over-day change is tracked automatically |

The Slack post is generated directly from the audit, not written by hand, so the numbers in
Slack always match the dashboard exactly.

## What we're trying to catch

Four categories. The distinction that matters: some of these cost us bookings today, some
misroute money, and some are hygiene that becomes a problem later.

### Distribution — are we visible and sellable?

| Check | Severity | What it catches |
|---|---|---|
| No Airbnb listing ID | High | Renting unit with no Airbnb listing recorded |
| No VRBO listing ID | High | Same for VRBO |
| Dark on every verified OTA | High | Invisible on **both** majors — earning nothing from OTAs |
| Online bookings disabled | High | Streamline will not accept an online booking at all |
| Guest reviews but no listing ID | High | Guests are booking and reviewing, but we have no ID recorded — the listing works, our record of it is wrong |
| No guest reviews in 90 days | Low | Listed but quiet. Often just low season — a prompt to look, not a fault |

### Systems — is the unit set up where it needs to be?

| Check | Severity | What it catches |
|---|---|---|
| Not active in KeyData | High | Renting, but performance isn't being tracked |
| Active in KeyData, not renting in Streamline | Medium | KeyData tracking something we don't rent — offices, test units, off-boarded homes |
| Missing from Wazzi Data | Medium | In Streamline but absent from our own database |
| In Wazzi Data, not in Streamline | Medium | The reverse — a stale record |
| Not in Wheelhouse / inactive / rate posting off | High–Med | Not being revenue-managed, or Wheelhouse prices never reach the unit |

### Accounting — is money routing correctly?

| Check | Severity | What it catches |
|---|---|---|
| No merchant / payment gateway | High | No confirmed destination account for revenue |
| No COPS account/bank ID | Medium | Missing account IDs — **only applied in markets that use them**, currently Palm Springs |

### Classification — is the unit filed correctly?

| Check | Severity | What it catches |
|---|---|---|
| No area assigned | High | Can't be routed to a brand site or region |
| Property group / state mismatch | High | An AZ unit filed under a CA group — misroutes reporting and accounting |
| No property group assigned | Medium | Breaks reporting and accounting rollups |
| Stage says Live but unit is Non-Renting | Medium | Property Stage and Renting Type disagree — both drive whether a unit should be selling |
| No Property Stage set | Low | Can't tell whether the unit is meant to be live, onboarding or off-boarding |
| No neighborhood / location resort | Low | Affects site placement and search |

### Property Stage — how it's used

Units in **Onboarding** are excluded from the audit entirely: they're dark on purpose, so
flagging them is noise. Excluding them removed the two false alarms that were topping the
worklist on day one.

Two things worth knowing about how this behaves:

- **A unit with no stage set is never excluded.** 256 renting units have no value yet, and
  treating "no value" as "skip" would silently drop a fifth of the portfolio. They're
  audited as if they should be selling, and flagged separately so the gap is visible.
- **Exclusions are always stated** on the dashboard and in the Slack post. A property never
  disappears from the report without the reason showing.

Current stage coverage: Live 1,177 · Onboarding 13 · Terminated 2 · Off boarding 1 ·
**no value 256**. The missing 256 follow no pattern — coverage is 74–83% across every
unit-age band and proportional across all 13 markets. The field simply hasn't been
completed.

## How priority works

The dashboard and the Slack post both open with **Top properties to look at** — the ten
units most worth someone's time today, not a wall of counts.

Ranking weights each finding by revenue impact **and** by how cheap the fix is. A listing
that's already selling but unmapped outranks a dark listing that needs rebuilding, because
one is a two-minute data edit and the other is a project. A unit accumulating several
findings rises accordingly.

Two deliberate adjustments:

- **Onboarding units are scored down.** They're dark on purpose; they shouldn't crowd out
  genuine faults.
- **KeyData cleanup items are excluded entirely.** Deactivating an office in KeyData is
  admin work, not a revenue-earning property.

## What this report will not do

This matters more than the checks themselves. A daily report that cries wolf gets ignored
inside a week, so the audit is deliberately conservative:

- **It never reports a missing source as a missing listing.** If an API fails or returns
  incomplete data, those checks read *"not checked"* — never *"no problems found."*
- **Every check reports how many units it actually inspected**, so a low number is never
  mistaken for full coverage.
- **Branded sites are confirm-only.** KeyData holds one canonical URL per unit, so a
  Casago.com URL proves that unit is on Casago.com but says nothing about CasagoSoCal.
  Unconfirmed reads *unknown*, never *missing*.
- **Market-specific rules only apply where they're used.** The COPS ID check would have
  flagged 1,069 units portfolio-wide; scoped to the market that actually uses the field,
  the real number is 126.
- **Weak signals are labelled weak.** "No reviews in 90 days" is usually low season, not a
  broken listing, and is marked low severity accordingly.

## Where we stand today (2026-08-10)

| | |
|---|---|
| Active & renting | 1,344 |
| Non-renting | 237 |
| High-severity flags | 71 |
| Dark on both Airbnb and VRBO | 11 (2 are onboarding; 9 are real) |
| Live and selling but unmapped | 2 — Gallaher, Bear's Den |
| Renting but not tracked in KeyData | 6 (down from 26 on day one) |
| Active in KeyData but not renting | 63 — 6 offices/test units, 57 off-boarded |
| In Wazzi Data but not Streamline | 6 |

Guest reviews in the last 90 days confirm 483 units live on Airbnb and 190 on VRBO.
**Booking.com has produced zero reviews in six months** and has no listing IDs recorded,
which suggests we effectively have no Booking.com presence.

## Blocked, and what would unblock it

**Streamline API credentials** would switch on four checks that are built and waiting:
merchant/payment gateway, property group, neighborhood, and location resort. Today we can
only inspect these on a fraction of the portfolio because the current connection can't
carry the volume.

**Wheelhouse ID mapping.** Wheelhouse listing IDs don't match Streamline unit IDs, so those
three checks report "not checked" rather than a misleading clean result. Once we know how
the two systems join, they switch on.

**Three questions for the team:**

1. **Which channels should each unit actually be on?** Today the audit assumes Airbnb,
   VRBO, Booking, and the relevant branded sites for every renting unit, and assumes the
   niche channels (Hopper, Crewdogs, Wander, Whimstay, Midstays, Vacasa) are off unless
   told otherwise. If that's wrong for any market, the gap counts are wrong with it.
2. **Is the COPS account/bank ID a Palm Springs convention or a portfolio standard?** It's
   used on 309 of 467 Palm Springs units and nowhere else.
3. **Should Terminated and Off boarding also be excluded?** Only Onboarding is excluded
   today. Those two cover 3 units between them, so the impact is small either way — but
   the rule should be deliberate.

## The pattern worth fixing, not just the numbers

The 57 off-boarded properties still active in KeyData point at a process gap rather than a
data problem: **there's no deactivation step in KeyData when a unit goes non-renting.**
Cleaning up the 57 fixes today. Adding that step to the off-boarding checklist stops it
rebuilding over the next six months — and now we'll see it happening day by day either way.
