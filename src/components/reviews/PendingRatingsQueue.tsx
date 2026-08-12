'use client';

import { Star } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { MARKET_LABELS } from '@/lib/constants';
import { cn } from '@/lib/utils';
import type { PendingRatingUI } from '@/hooks/useReviews';

interface Props {
  ratings: PendingRatingUI[];
}

const STATUS_VARIANT: Record<string, 'success' | 'danger' | 'secondary'> = {
  submitted: 'success',
  failed: 'danger',
  pending: 'secondary',
};

export default function PendingRatingsQueue({ ratings }: Props) {
  if (ratings.length === 0) {
    return (
      <Card>
        <CardContent className="p-0">
          <EmptyState
            icon={Star}
            title="No pending guest ratings"
            description="All guest ratings are up to date."
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Guest</TableHead>
              <TableHead>Property</TableHead>
              <TableHead>Checkout</TableHead>
              <TableHead>Deadline</TableHead>
              <TableHead className="text-right">Urgency</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {ratings.map((rating) => {
              const daysLeft = rating.days_until_deadline;
              let urgencyClass = 'text-health-green';
              let urgencyLabel = `${daysLeft} days`;
              if (daysLeft < 0) {
                urgencyClass = 'text-destructive font-semibold';
                urgencyLabel = 'OVERDUE';
              } else if (daysLeft <= 1) {
                urgencyClass = 'text-destructive font-semibold';
                urgencyLabel = daysLeft === 0 ? 'Today' : '1 day';
              } else if (daysLeft <= 3) {
                urgencyClass = 'text-health-orange font-medium';
              }

              return (
                <TableRow
                  key={rating.id}
                  className={cn(rating.is_urgent && 'bg-destructive/5')}
                >
                  <TableCell className="font-medium">{rating.guest_name}</TableCell>
                  <TableCell>
                    {rating.property_name ? (
                      <div className="flex flex-col">
                        <span className="text-foreground">{rating.property_name}</span>
                        {rating.market && (
                          <span className="text-xs text-muted-foreground">
                            {MARKET_LABELS[rating.market] || rating.market}
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground tabular-nums">
                    {rating.checkout_date}
                  </TableCell>
                  <TableCell className="text-muted-foreground tabular-nums">
                    {rating.rating_deadline}
                  </TableCell>
                  <TableCell className={cn('text-right tabular-nums', urgencyClass)}>
                    {urgencyLabel}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={STATUS_VARIANT[rating.submission_status] || 'secondary'}
                      dot
                    >
                      {rating.submission_status}
                    </Badge>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
