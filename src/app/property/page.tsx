'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Search, Filter } from 'lucide-react';
import { useCommandGrid } from '@/hooks/useCommandGrid';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { TierBadge } from '@/components/ui/tier-badge';
import { HealthScoreBadge } from '@/components/ui/health-score-badge';
import { ChannelDots } from '@/components/ui/channel-dots';
import { EmptyState } from '@/components/ui/empty-state';
import { formatCurrency, formatPct, cn } from '@/lib/utils';
import { MARKET_LABELS } from '@/lib/constants';

export default function PropertiesPage() {
  const router = useRouter();
  const { rows, isLoading } = useCommandGrid();
  const [query, setQuery] = useState('');
  const [marketFilter, setMarketFilter] = useState<string>('all');

  const markets = Array.from(new Set(rows.map((r) => r.market))).filter(Boolean);

  const filtered = rows.filter((r) => {
    if (marketFilter !== 'all' && r.market !== marketFilter) return false;
    if (query && !r.property_name.toLowerCase().includes(query.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Properties</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {rows.length} active properties across {markets.length} markets. Click a row to drill in.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <div className="flex items-center gap-3 flex-1">
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search properties..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-2 text-sm rounded-md border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background"
              />
            </div>
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <select
                value={marketFilter}
                onChange={(e) => setMarketFilter(e.target.value)}
                className="text-sm border border-border rounded-md px-2 py-1.5 bg-background text-foreground"
              >
                <option value="all">All markets</option>
                {markets.map((m) => (
                  <option key={m} value={m}>
                    {MARKET_LABELS[m] || m}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <CardTitle className="text-xs text-muted-foreground font-normal">
            {filtered.length} of {rows.length}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="space-y-2 p-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-12 bg-muted rounded-md animate-pulse" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState
              title="No properties match"
              description={
                query || marketFilter !== 'all'
                  ? 'Try adjusting your search or filter.'
                  : 'Properties will appear here once they sync from Streamline.'
              }
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Property</TableHead>
                  <TableHead>Market</TableHead>
                  <TableHead>Tier</TableHead>
                  <TableHead className="text-right">Health</TableHead>
                  <TableHead className="text-right">RevPAR</TableHead>
                  <TableHead className="text-right">Occ. 30d</TableHead>
                  <TableHead className="text-right">Pace</TableHead>
                  <TableHead>Channels</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((row) => {
                  const paceTone =
                    row.rev_pct_to_proj == null
                      ? 'text-muted-foreground'
                      : row.rev_pct_to_proj >= 100
                        ? 'text-health-green'
                        : row.rev_pct_to_proj >= 90
                          ? 'text-foreground'
                          : 'text-destructive';
                  return (
                    <TableRow
                      key={row.property_id}
                      className="cursor-pointer"
                      onClick={() => router.push(`/property/${row.property_id}`)}
                    >
                      <TableCell className="font-medium">{row.property_name}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {MARKET_LABELS[row.market] || row.market}
                      </TableCell>
                      <TableCell>
                        <TierBadge tier={row.quality_tier} />
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="inline-flex">
                          <HealthScoreBadge
                            score={row.health_score}
                            delta={row.health_score_delta}
                            size="sm"
                          />
                        </div>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatCurrency(row.wh_revpar)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatPct(row.wh_occupancy_30d)}
                      </TableCell>
                      <TableCell className={cn('text-right tabular-nums font-medium', paceTone)}>
                        {formatPct(row.rev_pct_to_proj, 0)}
                      </TableCell>
                      <TableCell>
                        <ChannelDots
                          airbnb={row.airbnb_listing_id}
                          vrbo={row.vrbo_listing_id}
                          booking={row.booking_property_id}
                        />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
