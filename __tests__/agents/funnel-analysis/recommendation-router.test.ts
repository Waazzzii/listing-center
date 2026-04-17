import { describe, it, expect } from 'vitest';
import {
  generateRecommendations,
  type RecommendationDraft,
} from '../../../agents/funnel-analysis/recommendation-router';
import type { FunnelDiagnosis, FunnelIssue, FunnelOpportunity } from '../../../agents/funnel-analysis/analyzer';

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

const propertyContext = {
  property_id: 'prop-1',
  property_name: 'Desert Oasis Villa',
  market: 'scottsdale',
  quality_tier: 'gold',
};

describe('generateRecommendations', () => {
  it('returns empty array for skipped diagnosis', () => {
    const diag = makeDiagnosis({ skipped: true });
    const result = generateRecommendations(diag, propertyContext);
    expect(result).toEqual([]);
  });

  it('returns empty array for green status with no opportunities', () => {
    const diag = makeDiagnosis();
    const result = generateRecommendations(diag, propertyContext);
    expect(result).toEqual([]);
  });

  it('generates pricing recommendation for top-of-funnel critical issue', () => {
    const diag = makeDiagnosis({
      issues: [{
        stage: 'top',
        severity: 'critical',
        diagnosis: 'Under-represented in Airbnb search',
        likely_causes: ['Price too high vs value index'],
        route_to: 'pricing_policy',
      }],
      funnel_bottleneck: 'top',
    });
    const result = generateRecommendations(diag, propertyContext);
    expect(result.length).toBeGreaterThanOrEqual(1);
    expect(result[0].agent_name).toBe('funnel_analysis');
    expect(result[0].funnel_stage).toBe('top');
    expect(result[0].severity).toBe('critical');
    expect(result[0].property_id).toBe('prop-1');
    // Should recommend pricing or cancellation policy changes
    expect(['price_decrease', 'cancellation_change'].some(t =>
      result.some(r => r.recommendation_type === t)
    )).toBe(true);
  });

  it('generates hero photo recommendation for mid-funnel issue', () => {
    const diag = makeDiagnosis({
      issues: [{
        stage: 'mid',
        severity: 'high',
        diagnosis: 'Hero photo or title not converting',
        likely_causes: ['Hero photo crops poorly to thumbnail'],
        route_to: 'content_optimizer',
      }],
      funnel_bottleneck: 'mid',
    });
    const result = generateRecommendations(diag, propertyContext);
    expect(result.length).toBeGreaterThanOrEqual(1);
    const photoRec = result.find(r => r.recommendation_type === 'hero_photo_swap');
    expect(photoRec).toBeDefined();
    expect(photoRec!.funnel_stage).toBe('mid');
  });

  it('generates description and amenity recommendations for bottom-of-funnel issue', () => {
    const diag = makeDiagnosis({
      issues: [{
        stage: 'bottom',
        severity: 'high',
        diagnosis: 'Visitors are clicking but not booking',
        likely_causes: ['Missing amenity photos', 'Description gaps'],
        route_to: 'content_optimizer',
      }],
      funnel_bottleneck: 'bottom',
    });
    const result = generateRecommendations(diag, propertyContext);
    expect(result.length).toBeGreaterThanOrEqual(1);
    // Should include description_update or amenity_add
    expect(result.some(r =>
      r.recommendation_type === 'description_update' || r.recommendation_type === 'amenity_add'
    )).toBe(true);
  });

  it('generates price increase recommendation for value capture opportunity', () => {
    const diag = makeDiagnosis({
      opportunities: [{
        stage: 'bottom',
        type: 'value_capture',
        diagnosis: 'Converting at premium rate — under-priced',
        route_to: 'pricing_policy',
      }],
    });
    const result = generateRecommendations(diag, propertyContext);
    expect(result.length).toBeGreaterThanOrEqual(1);
    const priceRec = result.find(r => r.recommendation_type === 'price_increase');
    expect(priceRec).toBeDefined();
    expect(priceRec!.severity).toBe('opportunity');
  });

  it('generates recommendations for multiple issues at once', () => {
    const diag = makeDiagnosis({
      issues: [
        { stage: 'top', severity: 'critical', diagnosis: 'test', likely_causes: [], route_to: 'pricing_policy' },
        { stage: 'mid', severity: 'high', diagnosis: 'test', likely_causes: [], route_to: 'content_optimizer' },
      ],
      funnel_bottleneck: 'top',
    });
    const result = generateRecommendations(diag, propertyContext);
    // Should have at least one recommendation per issue
    expect(result.length).toBeGreaterThanOrEqual(2);
    expect(result.some(r => r.funnel_stage === 'top')).toBe(true);
    expect(result.some(r => r.funnel_stage === 'mid')).toBe(true);
  });

  it('all recommendations have required fields populated', () => {
    const diag = makeDiagnosis({
      issues: [{
        stage: 'mid',
        severity: 'high',
        diagnosis: 'Hero photo problem',
        likely_causes: ['test'],
        route_to: 'content_optimizer',
      }],
      funnel_bottleneck: 'mid',
    });
    const result = generateRecommendations(diag, propertyContext);
    for (const rec of result) {
      expect(rec.property_id).toBe('prop-1');
      expect(rec.agent_name).toBe('funnel_analysis');
      expect(rec.recommendation_type).toBeTruthy();
      expect(rec.title).toBeTruthy();
      expect(rec.description).toBeTruthy();
      expect(rec.funnel_stage).toBeTruthy();
      expect(rec.severity).toBeTruthy();
      expect(rec.status).toBe('pending');
    }
  });
});
