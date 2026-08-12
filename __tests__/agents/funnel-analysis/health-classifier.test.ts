import { describe, it, expect } from 'vitest';
import { classifyHealth, type HealthClassification } from '../../../agents/funnel-analysis/health-classifier';
import type { FunnelDiagnosis } from '../../../agents/funnel-analysis/analyzer';

function makeDiagnosis(overrides: Partial<FunnelDiagnosis> = {}): FunnelDiagnosis {
  return {
    skipped: false,
    health_status: 'green',
    issues: [],
    opportunities: [],
    funnel_bottleneck: 'none',
    ...overrides,
  };
}

describe('classifyHealth', () => {
  it('returns unknown for skipped diagnoses', () => {
    const diag = makeDiagnosis({ skipped: true, skipped_reason: 'partial_data' });
    const result = classifyHealth(diag, { market_occupancy: 70 });
    expect(result.health_status).toBe('unknown');
  });

  it('classifies as red when any issue has critical severity', () => {
    const diag = makeDiagnosis({
      issues: [
        { stage: 'top', severity: 'critical', diagnosis: 'test', likely_causes: [], route_to: 'pricing_policy' },
      ],
      funnel_bottleneck: 'top',
    });
    const result = classifyHealth(diag, { market_occupancy: 70 });
    expect(result.health_status).toBe('red');
  });

  it('classifies as orange when issues are high severity but not critical', () => {
    const diag = makeDiagnosis({
      issues: [
        { stage: 'mid', severity: 'high', diagnosis: 'test', likely_causes: [], route_to: 'content_optimizer' },
      ],
      funnel_bottleneck: 'mid',
    });
    const result = classifyHealth(diag, { market_occupancy: 70 });
    expect(result.health_status).toBe('orange');
  });

  it('classifies as yellow when there are value capture opportunities but no issues', () => {
    const diag = makeDiagnosis({
      opportunities: [
        { stage: 'top', type: 'value_capture', diagnosis: 'test', route_to: 'pricing_policy' },
      ],
    });
    const result = classifyHealth(diag, { market_occupancy: 70 });
    expect(result.health_status).toBe('yellow');
  });

  it('classifies as green when all metrics are in range with no issues or opportunities', () => {
    const diag = makeDiagnosis();
    const result = classifyHealth(diag, { market_occupancy: 70 });
    expect(result.health_status).toBe('green');
  });

  it('classifies as blue_spell when market occupancy exceeds 90%', () => {
    const diag = makeDiagnosis();
    const result = classifyHealth(diag, { market_occupancy: 93 });
    expect(result.health_status).toBe('blue_spell');
  });

  it('blue_spell overrides green but not red', () => {
    const diagCritical = makeDiagnosis({
      issues: [
        { stage: 'top', severity: 'critical', diagnosis: 'test', likely_causes: [], route_to: 'pricing_policy' },
      ],
      funnel_bottleneck: 'top',
    });
    const result = classifyHealth(diagCritical, { market_occupancy: 95 });
    // Red stays red even during blue spell — the listing is still broken
    expect(result.health_status).toBe('red');
    expect(result.is_blue_spell).toBe(true);
  });

  it('blue_spell overrides orange — market will compensate', () => {
    const diagHigh = makeDiagnosis({
      issues: [
        { stage: 'mid', severity: 'high', diagnosis: 'test', likely_causes: [], route_to: 'content_optimizer' },
      ],
      funnel_bottleneck: 'mid',
    });
    const result = classifyHealth(diagHigh, { market_occupancy: 92 });
    // During blue spell, orange gets upgraded — market demand compensates for moderate issues
    expect(result.health_status).toBe('blue_spell');
    expect(result.is_blue_spell).toBe(true);
    expect(result.underlying_status).toBe('orange');
  });

  it('tracks previous health status for change detection', () => {
    const diag = makeDiagnosis();
    const result = classifyHealth(diag, { market_occupancy: 70, previous_health_status: 'orange' });
    expect(result.previous_health_status).toBe('orange');
    expect(result.status_changed).toBe(true);
  });

  it('detects no change when status is the same', () => {
    const diag = makeDiagnosis();
    const result = classifyHealth(diag, { market_occupancy: 70, previous_health_status: 'green' });
    expect(result.status_changed).toBe(false);
  });

  it('uses null market_occupancy gracefully (no blue spell check)', () => {
    const diag = makeDiagnosis();
    const result = classifyHealth(diag, { market_occupancy: null });
    expect(result.health_status).toBe('green');
    expect(result.is_blue_spell).toBe(false);
  });
});
