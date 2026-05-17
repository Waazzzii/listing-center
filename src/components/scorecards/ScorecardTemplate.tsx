'use client';

import React from 'react';

// ---- Types (matches scorecard-builder.ts output) ----

interface MetricWithChange {
  current: number;
  prior_month: number | null;
  change: number | null;
}

interface ScorecardData {
  metadata: {
    property_name: string;
    report_month: string;
    market: string;
    quality_tier: string;
    generated_at: string;
  };
  listing_health: {
    health_status: string;
    impression_rate: MetricWithChange;
    ctr: MetricWithChange;
    conversion: MetricWithChange;
    occupancy: MetricWithChange;
    adr: MetricWithChange;
    nights_booked: MetricWithChange;
    overall_rating: number;
    page_views: MetricWithChange;
    wishlist_additions: MetricWithChange;
  };
  reviews: {
    total_this_month: number;
    avg_rating_this_month: number;
    positive_count: number;
    neutral_count: number;
    negative_count: number;
    highlights: Array<{
      guest_name: string;
      rating: number;
      sentiment: string;
    }>;
  };
  optimizations: {
    changes_made: Array<{
      change_type: string;
      change_date: string;
      thesis: string;
      status: string;
    }>;
    total_changes: number;
  };
  competitive_context: {
    vs_benchmark: {
      impression_rate: string;
      ctr: string;
      conversion: string;
    };
    tier_label: string;
    market_label: string;
  };
  upcoming_actions: Array<{
    title: string;
    severity: string;
    funnel_stage: string;
  }>;
}

interface Props {
  data: ScorecardData;
}

// ---- Status / benchmark config ----

const STATUS_COLORS: Record<string, string> = {
  red: 'bg-destructive',
  orange: 'bg-health-orange',
  yellow: 'bg-health-yellow',
  green: 'bg-health-green',
  blue_spell: 'bg-chart-2',
  unknown: 'bg-muted-foreground',
};

const BENCHMARK_CONFIG: Record<
  string,
  { label: string; bg: string; text: string }
> = {
  below: { label: 'Below Benchmark', bg: 'bg-destructive/10', text: 'text-destructive' },
  in_range: {
    label: 'In Range',
    bg: 'bg-health-green/10',
    text: 'text-health-green',
  },
  above: {
    label: 'Above Benchmark',
    bg: 'bg-chart-2/10',
    text: 'text-chart-2',
  },
};

const SEVERITY_COLORS: Record<string, string> = {
  high: 'border-destructive/40 bg-destructive/10',
  medium: 'border-health-yellow/40 bg-health-yellow/10',
  low: 'border-chart-2/40 bg-chart-2/10',
};

// ---- Helper components ----

function ChangeIndicator({ change }: { change: number | null }) {
  if (change == null) return <span className="text-muted-foreground text-xs">&mdash;</span>;
  const color =
    change > 0 ? 'text-health-green' : change < 0 ? 'text-destructive' : 'text-muted-foreground';
  const arrow = change > 0 ? '\u2191' : change < 0 ? '\u2193' : '\u2192';
  const prefix = change > 0 ? '+' : '';
  return (
    <span className={`text-xs font-medium ${color}`}>
      {arrow} {prefix}
      {change}
    </span>
  );
}

function MetricCard({
  label,
  value,
  unit,
  change,
}: {
  label: string;
  value: number;
  unit: string;
  change: number | null;
}) {
  const displayValue = unit === '$' ? `$${value}` : unit ? `${value}${unit}` : `${value}`;
  return (
    <div className="bg-muted border border-border rounded-lg p-3 text-center">
      <div className="text-2xl font-bold text-foreground">{displayValue}</div>
      <div className="text-xs text-muted-foreground uppercase mt-1">{label}</div>
      <div className="mt-1">
        <ChangeIndicator change={change} />
      </div>
    </div>
  );
}

function BenchmarkBadge({ position }: { position: string }) {
  const config = BENCHMARK_CONFIG[position] || BENCHMARK_CONFIG.in_range;
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${config.bg} ${config.text}`}
    >
      {config.label}
    </span>
  );
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-lg font-semibold text-foreground mb-3 pb-2 border-b border-border">
      {children}
    </h3>
  );
}

// ---- Main Component ----

export default function ScorecardTemplate({ data }: Props) {
  const lh = data.listing_health;
  const monthDate = new Date(data.metadata.report_month + 'T00:00:00');
  const monthLabel = monthDate.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h2 className="text-xl font-bold text-foreground">
            {data.metadata.property_name}
          </h2>
          <p className="text-sm text-muted-foreground">
            {data.competitive_context.market_label} &middot;{' '}
            {data.competitive_context.tier_label} &middot; {monthLabel}
          </p>
        </div>
        <span
          className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold text-white ${STATUS_COLORS[lh.health_status] || 'bg-muted-foreground'}`}
        >
          {lh.health_status.replace('_', ' ').toUpperCase()}
        </span>
      </div>

      {/* Section 1: Listing Health */}
      <div>
        <SectionHeading>Listing Health</SectionHeading>
        <div className="grid grid-cols-3 gap-3">
          <MetricCard
            label="Impression Rate"
            value={lh.impression_rate.current}
            unit="%"
            change={lh.impression_rate.change}
          />
          <MetricCard
            label="Click-Through Rate"
            value={lh.ctr.current}
            unit="%"
            change={lh.ctr.change}
          />
          <MetricCard
            label="Booking Conversion"
            value={lh.conversion.current}
            unit="%"
            change={lh.conversion.change}
          />
          <MetricCard
            label="Occupancy"
            value={lh.occupancy.current}
            unit="%"
            change={lh.occupancy.change}
          />
          <MetricCard
            label="Avg Nightly Rate"
            value={lh.adr.current}
            unit="$"
            change={lh.adr.change}
          />
          <MetricCard
            label="Overall Rating"
            value={lh.overall_rating}
            unit=""
            change={null}
          />
        </div>
        <div className="flex gap-6 mt-3 text-xs text-muted-foreground">
          <span>{lh.nights_booked.current} nights booked this month</span>
          <span>{lh.page_views.current} page views</span>
          <span>{lh.wishlist_additions.current} wishlist saves</span>
        </div>
      </div>

      {/* Section 2: Reviews */}
      <div>
        <SectionHeading>Reviews This Month</SectionHeading>
        <div className="flex gap-6 text-sm mb-3">
          <span>
            <strong className="text-foreground">
              {data.reviews.total_this_month}
            </strong>{' '}
            total reviews
          </span>
          <span>
            Avg rating:{' '}
            <strong className="text-foreground">
              {data.reviews.avg_rating_this_month}/5
            </strong>
          </span>
          <span className="text-health-green">
            {data.reviews.positive_count} positive
          </span>
          {data.reviews.neutral_count > 0 && (
            <span className="text-muted-foreground">
              {data.reviews.neutral_count} neutral
            </span>
          )}
          <span className="text-destructive">
            {data.reviews.negative_count} negative
          </span>
        </div>
        {data.reviews.highlights.length > 0 && (
          <div className="space-y-1">
            {data.reviews.highlights.map((r, i) => (
              <div
                key={i}
                className="text-sm py-1.5 border-b border-border last:border-0"
              >
                <strong className="text-foreground">{r.guest_name}</strong>
                <span className="text-muted-foreground ml-2">
                  {r.rating}/5 ({r.sentiment})
                </span>
              </div>
            ))}
          </div>
        )}
        {data.reviews.total_this_month === 0 && (
          <p className="text-sm text-muted-foreground">No reviews received this month.</p>
        )}
      </div>

      {/* Section 3: Optimizations Made */}
      <div>
        <SectionHeading>Optimizations Made</SectionHeading>
        {data.optimizations.changes_made.length > 0 ? (
          <div className="space-y-2">
            {data.optimizations.changes_made.map((c, i) => (
              <div
                key={i}
                className="flex items-start gap-3 text-sm border-b border-border pb-2 last:border-0"
              >
                <span className="inline-flex items-center px-2 py-0.5 bg-muted rounded text-xs font-medium text-muted-foreground capitalize whitespace-nowrap">
                  {c.change_type.replace(/_/g, ' ')}
                </span>
                <div className="flex-1">
                  <span className="text-muted-foreground">{c.thesis}</span>
                  <span className="text-muted-foreground ml-2 text-xs">
                    {c.change_date}
                  </span>
                </div>
                <span className="text-xs text-muted-foreground">[{c.status}]</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            No optimizations were made this month.
          </p>
        )}
      </div>

      {/* Section 4: Competitive Context */}
      <div>
        <SectionHeading>Competitive Context</SectionHeading>
        <p className="text-sm text-muted-foreground mb-3">
          Compared to{' '}
          <strong>{data.competitive_context.tier_label}</strong> properties in{' '}
          <strong>{data.competitive_context.market_label}</strong>:
        </p>
        <div className="space-y-2">
          <div className="flex justify-between items-center py-1.5">
            <span className="text-sm text-muted-foreground">Impression Rate</span>
            <BenchmarkBadge
              position={data.competitive_context.vs_benchmark.impression_rate}
            />
          </div>
          <div className="flex justify-between items-center py-1.5">
            <span className="text-sm text-muted-foreground">Click-Through Rate</span>
            <BenchmarkBadge
              position={data.competitive_context.vs_benchmark.ctr}
            />
          </div>
          <div className="flex justify-between items-center py-1.5">
            <span className="text-sm text-muted-foreground">Booking Conversion</span>
            <BenchmarkBadge
              position={data.competitive_context.vs_benchmark.conversion}
            />
          </div>
        </div>
      </div>

      {/* Section 5: Upcoming Actions */}
      <div>
        <SectionHeading>Upcoming Actions</SectionHeading>
        {data.upcoming_actions.length > 0 ? (
          <div className="space-y-2">
            {data.upcoming_actions.map((a, i) => (
              <div
                key={i}
                className={`border rounded-md p-3 text-sm ${SEVERITY_COLORS[a.severity] || 'border-border bg-muted'}`}
              >
                <span className="font-medium text-foreground">{a.title}</span>
                <span className="text-muted-foreground ml-2 text-xs">
                  ({a.severity} priority &middot; {a.funnel_stage} funnel)
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            No pending actions. Your listing is in great shape!
          </p>
        )}
      </div>

      {/* Footer */}
      <div className="pt-4 border-t border-border text-center text-xs text-muted-foreground">
        Generated by Casago Listing Center &middot;{' '}
        {new Date(data.metadata.generated_at).toLocaleDateString()} &middot;
        Powered by AI-driven listing optimization
      </div>
    </div>
  );
}
