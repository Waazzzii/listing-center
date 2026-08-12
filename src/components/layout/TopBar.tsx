'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { ChevronRight, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface TopBarProps {
  pendingApprovals?: number;
}

const BREADCRUMB_MAP: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/property': 'Properties',
  '/listings': 'Listings',
  '/tests': 'A/B Tests',
  '/reviews': 'Reviews',
  '/scorecards': 'Scorecards',
  '/agents': 'Agents',
  '/settings': 'Settings',
};

export default function TopBar({ pendingApprovals = 0 }: TopBarProps) {
  const pathname = usePathname();

  const segments = pathname.split('/').filter(Boolean);
  const breadcrumbs: Array<{ label: string; href: string }> = [
    { label: 'Listing Center', href: '/dashboard' },
  ];

  if (segments.length > 0) {
    const topPath = '/' + segments[0];
    breadcrumbs.push({
      label: BREADCRUMB_MAP[topPath] ?? segments[0],
      href: topPath,
    });
  }

  if (segments[0] === 'property' && segments[1]) {
    breadcrumbs.push({ label: `Property ${segments[1]}`, href: pathname });
  }

  return (
    <header className="sticky top-0 z-20 h-14 flex items-center justify-between gap-4 px-6 bg-background border-b border-border">
      <nav className="flex items-center gap-1.5 text-sm min-w-0">
        {breadcrumbs.map((crumb, i) => {
          const isLast = i === breadcrumbs.length - 1;
          return (
            <span key={`${crumb.href}-${i}`} className="flex items-center gap-1.5 min-w-0">
              {i > 0 && <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
              {isLast ? (
                <span className="font-medium text-foreground truncate">{crumb.label}</span>
              ) : (
                <Link
                  href={crumb.href}
                  className="text-muted-foreground hover:text-foreground transition-colors truncate"
                >
                  {crumb.label}
                </Link>
              )}
            </span>
          );
        })}
      </nav>

      <div className="flex items-center gap-3">
        {pendingApprovals > 0 && (
          <Badge variant="danger" dot>
            {pendingApprovals} pending approval{pendingApprovals !== 1 ? 's' : ''}
          </Badge>
        )}
        <Button variant="outline" size="sm" className="hidden sm:inline-flex">
          <RefreshCw className="h-3.5 w-3.5" />
          Refresh data
        </Button>
        <div className="hidden md:flex items-center gap-2 pl-3 border-l border-border">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-secondary text-secondary-foreground text-xs font-medium">
            JP
          </div>
          <span className="text-sm text-foreground hidden lg:inline">Jason Pratts</span>
        </div>
      </div>
    </header>
  );
}
