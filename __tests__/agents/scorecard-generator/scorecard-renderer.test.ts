import { describe, it, expect } from 'vitest';
import {
  renderScorecardHtml,
  type ScorecardData,
} from '../../../agents/scorecard-generator/scorecard-renderer';

const mockScorecard: ScorecardData = {
  metadata: {
    property_name: 'Desert Oasis Villa',
    report_month: '2026-03-01',
    market: 'scottsdale',
    quality_tier: 'gold',
    generated_at: '2026-04-06T10:00:00Z',
  },
  listing_health: {
    health_status: 'green',
    impression_rate: { current: 58.0, prior_month: 62.0, change: -4.0 },
    ctr: { current: 18.5, prior_month: 15.0, change: 3.5 },
    conversion: { current: 3.2, prior_month: 2.8, change: 0.4 },
    occupancy: { current: 72.0, prior_month: 65.0, change: 7.0 },
    adr: { current: 385.0, prior_month: 370.0, change: 15.0 },
    nights_booked: { current: 22, prior_month: 18, change: 4 },
    overall_rating: 4.89,
    page_views: { current: 450, prior_month: 380, change: 70 },
    wishlist_additions: { current: 22, prior_month: 18, change: 4 },
  },
  reviews: {
    total_this_month: 2,
    avg_rating_this_month: 4.5,
    positive_count: 2,
    neutral_count: 0,
    negative_count: 0,
    highlights: [
      { guest_name: 'John D.', rating: 5, sentiment: 'positive' },
    ],
  },
  optimizations: {
    changes_made: [
      {
        change_type: 'hero_photo',
        change_date: '2026-03-05',
        thesis: 'Aerial pool shot',
        status: 'completed',
      },
    ],
    total_changes: 1,
  },
  competitive_context: {
    vs_benchmark: {
      impression_rate: 'in_range',
      ctr: 'in_range',
      conversion: 'in_range',
    },
    tier_label: 'Gold Tier',
    market_label: 'Scottsdale',
  },
  upcoming_actions: [
    {
      title: 'Description update recommended',
      severity: 'medium',
      funnel_stage: 'bottom',
    },
  ],
};

describe('renderScorecardHtml', () => {
  it('returns a valid HTML string', () => {
    const html = renderScorecardHtml(mockScorecard);
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('</html>');
  });

  it('includes property name in the output', () => {
    const html = renderScorecardHtml(mockScorecard);
    expect(html).toContain('Desert Oasis Villa');
  });

  it('includes all five scorecard sections', () => {
    const html = renderScorecardHtml(mockScorecard);
    expect(html).toContain('Listing Health');
    expect(html).toContain('Review');
    expect(html).toContain('Optimization');
    expect(html).toContain('Competitive');
    expect(html).toContain('Upcoming');
  });

  it('includes metric values', () => {
    const html = renderScorecardHtml(mockScorecard);
    expect(html).toContain('58');   // impression rate
    expect(html).toContain('18.5'); // CTR
    expect(html).toContain('3.2');  // conversion
    expect(html).toContain('4.89'); // rating
  });

  it('includes MoM change indicators', () => {
    const html = renderScorecardHtml(mockScorecard);
    expect(html).toContain('+3.5');  // CTR improved
    expect(html).toContain('-4');    // Impression rate declined
  });

  it('includes report month', () => {
    const html = renderScorecardHtml(mockScorecard);
    expect(html).toContain('March 2026');
  });

  it('includes benchmark badges', () => {
    const html = renderScorecardHtml(mockScorecard);
    expect(html).toContain('In Range');
  });

  it('includes upcoming actions', () => {
    const html = renderScorecardHtml(mockScorecard);
    expect(html).toContain('Description update recommended');
  });

  it('handles empty optimizations', () => {
    const noOpts = {
      ...mockScorecard,
      optimizations: { changes_made: [], total_changes: 0 },
    };
    const html = renderScorecardHtml(noOpts);
    expect(html).toContain('No changes made this month');
  });

  it('handles empty upcoming actions', () => {
    const noActions = { ...mockScorecard, upcoming_actions: [] };
    const html = renderScorecardHtml(noActions);
    expect(html).toContain('No pending actions');
  });
});
