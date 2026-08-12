import { describe, it, expect } from 'vitest';
import {
  findPendingRatings,
  buildRatingPayload,
  categorizeByUrgency,
  type PendingRating,
} from '../../../agents/review-manager/guest-rating-submitter';

describe('buildRatingPayload', () => {
  it('always returns 5 stars', () => {
    const payload = buildRatingPayload('John Doe', 'prop-1');
    expect(payload.rating).toBe(5);
  });

  it('includes a review text', () => {
    const payload = buildRatingPayload('Jane Smith', 'prop-2');
    expect(payload.review_text).toBeTruthy();
    expect(payload.review_text.length).toBeGreaterThan(10);
  });

  it('uses guest name in review text', () => {
    const payload = buildRatingPayload('Maria Garcia', 'prop-3');
    expect(payload.review_text).toContain('Maria');
  });
});

describe('categorizeByUrgency', () => {
  const today = new Date('2026-04-06');

  it('marks ratings due within 2 days as urgent', () => {
    const ratings: PendingRating[] = [
      { id: 'r1', property_id: 'p1', airbnb_account_id: 1, guest_name: 'Guest A', checkout_date: '2026-03-24', rating_deadline: '2026-04-07', submission_status: 'pending' },
    ];
    const result = categorizeByUrgency(ratings, today);
    expect(result.urgent).toHaveLength(1);
    expect(result.normal).toHaveLength(0);
  });

  it('marks ratings due in 3+ days as normal', () => {
    const ratings: PendingRating[] = [
      { id: 'r2', property_id: 'p2', airbnb_account_id: 1, guest_name: 'Guest B', checkout_date: '2026-03-26', rating_deadline: '2026-04-09', submission_status: 'pending' },
    ];
    const result = categorizeByUrgency(ratings, today);
    expect(result.urgent).toHaveLength(0);
    expect(result.normal).toHaveLength(1);
  });

  it('marks ratings past deadline as overdue', () => {
    const ratings: PendingRating[] = [
      { id: 'r3', property_id: 'p3', airbnb_account_id: 1, guest_name: 'Guest C', checkout_date: '2026-03-20', rating_deadline: '2026-04-03', submission_status: 'pending' },
    ];
    const result = categorizeByUrgency(ratings, today);
    expect(result.overdue).toHaveLength(1);
  });

  it('handles mixed urgency levels', () => {
    const ratings: PendingRating[] = [
      { id: 'r1', property_id: 'p1', airbnb_account_id: 1, guest_name: 'A', checkout_date: '2026-03-20', rating_deadline: '2026-04-03', submission_status: 'pending' },
      { id: 'r2', property_id: 'p2', airbnb_account_id: 1, guest_name: 'B', checkout_date: '2026-03-24', rating_deadline: '2026-04-07', submission_status: 'pending' },
      { id: 'r3', property_id: 'p3', airbnb_account_id: 1, guest_name: 'C', checkout_date: '2026-03-28', rating_deadline: '2026-04-11', submission_status: 'pending' },
    ];
    const result = categorizeByUrgency(ratings, today);
    expect(result.overdue).toHaveLength(1);
    expect(result.urgent).toHaveLength(1);
    expect(result.normal).toHaveLength(1);
  });
});

describe('findPendingRatings', () => {
  it('is a function (Supabase integration — tested via run-review-manager)', () => {
    expect(typeof findPendingRatings).toBe('function');
  });
});
