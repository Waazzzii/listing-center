'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';

interface TopBarProps {
  pendingApprovals?: number;
}

const BREADCRUMB_MAP: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/tests': 'A/B Tests',
  '/reviews': 'Reviews',
  '/scorecards': 'Scorecards',
  '/agents': 'Agents',
  '/settings': 'Settings',
};

export default function TopBar({ pendingApprovals = 0 }: TopBarProps) {
  const pathname = usePathname();

  // Build breadcrumb segments
  const segments = pathname.split('/').filter(Boolean);
  const breadcrumbs: Array<{ label: string; href: string }> = [];

  if (segments.length > 0) {
    const topPath = '/' + segments[0];
    breadcrumbs.push({
      label: BREADCRUMB_MAP[topPath] || segments[0],
      href: topPath,
    });
  }

  // If on a property detail page: /property/[unitId]
  if (segments[0] === 'property' && segments[1]) {
    breadcrumbs[0] = { label: 'Dashboard', href: '/dashboard' };
    breadcrumbs.push({ label: `Property ${segments[1]}`, href: pathname });
  }

  return (
    <header className="sticky top-0 z-20 bg-[var(--topbar-bg)] border-b border-lc-border h-14 flex items-center justify-between px-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm">
        {breadcrumbs.map((crumb, i) => (
          <span key={crumb.href} className="flex items-center gap-2">
            {i > 0 && <span className="text-[var(--text-muted)]">/</span>}
            {i === breadcrumbs.length - 1 ? (
              <span className="font-medium text-[var(--text-primary)]">{crumb.label}</span>
            ) : (
              <Link href={crumb.href} className="text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
                {crumb.label}
              </Link>
            )}
          </span>
        ))}
      </nav>

      {/* Right side: pending approvals badge */}
      <div className="flex items-center gap-4">
        {pendingApprovals > 0 && (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            {pendingApprovals} pending approval{pendingApprovals !== 1 ? 's' : ''}
          </span>
        )}
        <span className="text-sm text-[var(--text-secondary)]">Jason Pratts</span>
      </div>
    </header>
  );
}
