'use client';

import React from 'react';
import type { PendingRatingUI } from '@/hooks/useReviews';

interface Props {
  ratings: PendingRatingUI[];
}

export default function PendingRatingsQueue({ ratings }: Props) {
  if (ratings.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p className="text-lg font-medium">No pending guest ratings</p>
        <p className="mt-1 text-sm">All guest ratings are up to date.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-[var(--border)]">
        <thead className="bg-muted">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Guest</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Property</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Checkout</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Deadline</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Urgency</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Status</th>
          </tr>
        </thead>
        <tbody className="bg-card divide-y divide-[var(--border)]">
          {ratings.map((rating) => {
            const daysLeft = rating.days_until_deadline;
            let urgencyColor = 'text-health-green';
            let urgencyLabel = `${daysLeft} days`;
            if (daysLeft < 0) {
              urgencyColor = 'text-destructive font-bold';
              urgencyLabel = 'OVERDUE';
            } else if (daysLeft <= 1) {
              urgencyColor = 'text-destructive font-bold';
              urgencyLabel = daysLeft === 0 ? 'TODAY' : '1 day';
            } else if (daysLeft <= 3) {
              urgencyColor = 'text-health-orange font-semibold';
              urgencyLabel = `${daysLeft} days`;
            }

            return (
              <tr key={rating.id} className={rating.is_urgent ? 'bg-destructive/10' : 'hover:bg-accent'}>
                <td className="px-4 py-3 text-sm font-medium text-foreground">{rating.guest_name}</td>
                <td className="px-4 py-3 text-sm text-muted-foreground">{rating.property_name || '—'}</td>
                <td className="px-4 py-3 text-sm text-muted-foreground">{rating.checkout_date}</td>
                <td className="px-4 py-3 text-sm text-muted-foreground">{rating.rating_deadline}</td>
                <td className={`px-4 py-3 text-sm ${urgencyColor}`}>{urgencyLabel}</td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    rating.submission_status === 'submitted' ? 'bg-health-green/15 text-health-green' :
                    rating.submission_status === 'failed' ? 'bg-destructive/15 text-destructive' :
                    'bg-muted text-muted-foreground'
                  }`}>
                    {rating.submission_status}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
