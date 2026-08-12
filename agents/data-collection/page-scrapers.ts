import { Page } from 'playwright';
import { parseNumericValue, parsePercentValue } from './validation';

// ============================================================
// TYPES
// ============================================================

export interface ParsedListingRow {
  listing_id: string;
  metrics: Record<string, number | string | boolean | null>;
}

export interface ParsedOpportunity {
  name: string;
  category: 'appealing' | 'flexible_booking' | 'pricing';
  completion_pct: number;
}

export interface ParsedIssue {
  listing_id: string;
  description: string;
  status: 'needs_attention' | 'deleted';
}

interface RawTableRow {
  listing_name: string;
  listing_id: string;
  cells: string[];
}

interface RawOpportunityCard {
  name: string;
  category: string;
  completion_text: string;
}

interface RawIssueItem {
  listing_name: string;
  listing_href: string;
  description: string;
  status_text: string;
}

// ============================================================
// UTILITY: Extract listing ID from various link formats
// ============================================================

/**
 * Extract an Airbnb listing ID from a link href.
 *
 * Supported formats:
 * - "/rooms/12345"
 * - "https://www.airbnb.com/rooms/67890?check_in=..."
 * - "/performance/conversion?lid%5B%5D=99999"
 */
export function extractListingIdFromHref(href: string): string | null {
  if (!href) return null;

  // Try /rooms/{id} pattern
  const roomsMatch = href.match(/\/rooms\/(\d+)/);
  if (roomsMatch) return roomsMatch[1];

  // Try lid parameter pattern (lid%5B%5D= or lid[]=)
  const lidMatch = href.match(/lid(?:%5B%5D|\[\])=(\d+)/);
  if (lidMatch) return lidMatch[1];

  return null;
}

// ============================================================
// GENERIC TABLE EXTRACTION
// ============================================================

/**
 * Wait for and extract the per-listing data table from an Airbnb Performance page.
 *
 * Airbnb renders these tables with React. The table typically appears as:
 * - A <table> element, OR
 * - A div-based grid with role="table" or specific data attributes
 *
 * Each row contains a listing link (with the listing ID) and numeric cells.
 */
async function extractPerListingTable(page: Page): Promise<RawTableRow[]> {
  // Wait for the data table to render (React hydration)
  // Try multiple selectors since Airbnb may change their markup
  const tableSelector = [
    'table[data-testid="performance-table"]',
    'table.performance-table',
    '[role="table"]',
    'table',
  ].join(', ');

  try {
    await page.waitForSelector(tableSelector, { timeout: 15000 });
  } catch {
    console.warn('[PageScraper] Table not found on page — may be account-level only page');
    return [];
  }

  // Extract all rows from the table
  const rows = await page.evaluate(() => {
    const results: Array<{ listing_name: string; listing_href: string; cells: string[] }> = [];

    // Find all table rows (skip header row)
    const tableRows = Array.from(document.querySelectorAll('table tbody tr, [role="row"]'));

    for (const row of tableRows) {
      // Skip header rows
      if (row.querySelector('th') || row.getAttribute('role') === 'columnheader') continue;

      // Find listing link — usually the first cell with an <a> tag
      const listingLink = row.querySelector('a[href*="/rooms/"]') as HTMLAnchorElement | null;
      const listingName = listingLink?.textContent?.trim() || '';
      const listingHref = listingLink?.getAttribute('href') || '';

      if (!listingHref) continue;

      // Extract all cell values (skip the first cell which is the listing name)
      const cellElements = row.querySelectorAll('td, [role="cell"]');
      const cells: string[] = [];

      for (let i = 1; i < cellElements.length; i++) {
        cells.push(cellElements[i].textContent?.trim() || '');
      }

      results.push({ listing_name: listingName, listing_href: listingHref, cells });
    }

    return results;
  });

  // Convert raw rows to typed rows with extracted listing IDs
  return rows.map(r => ({
    listing_name: r.listing_name,
    listing_id: extractListingIdFromHref(r.listing_href) || '',
    cells: r.cells,
  })).filter(r => r.listing_id !== '');
}

// ============================================================
// PER-PAGE PARSERS (pure functions — testable without browser)
// ============================================================

/**
 * Parse a conversion page row.
 * Expected cells: [overall_conversion, impression_rate, ctr, booking_conversion, views, bookings]
 */
export function parseConversionRow(row: RawTableRow): ParsedListingRow {
  return {
    listing_id: row.listing_id,
    metrics: {
      airbnb_overall_conversion_rate: parsePercentValue(row.cells[0]),
      airbnb_first_page_impression_rate: parsePercentValue(row.cells[1]),
      airbnb_search_to_listing_ctr: parsePercentValue(row.cells[2]),
      airbnb_listing_to_booking_conversion: parsePercentValue(row.cells[3]),
    },
  };
}

/**
 * Parse a views page row.
 * Expected cells: [page_views, change_pct]
 */
export function parseViewsRow(row: RawTableRow): ParsedListingRow {
  return {
    listing_id: row.listing_id,
    metrics: {
      airbnb_page_views: parseNumericValue(row.cells[0]),
    },
  };
}

/**
 * Parse a wishlist page row.
 * Expected cells: [wishlist_additions, change_pct]
 */
export function parseWishlistRow(row: RawTableRow): ParsedListingRow {
  return {
    listing_id: row.listing_id,
    metrics: {
      airbnb_wishlist_additions: parseNumericValue(row.cells[0]),
    },
  };
}

/**
 * Parse a quality overall page row.
 * Expected cells: [overall_rating, 5star_pct, review_count]
 */
export function parseQualityRow(row: RawTableRow): ParsedListingRow {
  return {
    listing_id: row.listing_id,
    metrics: {
      airbnb_overall_rating: parseNumericValue(row.cells[0]),
      airbnb_5star_overall_pct: parsePercentValue(row.cells[1]),
      airbnb_review_count: parseNumericValue(row.cells[2]),
    },
  };
}

/**
 * Parse an occupancy page row.
 * Expected cells: [occupancy_rate, nights_booked, nights_blocked, unbooked_nights, check_ins]
 */
export function parseOccupancyRow(row: RawTableRow): ParsedListingRow {
  return {
    listing_id: row.listing_id,
    metrics: {
      airbnb_occupancy_rate: parsePercentValue(row.cells[0]),
      airbnb_nights_booked: parseNumericValue(row.cells[1]),
      airbnb_nights_blocked: parseNumericValue(row.cells[2]),
      airbnb_unbooked_nights: parseNumericValue(row.cells[3]),
      airbnb_check_ins: parseNumericValue(row.cells[4]),
    },
  };
}

/**
 * Parse a cancellation rate page row.
 * Expected cells: [cancellation_rate, avg_length_of_stay, avg_nightly_rate]
 */
export function parseCancellationRow(row: RawTableRow): ParsedListingRow {
  return {
    listing_id: row.listing_id,
    metrics: {
      airbnb_cancellation_rate: parsePercentValue(row.cells[0]),
      airbnb_avg_length_of_stay_days: parseNumericValue(row.cells[1]),
      airbnb_avg_nightly_rate: parseNumericValue(row.cells[2]),
    },
  };
}

/**
 * Parse an opportunity card from the Opportunities page.
 * Extracts the completion percentage from text like "24% of your listings".
 */
export function parseOpportunityCard(raw: RawOpportunityCard): ParsedOpportunity {
  // Extract number from "24% of your listings" or "100% of your listings"
  const pctMatch = raw.completion_text.match(/([\d.]+)%/);
  const completionPct = pctMatch ? parseFloat(pctMatch[1]) : 0;

  // Normalize category to our enum
  const categoryMap: Record<string, ParsedOpportunity['category']> = {
    'appealing': 'appealing',
    'make your place more appealing': 'appealing',
    'flexible_booking': 'flexible_booking',
    'flexible booking': 'flexible_booking',
    'pricing': 'pricing',
    'price competitively': 'pricing',
  };

  const category = categoryMap[raw.category.toLowerCase()] || 'appealing';

  return {
    name: raw.name,
    category,
    completion_pct: completionPct,
  };
}

/**
 * Parse an issue item from the Recent Issues page.
 */
export function parseIssueItem(raw: RawIssueItem): ParsedIssue {
  const listingId = extractListingIdFromHref(raw.listing_href) || '';

  // Map status text to our enum
  const statusMap: Record<string, ParsedIssue['status']> = {
    'needs attention': 'needs_attention',
    'needs_attention': 'needs_attention',
    'deleted': 'deleted',
    'resolved': 'deleted',
  };

  const status = statusMap[raw.status_text.toLowerCase()] || 'needs_attention';

  return {
    listing_id: listingId,
    description: raw.description,
    status,
  };
}

// ============================================================
// FULL PAGE SCRAPERS (Playwright — interact with live pages)
// ============================================================

/**
 * Scrape the Conversion Rate page.
 * URL: /performance/conversion/conversion_rate
 */
export async function scrapeConversionPage(page: Page): Promise<ParsedListingRow[]> {
  const rows = await extractPerListingTable(page);
  return rows.map(parseConversionRow);
}

/**
 * Scrape the Views (P3 Impressions) page.
 * URL: /performance/conversion/p3_impressions
 */
export async function scrapeViewsPage(page: Page): Promise<ParsedListingRow[]> {
  const rows = await extractPerListingTable(page);
  return rows.map(parseViewsRow);
}

/**
 * Scrape the Wishlist page.
 * URL: /performance/conversion/wishlist
 */
export async function scrapeWishlistPage(page: Page): Promise<ParsedListingRow[]> {
  const rows = await extractPerListingTable(page);
  return rows.map(parseWishlistRow);
}

/**
 * Scrape the Quality Overall page.
 * URL: /performance/quality/overall
 */
export async function scrapeQualityOverallPage(page: Page): Promise<ParsedListingRow[]> {
  const rows = await extractPerListingTable(page);
  return rows.map(parseQualityRow);
}

/**
 * Scrape the Occupancy Rate page.
 * URL: /performance/occupancy/occupancy_rate
 */
export async function scrapeOccupancyPage(page: Page): Promise<ParsedListingRow[]> {
  const rows = await extractPerListingTable(page);
  return rows.map(parseOccupancyRow);
}

/**
 * Scrape the Cancellation Rate page.
 * URL: /performance/occupancy/cancellation_rate
 */
export async function scrapeCancellationPage(page: Page): Promise<ParsedListingRow[]> {
  const rows = await extractPerListingTable(page);
  return rows.map(parseCancellationRow);
}

/**
 * Scrape the Opportunities page (account-level, no per-listing table).
 * URL: /performance/opportunities
 *
 * The page shows opportunity cards grouped into sections.
 * Each card has a title, category section header, and completion text.
 */
export async function scrapeOpportunitiesPage(page: Page): Promise<ParsedOpportunity[]> {
  const rawCards = await page.evaluate(() => {
    const results: Array<{ name: string; category: string; completion_text: string }> = [];
    let currentCategory = 'appealing';

    // Opportunity sections are typically grouped by category headers
    const sections = Array.from(document.querySelectorAll('[data-testid="opportunity-section"], section, .opportunity-section'));

    for (const section of sections) {
      // Get section/category header
      const header = section.querySelector('h2, h3, [data-testid="section-header"]');
      if (header?.textContent) {
        currentCategory = header.textContent.trim().toLowerCase();
      }

      // Get individual opportunity cards within this section
      const cards = Array.from(section.querySelectorAll('[data-testid="opportunity-card"], .opportunity-card, [role="listitem"]'));

      for (const card of cards) {
        const name = card.querySelector('h3, h4, [data-testid="opportunity-name"]')?.textContent?.trim() || '';
        const completion = card.querySelector('[data-testid="completion-text"], .completion-text, p')?.textContent?.trim() || '';

        if (name) {
          results.push({
            name,
            category: currentCategory,
            completion_text: completion,
          });
        }
      }
    }

    // Fallback: if section-based extraction fails, try flat card list
    if (results.length === 0) {
      const allCards = Array.from(document.querySelectorAll('[data-testid="opportunity-card"], .opportunity-card'));
      for (const card of allCards) {
        const name = card.querySelector('h3, h4')?.textContent?.trim() || '';
        const completion = card.querySelector('p, span')?.textContent?.trim() || '';
        if (name) {
          results.push({ name, category: 'appealing', completion_text: completion });
        }
      }
    }

    return results;
  });

  return rawCards.map(parseOpportunityCard);
}

/**
 * Scrape the Recent Issues page (account-level).
 * URL: /performance/recent-issues
 *
 * This page may be empty if there are no current issues.
 */
export async function scrapeIssuesPage(page: Page): Promise<ParsedIssue[]> {
  // Wait briefly for content — this page may be empty
  await page.waitForTimeout(2000);

  const rawIssues = await page.evaluate(() => {
    const results: Array<{
      listing_name: string;
      listing_href: string;
      description: string;
      status_text: string;
    }> = [];

    const issueItems = Array.from(document.querySelectorAll(
      '[data-testid="issue-item"], .issue-item, [role="listitem"], tr'
    ));

    for (const item of issueItems) {
      const link = item.querySelector('a[href*="/rooms/"]') as HTMLAnchorElement | null;
      if (!link) continue;

      const listingName = link.textContent?.trim() || '';
      const listingHref = link.getAttribute('href') || '';

      // Description is usually in a paragraph or span near the listing name
      const description = item.querySelector(
        '[data-testid="issue-description"], .issue-description, p, td:nth-child(2)'
      )?.textContent?.trim() || '';

      // Status badge or text
      const statusEl = item.querySelector(
        '[data-testid="issue-status"], .issue-status, .badge, td:last-child'
      );
      const statusText = statusEl?.textContent?.trim() || 'Needs attention';

      results.push({
        listing_name: listingName,
        listing_href: listingHref,
        description,
        status_text: statusText,
      });
    }

    return results;
  });

  return rawIssues.map(parseIssueItem);
}

// ============================================================
// MERGE UTILITY
// ============================================================

/**
 * Merge metrics from multiple pages for the same listing ID.
 * Called by the orchestrator after all pages are scraped for one account.
 */
export function mergeListingMetrics(
  listings: Map<string, Record<string, unknown>>,
): Map<string, Record<string, unknown>> {
  // Already merged during scraping in airbnb-scraper.ts
  // This function is available for post-processing if needed
  return listings;
}
