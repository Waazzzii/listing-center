import { describe, it, expect } from 'vitest';
import templates from '../../../agents/review-manager/response-templates.json';

describe('response-templates.json', () => {
  it('has at least 25 positive templates', () => {
    expect(templates.positive.length).toBeGreaterThanOrEqual(25);
  });

  it('has at least 5 negative templates', () => {
    expect(templates.negative.length).toBeGreaterThanOrEqual(5);
  });

  it('has at least 5 neutral templates', () => {
    expect(templates.neutral.length).toBeGreaterThanOrEqual(5);
  });

  it('all positive templates contain {guest_name} placeholder', () => {
    for (const template of templates.positive) {
      expect(template).toContain('{guest_name}');
    }
  });

  it('all negative templates contain {guest_name} placeholder', () => {
    for (const template of templates.negative) {
      expect(template).toContain('{guest_name}');
    }
  });

  it('no templates are duplicates', () => {
    const allTemplates = [...templates.positive, ...templates.negative, ...templates.neutral];
    const unique = new Set(allTemplates);
    expect(unique.size).toBe(allTemplates.length);
  });

  it('all templates are non-empty and at least 30 characters', () => {
    const allTemplates = [...templates.positive, ...templates.negative, ...templates.neutral];
    for (const template of allTemplates) {
      expect(template.length).toBeGreaterThanOrEqual(30);
    }
  });
});
