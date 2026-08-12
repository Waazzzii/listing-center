import type { ScrapeJob, ScrapeResult } from './_types';

export interface RunOptions {
  scrape: (job: ScrapeJob) => Promise<ScrapeResult>;
  maxConcurrent: number;
  minDelayMs: number;
  maxRetries?: number;
}

const NON_RETRYABLE = new Set(['blocked', 'parse_error']);

async function sleep(ms: number): Promise<void> {
  if (ms > 0) await new Promise((r) => setTimeout(r, ms));
}

async function runWithRetries(
  job: ScrapeJob,
  scrape: RunOptions['scrape'],
  maxRetries: number
): Promise<ScrapeResult> {
  let last: ScrapeResult | null = null;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    let res: ScrapeResult;
    try {
      res = await scrape(job);
    } catch (err) {
      res = {
        job,
        ok: false,
        error: {
          code: 'unknown',
          message: err instanceof Error ? err.message : String(err),
        },
        durationMs: 0,
      };
    }
    last = res;
    if (res.ok) return res;
    if (res.error && NON_RETRYABLE.has(res.error.code)) return res;
    const backoff = Math.min(2 ** (attempt - 1) * 500, 8000);
    await sleep(backoff);
  }
  return last as ScrapeResult;
}

/**
 * Run a batch of scrape jobs with bounded concurrency and retries.
 *
 * - Jobs run up to `opts.maxConcurrent` at a time.
 * - Each job is retried up to `opts.maxRetries` (default 3) with exponential
 *   backoff, except for non-retryable error codes ('blocked', 'parse_error').
 * - `opts.minDelayMs` throttles slot reuse (applied after each job completes).
 * - If the injected `scrape()` function throws, the exception is captured
 *   and converted to a ScrapeResult with error.code='unknown'.
 *
 * Results are returned in COMPLETION ORDER, not input order. Each result
 * carries its original `job` reference; use that to correlate with input.
 */
export async function runScrapeJobs(
  jobs: ScrapeJob[],
  opts: RunOptions
): Promise<ScrapeResult[]> {
  const maxRetries = opts.maxRetries ?? 3;
  const results: ScrapeResult[] = [];
  const queue = [...jobs];
  const inFlight = new Set<Promise<void>>();

  const launch = (job: ScrapeJob): Promise<void> => {
    const p = (async () => {
      const res = await runWithRetries(job, opts.scrape, maxRetries);
      results.push(res);
      await sleep(opts.minDelayMs);
    })();
    inFlight.add(p);
    // .finally() runs as a microtask before the outer loop resumes from
    // Promise.race, so inFlight.size is accurate on the next iteration.
    p.finally(() => inFlight.delete(p));
    return p;
  };

  while (queue.length > 0 || inFlight.size > 0) {
    while (queue.length > 0 && inFlight.size < opts.maxConcurrent) {
      const j = queue.shift();
      if (j) launch(j);
    }
    if (inFlight.size > 0) {
      await Promise.race(inFlight);
    }
  }

  return results;
}
