import { describe, it, expect } from 'vitest';
import { calculatePriority, type PriorityInput } from '../../../agents/funnel-analysis/priority-scorer';

describe('calculatePriority', () => {
  it('returns 0 for a property with no issues and no opportunities', () => {
    const input: PriorityInput = {
      adr: 350,
      projected_occupancy_lift_pct: 0,
      remaining_season_days: 90,
      max_severity: null,
      effort: 'medium',
      issue_count: 0,
      opportunity_count: 0,
    };
    expect(calculatePriority(input)).toBe(0);
  });

  it('calculates higher priority for high ADR properties', () => {
    const baseInput: PriorityInput = {
      adr: 200,
      projected_occupancy_lift_pct: 10,
      remaining_season_days: 90,
      max_severity: 'critical',
      effort: 'medium',
      issue_count: 1,
      opportunity_count: 0,
    };
    const highAdr: PriorityInput = { ...baseInput, adr: 600 };
    const lowAdr: PriorityInput = { ...baseInput, adr: 200 };
    expect(calculatePriority(highAdr)).toBeGreaterThan(calculatePriority(lowAdr));
  });

  it('calculates higher priority for critical vs high severity', () => {
    const base: PriorityInput = {
      adr: 350,
      projected_occupancy_lift_pct: 10,
      remaining_season_days: 90,
      max_severity: 'critical',
      effort: 'medium',
      issue_count: 1,
      opportunity_count: 0,
    };
    const critical = calculatePriority({ ...base, max_severity: 'critical' });
    const high = calculatePriority({ ...base, max_severity: 'high' });
    const medium = calculatePriority({ ...base, max_severity: 'medium' });
    expect(critical).toBeGreaterThan(high);
    expect(high).toBeGreaterThan(medium);
  });

  it('calculates higher priority when more season days remain', () => {
    const base: PriorityInput = {
      adr: 350,
      projected_occupancy_lift_pct: 10,
      remaining_season_days: 30,
      max_severity: 'high',
      effort: 'medium',
      issue_count: 1,
      opportunity_count: 0,
    };
    const moreDays = calculatePriority({ ...base, remaining_season_days: 120 });
    const fewerDays = calculatePriority({ ...base, remaining_season_days: 30 });
    expect(moreDays).toBeGreaterThan(fewerDays);
  });

  it('calculates lower priority for high effort changes', () => {
    const base: PriorityInput = {
      adr: 350,
      projected_occupancy_lift_pct: 10,
      remaining_season_days: 90,
      max_severity: 'high',
      effort: 'low',
      issue_count: 1,
      opportunity_count: 0,
    };
    const lowEffort = calculatePriority({ ...base, effort: 'low' });
    const highEffort = calculatePriority({ ...base, effort: 'high' });
    expect(lowEffort).toBeGreaterThan(highEffort);
  });

  it('gives priority to value capture opportunities (yellow status)', () => {
    const input: PriorityInput = {
      adr: 500,
      projected_occupancy_lift_pct: 0,
      remaining_season_days: 90,
      max_severity: null,
      effort: 'low',
      issue_count: 0,
      opportunity_count: 2,
    };
    // Opportunities should still generate a non-zero score
    expect(calculatePriority(input)).toBeGreaterThan(0);
  });

  it('handles zero ADR gracefully', () => {
    const input: PriorityInput = {
      adr: 0,
      projected_occupancy_lift_pct: 10,
      remaining_season_days: 90,
      max_severity: 'critical',
      effort: 'medium',
      issue_count: 1,
      opportunity_count: 0,
    };
    // Should not throw, score should use default ADR
    expect(calculatePriority(input)).toBeGreaterThan(0);
  });

  it('handles null ADR by using default 250', () => {
    const input: PriorityInput = {
      adr: null as any,
      projected_occupancy_lift_pct: 10,
      remaining_season_days: 90,
      max_severity: 'critical',
      effort: 'medium',
      issue_count: 1,
      opportunity_count: 0,
    };
    const result = calculatePriority(input);
    expect(result).toBeGreaterThan(0);
  });
});
