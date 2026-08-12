// agents/scorecard-generator/scorecard-renderer.ts
// Generates scorecard HTML (suitable for PDF generation) and PDF output.

import type { ScorecardData as ScorecardDataType } from './scorecard-builder';
export type ScorecardData = ScorecardDataType;

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

const STATUS_COLORS: Record<string, string> = {
  red: '#EF4444',
  orange: '#F97316',
  yellow: '#EAB308',
  green: '#22C55E',
  blue_spell: '#3B82F6',
  unknown: '#9CA3AF',
};

function formatMonth(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return `${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

function changeArrow(change: number | null): string {
  if (change == null) return '';
  if (change > 0)
    return `<span style="color: #22C55E;">+${change}</span>`;
  if (change < 0)
    return `<span style="color: #EF4444;">${change}</span>`;
  return `<span style="color: #9CA3AF;">0</span>`;
}

function benchmarkBadge(position: string): string {
  const colors: Record<string, string> = {
    below: 'background: #FEE2E2; color: #991B1B;',
    in_range: 'background: #DCFCE7; color: #166534;',
    above: 'background: #DBEAFE; color: #1E40AF;',
  };
  const labels: Record<string, string> = {
    below: 'Below Benchmark',
    in_range: 'In Range',
    above: 'Above Benchmark',
  };
  return `<span style="display: inline-block; padding: 2px 8px; border-radius: 12px; font-size: 11px; ${colors[position] || ''}">${labels[position] || position}</span>`;
}

/**
 * Render a scorecard JSON into a full HTML document suitable for PDF generation.
 * Uses inline styles (no external CSS) for Puppeteer PDF compatibility.
 */
export function renderScorecardHtml(data: ScorecardData): string {
  const lh = data.listing_health;
  const statusColor =
    STATUS_COLORS[lh.health_status] || STATUS_COLORS.unknown;
  const monthLabel = formatMonth(data.metadata.report_month);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Listing Scorecard - ${data.metadata.property_name} - ${monthLabel}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #1F2937; line-height: 1.5; padding: 40px; max-width: 800px; margin: 0 auto; }
    h1 { font-size: 24px; margin-bottom: 4px; }
    h2 { font-size: 18px; margin: 24px 0 12px; padding-bottom: 6px; border-bottom: 2px solid #E5E7EB; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px; }
    .subtitle { color: #6B7280; font-size: 14px; }
    .status-badge { display: inline-block; padding: 4px 12px; border-radius: 16px; color: white; font-weight: 600; font-size: 13px; }
    .metric-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-bottom: 20px; }
    .metric-card { background: #F9FAFB; border: 1px solid #E5E7EB; border-radius: 8px; padding: 12px; text-align: center; }
    .metric-value { font-size: 28px; font-weight: 700; }
    .metric-label { font-size: 12px; color: #6B7280; text-transform: uppercase; margin-top: 2px; }
    .metric-change { font-size: 12px; margin-top: 4px; }
    .review-item { padding: 8px 0; border-bottom: 1px solid #F3F4F6; font-size: 14px; }
    .change-item { padding: 8px 0; border-bottom: 1px solid #F3F4F6; font-size: 14px; }
    .action-item { padding: 8px 12px; background: #FEF3C7; border-radius: 6px; margin-bottom: 8px; font-size: 14px; }
    .benchmark-row { display: flex; justify-content: space-between; padding: 6px 0; font-size: 14px; }
    .footer { margin-top: 32px; padding-top: 16px; border-top: 1px solid #E5E7EB; font-size: 11px; color: #9CA3AF; text-align: center; }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <h1>${data.metadata.property_name}</h1>
      <div class="subtitle">${data.competitive_context.market_label} &middot; ${data.competitive_context.tier_label} &middot; ${monthLabel}</div>
    </div>
    <div>
      <span class="status-badge" style="background: ${statusColor};">${lh.health_status.replace('_', ' ').toUpperCase()}</span>
    </div>
  </div>

  <h2>Listing Health</h2>
  <div class="metric-grid">
    <div class="metric-card">
      <div class="metric-value">${lh.impression_rate.current}%</div>
      <div class="metric-label">Impression Rate</div>
      <div class="metric-change">MoM: ${changeArrow(lh.impression_rate.change)}</div>
    </div>
    <div class="metric-card">
      <div class="metric-value">${lh.ctr.current}%</div>
      <div class="metric-label">Click-Through Rate</div>
      <div class="metric-change">MoM: ${changeArrow(lh.ctr.change)}</div>
    </div>
    <div class="metric-card">
      <div class="metric-value">${lh.conversion.current}%</div>
      <div class="metric-label">Booking Conversion</div>
      <div class="metric-change">MoM: ${changeArrow(lh.conversion.change)}</div>
    </div>
    <div class="metric-card">
      <div class="metric-value">${lh.occupancy.current}%</div>
      <div class="metric-label">Occupancy</div>
      <div class="metric-change">MoM: ${changeArrow(lh.occupancy.change)}</div>
    </div>
    <div class="metric-card">
      <div class="metric-value">$${lh.adr.current}</div>
      <div class="metric-label">Avg Nightly Rate</div>
      <div class="metric-change">MoM: ${changeArrow(lh.adr.change)}</div>
    </div>
    <div class="metric-card">
      <div class="metric-value">${lh.overall_rating}</div>
      <div class="metric-label">Overall Rating</div>
      <div class="metric-change">${lh.nights_booked.current} nights booked</div>
    </div>
  </div>

  <h2>Reviews This Month</h2>
  <div style="display: flex; gap: 24px; margin-bottom: 12px; font-size: 14px;">
    <div><strong>${data.reviews.total_this_month}</strong> reviews</div>
    <div>Avg: <strong>${data.reviews.avg_rating_this_month}/5</strong></div>
    <div style="color: #22C55E;">${data.reviews.positive_count} positive</div>
    <div style="color: #EF4444;">${data.reviews.negative_count} negative</div>
  </div>
  ${data.reviews.highlights
    .map(
      (r) => `
    <div class="review-item">
      <strong>${r.guest_name}</strong> - ${r.rating}/5 (${r.sentiment})
    </div>
  `
    )
    .join('')}

  <h2>Optimizations Made</h2>
  ${
    data.optimizations.changes_made.length > 0
      ? data.optimizations.changes_made
          .map(
            (c) => `
      <div class="change-item">
        <strong>${c.change_type.replace(/_/g, ' ')}</strong> (${c.change_date}) - ${c.thesis}
        <span style="color: #6B7280; font-size: 12px;"> [${c.status}]</span>
      </div>
    `
          )
          .join('')
      : '<div style="color: #9CA3AF; font-size: 14px;">No changes made this month.</div>'
  }

  <h2>Competitive Context</h2>
  <div style="font-size: 14px; margin-bottom: 8px;">Compared to <strong>${data.competitive_context.tier_label}</strong> properties in <strong>${data.competitive_context.market_label}</strong>:</div>
  <div class="benchmark-row">
    <span>Impression Rate</span>
    ${benchmarkBadge(data.competitive_context.vs_benchmark.impression_rate)}
  </div>
  <div class="benchmark-row">
    <span>Click-Through Rate</span>
    ${benchmarkBadge(data.competitive_context.vs_benchmark.ctr)}
  </div>
  <div class="benchmark-row">
    <span>Booking Conversion</span>
    ${benchmarkBadge(data.competitive_context.vs_benchmark.conversion)}
  </div>

  <h2>Upcoming Actions</h2>
  ${
    data.upcoming_actions.length > 0
      ? data.upcoming_actions
          .map(
            (a) => `
      <div class="action-item">
        <strong>${a.title}</strong>
        <span style="font-size: 12px; color: #92400E;"> (${a.severity} priority, ${a.funnel_stage} funnel)</span>
      </div>
    `
          )
          .join('')
      : '<div style="color: #9CA3AF; font-size: 14px;">No pending actions. Keep up the great work!</div>'
  }

  <div class="footer">
    Generated by Casago Listing Center &middot; ${new Date(data.metadata.generated_at).toLocaleDateString()} &middot; Powered by AI-driven listing optimization
  </div>
</body>
</html>`;
}

// PDF generation is in scorecard-pdf.ts (Phase 4 — requires puppeteer)
