'use client';

import React from 'react';
import type { PendingRatingUI } from '@/hooks/useReviews';

interface Props {
  ratings: PendingRatingUI[];
}

export default function PendingRatingsQueue({ ratings }: Props) {
  if (ratings.length === 0) {
    return (
      <div className="text-center py-12 text-[var(--text-muted)]">
        <p className="text-lg font-medium">No pending guest ratings</p>
        <p className="mt-1 text-sm">All guest ratings are up to date.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-[var(--border)]">
        <thead className="bg-[var(--surface)]">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-medium text-[var(--text-muted)] uppercase">Guest</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-[var(--text-muted)] uppercase">Property</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-[var(--text-muted)] uppercase">Checkout</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-[var(--text-muted)] uppercase">Deadline</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-[var(--text-muted)] uppercase">Urgency</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-[var(--text-muted)] uppercase">Status</th>
          </tr>
        </thead>
        <tbody className="bg-[var(--card-bg)] divide-y divide-[var(--border)]">
          {ratings.map((rating) => {
            const daysLeft = rating.days_until_deadline;
            let urgencyColor = 'text-green-600';
            let urgencyLabel = `${daysLeft} days`;
            if (daysLeft < 0) {
              urgencyColor = 'text-red-600 font-bold';
              urgencyLabel = 'OVERDUE';
            } else if (daysLeft <= 1) {
              urgencyColor = 'text-red-600 font-bold';
              urgencyLabel = daysLeft === 0 ? 'TODAY' : '1 day';
            } else if (daysLeft <= 3) {
              urgencyColor = 'text-orange-600 font-semibold';
              urgencyLabel = `${daysLeft} days`;
            }

            return (
              <tr key={rating.id} className={rating.is_urgent ? 'bg-red-50' : 'hover:bg-[var(--table-row-hover)]'}>
                <td className="px-4 py-3 text-sm font-medium text-[var(--text-primary)]">{rating.guest_name}</td>
                <td className="px-4 py-3 text-sm text-[var(--text-secondary)]">{rating.property_name || '—'}</td>
                <td className="px-4 py-3 text-sm text-[var(--text-secondary)]">{rating.checkout_date}</td>
                <td className="px-4 py-3 text-sm text-[var(--text-secondary)]">{rating.rating_deadline}</td>
                <td className={`px-4 py-3 text-sm ${urgencyColor}`}>{urgencyLabel}</td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    rating.submission_status === 'submitted' ? 'bg-green-100 text-green-700' :
                    rating.submission_status === 'failed' ? 'bg-red-100 text-red-700' :
                    'bg-[var(--surface)] text-[var(--text-secondary)]'
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
