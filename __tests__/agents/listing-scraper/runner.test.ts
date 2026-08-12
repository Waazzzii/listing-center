import { describe, it, expect, vi } from 'vitest';
import { runScrapeJobs } from '../../../agents/listing-scraper/_runner';
import type { ScrapeJob, ScrapeResult } from '../../../agents/listing-scraper/_types';

function job(i: number): ScrapeJob {
  return { unitId: `u${i}`, ota: 'airbnb', source: 'public', publicUrl: `https://x/${i}` };
}

describe('runScrapeJobs', () => {
  it('runs all jobs and returns a result for each', async () => {
    const scrape = vi.fn(
      async (j: ScrapeJob): Promise<ScrapeResult> => ({ job: j, ok: true, durationMs: 10 })
    );

    const results = await runScrapeJobs([job(1), job(2), job(3)], {
      scrape,
      maxConcurrent: 1,
      minDelayMs: 0,
    });

    expect(results).toHaveLength(3);
    expect(scrape).toHaveBeenCalledTimes(3);
    expect(results.every((r) => r.ok)).toBe(true);
  });

  it('retries up to 3 times on transient failure', async () => {
    let calls = 0;
    const scrape = async (j: ScrapeJob): Promise<ScrapeResult> => {
      calls++;
      if (calls < 3) {
        return { job: j, ok: false, error: { code: 'timeout', message: 't' }, durationMs: 5 };
      }
      return { job: j, ok: true, durationMs: 5 };
    };

    const results = await runScrapeJobs([job(1)], {
      scrape,
      maxConcurrent: 1,
      minDelayMs: 0,
      maxRetries: 3,
    });

    expect(calls).toBe(3);
    expect(results[0].ok).toBe(true);
  });

  it('stops retrying on blocked error', async () => {
    let calls = 0;
    const scrape = async (j: ScrapeJob): Promise<ScrapeResult> => {
      calls++;
      return { job: j, ok: false, error: { code: 'blocked', message: 'captcha' }, durationMs: 5 };
    };

    const results = await runScrapeJobs([job(1)], {
      scrape,
      maxConcurrent: 1,
      minDelayMs: 0,
      maxRetries: 3,
    });

    expect(calls).toBe(1);
    expect(results[0].ok).toBe(false);
    expect(results[0].error?.code).toBe('blocked');
  });

  it('respects maxConcurrent', async () => {
    let active = 0;
    let maxActive = 0;
    const scrape = async (j: ScrapeJob): Promise<ScrapeResult> => {
      active++;
      maxActive = Math.max(maxActive, active);
      await new Promise((r) => setTimeout(r, 10));
      active--;
      return { job: j, ok: true, durationMs: 10 };
    };

    await runScrapeJobs([job(1), job(2), job(3), job(4), job(5)], {
      scrape,
      maxConcurrent: 2,
      minDelayMs: 0,
    });

    expect(maxActive).toBeLessThanOrEqual(2);
  });

  it('captures thrown scrape errors as unknown-code failures', async () => {
    let calls = 0;
    const scrape = async (_j: ScrapeJob): Promise<ScrapeResult> => {
      calls++;
      throw new Error('boom');
    };

    const results = await runScrapeJobs([job(1)], {
      scrape,
      maxConcurrent: 1,
      minDelayMs: 0,
      maxRetries: 2,
    });

    expect(calls).toBe(2);
    expect(results).toHaveLength(1);
    expect(results[0].ok).toBe(false);
    expect(results[0].error?.code).toBe('unknown');
    expect(results[0].error?.message).toBe('boom');
  });
});
