import { describe, it, expect } from 'vitest';
import {
  selectTemplate,
  interpolateTemplate,
  classifyReviewSentiment,
  shouldAutoPost,
} from '../../../agents/review-manager/review-response-drafter';

describe('classifyReviewSentiment', () => {
  it('classifies 5-star as positive', () => {
    expect(classifyReviewSentiment(5.0)).toBe('positive');
  });

  it('classifies 4-star as positive', () => {
    expect(classifyReviewSentiment(4.0)).toBe('positive');
  });

  it('classifies 3-star as neutral', () => {
    expect(classifyReviewSentiment(3.0)).toBe('neutral');
  });

  it('classifies 2-star as negative', () => {
    expect(classifyReviewSentiment(2.0)).toBe('negative');
  });

  it('classifies 1-star as negative', () => {
    expect(classifyReviewSentiment(1.0)).toBe('negative');
  });

  it('classifies null rating as neutral', () => {
    expect(classifyReviewSentiment(null)).toBe('neutral');
  });
});

describe('shouldAutoPost', () => {
  it('returns true for positive reviews', () => {
    expect(shouldAutoPost('positive')).toBe(true);
  });

  it('returns false for negative reviews (requires approval)', () => {
    expect(shouldAutoPost('negative')).toBe(false);
  });

  it('returns false for neutral reviews (requires approval)', () => {
    expect(shouldAutoPost('neutral')).toBe(false);
  });
});

describe('selectTemplate', () => {
  it('returns a template string for positive sentiment', () => {
    const template = selectTemplate('positive', 'r1');
    expect(template).toBeTruthy();
    expect(typeof template).toBe('string');
    expect(template.length).toBeGreaterThan(20);
  });

  it('returns a different template for different review IDs (rotation)', () => {
    const t1 = selectTemplate('positive', 'review-aaa');
    const t2 = selectTemplate('positive', 'review-bbb');
    const t3 = selectTemplate('positive', 'review-ccc');
    // At least 2 of 3 should be different (25+ templates, collision unlikely)
    const unique = new Set([t1, t2, t3]);
    expect(unique.size).toBeGreaterThanOrEqual(2);
  });

  it('returns a template for negative sentiment', () => {
    const template = selectTemplate('negative', 'r1');
    expect(template).toBeTruthy();
    expect(template).toContain('{guest_name}');
  });
});

describe('interpolateTemplate', () => {
  it('replaces {guest_name} placeholder', () => {
    const result = interpolateTemplate('Thank you {guest_name} for staying!', {
      guest_name: 'Sarah',
      property_name: 'Desert Villa',
    });
    expect(result).toBe('Thank you Sarah for staying!');
  });

  it('replaces {property_name} placeholder', () => {
    const result = interpolateTemplate('We hope you enjoyed {property_name}!', {
      guest_name: 'John',
      property_name: 'Mountain Lodge',
    });
    expect(result).toBe('We hope you enjoyed Mountain Lodge!');
  });

  it('replaces multiple placeholders', () => {
    const result = interpolateTemplate('{guest_name}, thanks for choosing {property_name}!', {
      guest_name: 'Maria',
      property_name: 'Beach House',
    });
    expect(result).toBe('Maria, thanks for choosing Beach House!');
  });

  it('handles missing values gracefully', () => {
    const result = interpolateTemplate('Hello {guest_name}!', {});
    expect(result).toBe('Hello !');
  });
});
