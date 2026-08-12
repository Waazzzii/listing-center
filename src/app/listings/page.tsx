'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, XCircle, ExternalLink } from 'lucide-react';
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
import { cn } from '@/lib/utils';
import { MARKET_LABELS } from '@/lib/constants';

interface ListingPresenceRow {
  unit_id: string;
  property_name: string;
  market: string;
  ota: string;
  streamline_distributed: boolean;
  publicly_found: boolean | null;
  extranet_active: boolean | null;
  public_url: string | null;
  extranet_listing_id: string | null;
  last_public_check_at: string | null;
  last_extranet_check_at: string | null;
  mismatch_flags: string[];
}

const OTA_LABEL: Record<string, string> = {
  airbnb: 'Airbnb',
  vrbo: 'VRBO',
  booking: 'Booking.com',
};

const OTA_DOT: Record<string, string> = {
  airbnb: 'bg-destructive',
  vrbo: 'bg-chart-3',
  booking: 'bg-chart-4',
};

function PresenceCell({ value }: { value: boolean | null }) {
  if (value === null) {
    return <span className="text-muted-foreground text-xs">—</span>;
  }
  return value ? (
    <CheckCircle2 className="h-4 w-4 text-health-green" />
  ) : (
    <XCircle className="h-4 w-4 text-destructive" />
  );
}

export default function ListingsPage() {
  const [rows, setRows] = useState<ListingPresenceRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [otaFilter, setOtaFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'mismatches'>('all');

  useEffect(() => {
    fetch('/api/listings')
      .then((r) => r.json())
      .then((j) => setRows(j.data || []))
      .finally(() => setIsLoading(false));
  }, []);

  const otas = Array.from(new Set(rows.map((r) => r.ota)));
  const totals = {
    total: rows.length,
    distributed: rows.filter((r) => r.streamline_distributed).length,
    publicLive: rows.filter((r) => r.publicly_found).length,
    extranetActive: rows.filter((r) => r.extranet_active).length,
    mismatches: rows.filter((r) => r.mismatch_flags.length > 0).length,
  };

  const filtered = rows.filter((r) => {
    if (otaFilter !== 'all' && r.ota !== otaFilter) return false;
    if (statusFilter === 'mismatches' && r.mismatch_flags.length === 0) return false;
    return true;
  });

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Listing Visibility & Presence
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Cross-OTA reconciliation between Streamline distribution, the public listing page, and
          the extranet dashboard. Mismatches surface as action items.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-semibold tabular-nums text-foreground">
              {totals.total}
            </div>
            <div className="text-xs uppercase tracking-wide text-muted-foreground mt-1">
              Unit × OTA rows
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-semibold tabular-nums text-foreground">
              {totals.distributed}
            </div>
            <div className="text-xs uppercase tracking-wide text-muted-foreground mt-1">
              Distributed
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-semibold tabular-nums text-health-green">
              {totals.publicLive}
            </div>
            <div className="text-xs uppercase tracking-wide text-muted-foreground mt-1">
              Public live
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-semibold tabular-nums text-chart-2">
              {totals.extranetActive}
            </div>
            <div className="text-xs uppercase tracking-wide text-muted-foreground mt-1">
              Extranet active
            </div>
          </CardContent>
        </Card>
        <Card className={cn(totals.mismatches > 0 && 'border-health-orange/40 bg-health-orange/5')}>
          <CardContent className="p-4">
            <div
              className={cn(
                'text-2xl font-semibold tabular-nums',
                totals.mismatches > 0 ? 'text-health-orange' : 'text-foreground',
              )}
            >
              {totals.mismatches}
            </div>
            <div className="text-xs uppercase tracking-wide text-muted-foreground mt-1">
              Mismatches
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <CardTitle>Presence audit</CardTitle>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <label className="text-xs text-muted-foreground">OTA:</label>
              <select
                value={otaFilter}
                onChange={(e) => setOtaFilter(e.target.value)}
                className="text-sm border border-border rounded-md px-2 py-1 bg-background text-foreground"
              >
                <option value="all">All</option>
                {otas.map((o) => (
                  <option key={o} value={o}>
                    {OTA_LABEL[o] || o}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="button"
              onClick={() => setStatusFilter((s) => (s === 'all' ? 'mismatches' : 'all'))}
              className={cn(
                'text-xs px-2.5 py-1 rounded-md border transition-colors',
                statusFilter === 'mismatches'
                  ? 'bg-health-orange/15 border-health-orange/40 text-health-orange'
                  : 'border-border text-muted-foreground hover:bg-accent',
              )}
            >
              {statusFilter === 'mismatches' ? 'Mismatches only' : 'Show all'}
            </button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="space-y-2 p-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-12 bg-muted rounded-md animate-pulse" />
              ))}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Unit</TableHead>
                  <TableHead>OTA</TableHead>
                  <TableHead className="text-center">Distributed</TableHead>
                  <TableHead className="text-center">Public live</TableHead>
                  <TableHead className="text-center">Extranet</TableHead>
                  <TableHead>Mismatches</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((row, i) => (
                  <TableRow key={`${row.unit_id}-${row.ota}-${i}`}>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium">{row.property_name}</span>
                        <span className="text-xs text-muted-foreground">
                          {MARKET_LABELS[row.market] || row.market}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="inline-flex items-center gap-1.5 text-sm">
                        <span className={cn('h-2 w-2 rounded-full', OTA_DOT[row.ota])} />
                        {OTA_LABEL[row.ota] || row.ota}
                      </span>
                    </TableCell>
                    <TableCell className="text-center">
                      <PresenceCell value={row.streamline_distributed} />
                    </TableCell>
                    <TableCell className="text-center">
                      <PresenceCell value={row.publicly_found} />
                    </TableCell>
                    <TableCell className="text-center">
                      <PresenceCell value={row.extranet_active} />
                    </TableCell>
                    <TableCell>
                      {row.mismatch_flags.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {row.mismatch_flags.map((flag) => (
                            <Badge key={flag} variant="warning" className="text-[10px]">
                              <AlertTriangle className="h-3 w-3" />
                              {flag.replace(/_/g, ' ')}
                            </Badge>
                          ))}
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-xs">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {row.public_url && (
                        <a
                          href={row.public_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-muted-foreground hover:text-foreground transition-colors"
                          title="Open public listing"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
