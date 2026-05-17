'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Search, Filter } from 'lucide-react';
import { useCommandGrid } from '@/hooks/useCommandGrid';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatCurrency, formatPct, scoreToGrade, scoreColor, cn } from '@/lib/utils';
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
            <div className="py-16 text-center text-sm text-muted-foreground">
              No properties match the current filters.
            </div>
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
                  const grade = scoreToGrade(row.health_score);
                  const gradeColor = scoreColor(row.health_score);
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
                        <Badge variant="secondary" className="capitalize">
                          {row.quality_tier}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <span className="inline-flex items-baseline gap-1">
                          <span className={cn('font-semibold tabular-nums', gradeColor)}>
                            {row.health_score ?? '—'}
                          </span>
                          <span className={cn('text-xs font-semibold', gradeColor)}>{grade}</span>
                        </span>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatCurrency(row.wh_revpar)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatPct(row.wh_occupancy_30d)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatPct(row.rev_pct_to_proj, 0)}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          {row.airbnb_listing_id && (
                            <span
                              className="h-2 w-2 rounded-full bg-destructive"
                              title="Airbnb"
                            />
                          )}
                          {row.vrbo_listing_id && (
                            <span className="h-2 w-2 rounded-full bg-chart-3" title="VRBO" />
                          )}
                          {row.booking_property_id && (
                            <span
                              className="h-2 w-2 rounded-full bg-chart-4"
                              title="Booking.com"
                            />
                          )}
                        </div>
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
