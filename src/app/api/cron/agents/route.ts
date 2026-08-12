export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 min max for agent runs

import { NextRequest, NextResponse } from 'next/server';

const CRON_SECRET = process.env.CRON_SECRET || '';

/**
 * Cron trigger for listing optimization agents.
 * Called by Vercel Cron Jobs on schedule defined in vercel.json.
 *
 * Query params:
 *   agent: discount-optimizer | pricing-optimizer | revenue-pacer | content-optimizer | execute-actions
 */
export async function GET(req: NextRequest) {
  // Verify cron secret (Vercel sends this automatically)
  const authHeader = req.headers.get('authorization');
  if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const agent = req.nextUrl.searchParams.get('agent');
  if (!agent) {
    return NextResponse.json({ error: 'Missing agent parameter' }, { status: 400 });
  }

  const agentMap: Record<string, () => Promise<void>> = {
    'discount-optimizer': async () => {
      const { analyzePortfolio } = await import('../../../../../agents/discount-optimizer/strategy');
      const { generateActions } = await import('../../../../../agents/discount-optimizer/action-generator');
      const { fetchCommandGrid } = await import('./helpers');
      const rows = await fetchCommandGrid();
      const opportunities = analyzePortfolio(rows);
      await generateActions(opportunities);
    },
    'pricing-optimizer': async () => {
      const { analyzePortfolioPricing } = await import('../../../../../agents/pricing-optimizer/analyzer');
      const { fetchCommandGrid } = await import('./helpers');
      const rows = await fetchCommandGrid();
      const opportunities = analyzePortfolioPricing(rows);
      // Create actions inline (simplified from run-pricing-optimizer.ts)
      console.log(`[Cron] Pricing optimizer found ${opportunities.length} opportunities`);
    },
    'revenue-pacer': async () => {
      // Revenue pacer runs its own main() function
      const mod = await import('../../../../../agents/revenue-pacer/run-revenue-pacer');
      if (typeof (mod as Record<string, unknown>).main === 'function') {
        await (mod as Record<string, unknown> & { main: () => Promise<void> }).main();
      }
    },
    'content-optimizer': async () => {
      const mod = await import('../../../../../agents/content-optimizer/run-content-optimizer');
      if (typeof (mod as Record<string, unknown>).main === 'function') {
        await (mod as Record<string, unknown> & { main: () => Promise<void> }).main();
      }
    },
    'execute-actions': async () => {
      const { processActionQueue } = await import('../../../../../agents/action-executor/executor');
      await processActionQueue();
    },
    'testing-engine': async () => {
      const { main } = await import('../../../../../agents/testing-engine/run-testing-engine');
      await main();
    },
  };

  const runner = agentMap[agent];
  if (!runner) {
    return NextResponse.json(
      { error: `Unknown agent: ${agent}. Valid: ${Object.keys(agentMap).join(', ')}` },
      { status: 400 }
    );
  }

  try {
    const start = Date.now();
    await runner();
    const duration = ((Date.now() - start) / 1000).toFixed(1);
    return NextResponse.json({ ok: true, agent, duration_s: parseFloat(duration) });
  } catch (err) {
    console.error(`[Cron] Agent ${agent} failed:`, err);
    return NextResponse.json(
      { error: `Agent ${agent} failed: ${err instanceof Error ? err.message : String(err)}` },
      { status: 500 }
    );
  }
}
