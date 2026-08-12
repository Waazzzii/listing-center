// agents/scorecard-generator/scorecard-pdf.ts
// PDF generation — Phase 4 placeholder.
// Requires: npm install puppeteer

import { renderScorecardHtml, type ScorecardData } from './scorecard-renderer';

/**
 * Generate a PDF from scorecard data using Puppeteer.
 * Returns the PDF as a Buffer.
 *
 * NOTE: This is placeholder infrastructure for Phase 4 delivery.
 * Puppeteer must be installed before use: npm install puppeteer
 */
export async function generateScorecardPdf(
  data: ScorecardData
): Promise<Buffer> {
  // Dynamic import so the rest of the codebase doesn't require puppeteer
  // @ts-expect-error puppeteer is an optional Phase 4 dependency
  const puppeteer = await import('puppeteer');
  const browser = await puppeteer.default.launch({ headless: true });
  const page = await browser.newPage();

  const html = renderScorecardHtml(data);
  await page.setContent(html, { waitUntil: 'networkidle0' });

  const pdfBuffer = await page.pdf({
    format: 'Letter',
    printBackground: true,
    margin: {
      top: '0.5in',
      right: '0.5in',
      bottom: '0.5in',
      left: '0.5in',
    },
  });

  await browser.close();
  return Buffer.from(pdfBuffer);
}
