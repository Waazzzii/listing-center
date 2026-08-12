import * as React from 'react';
import { cn } from '@/lib/utils';

interface ChannelDotsProps {
  airbnb?: string | null;
  vrbo?: string | null;
  booking?: string | null;
  className?: string;
}

interface ChannelDotProps {
  active: boolean;
  label: string;
  dotClass: string;
}

function ChannelDot({ active, label, dotClass }: ChannelDotProps) {
  return (
    <span
      title={`${label}${active ? ' — distributed' : ' — not on this channel'}`}
      className={cn(
        'inline-block h-2.5 w-2.5 rounded-full transition-all',
        active ? dotClass : 'bg-border',
      )}
    />
  );
}

export function ChannelDots({ airbnb, vrbo, booking, className }: ChannelDotsProps) {
  return (
    <div className={cn('flex items-center gap-1.5', className)}>
      <ChannelDot active={!!airbnb} label="Airbnb" dotClass="bg-destructive" />
      <ChannelDot active={!!vrbo} label="VRBO" dotClass="bg-chart-3" />
      <ChannelDot active={!!booking} label="Booking.com" dotClass="bg-chart-4" />
    </div>
  );
}
