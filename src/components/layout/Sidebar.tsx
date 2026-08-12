'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import {
  LayoutDashboard,
  Building2,
  ListChecks,
  Star,
  FileBarChart,
  FlaskConical,
  Bot,
  Settings,
  Moon,
  Sun,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Overview',
    items: [
      { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
      { label: 'Properties', href: '/property', icon: Building2 },
      { label: 'Listings', href: '/listings', icon: ListChecks },
    ],
  },
  {
    label: 'Performance',
    items: [
      { label: 'Reviews', href: '/reviews', icon: Star },
      { label: 'Scorecards', href: '/scorecards', icon: FileBarChart },
    ],
  },
  {
    label: 'Optimization',
    items: [
      { label: 'A/B Tests', href: '/tests', icon: FlaskConical },
      { label: 'Agents', href: '/agents', icon: Bot },
    ],
  },
];

const FOOTER_ITEM: NavItem = { label: 'Settings', href: '/settings', icon: Settings };

export default function Sidebar() {
  const pathname = usePathname();
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    setIsDark(document.documentElement.classList.contains('dark'));
  }, []);

  function toggleTheme() {
    const html = document.documentElement;
    if (html.classList.contains('dark')) {
      html.classList.remove('dark');
      localStorage.setItem('theme', 'light');
      setIsDark(false);
    } else {
      html.classList.add('dark');
      localStorage.setItem('theme', 'dark');
      setIsDark(true);
    }
  }

  function isItemActive(href: string): boolean {
    if (pathname === href) return true;
    if (href === '/property' && pathname.startsWith('/property/')) return true;
    return false;
  }

  return (
    <aside className="fixed left-0 top-0 bottom-0 w-56 z-30 flex flex-col bg-sidebar text-sidebar-foreground border-r border-sidebar-border">
      {/* Brand */}
      <div className="flex items-center gap-2.5 px-4 py-4 border-b border-sidebar-border">
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground text-sm font-bold">
          L
        </div>
        <div className="min-w-0">
          <div className="text-sm font-semibold leading-tight tracking-tight truncate">
            Listing Center
          </div>
          <div className="text-[11px] text-muted-foreground truncate">ACME House Co</div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-2 py-3 overflow-y-auto">
        {NAV_GROUPS.map((group) => (
          <div key={group.label} className="mb-3">
            <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              {group.label}
            </div>
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const active = isItemActive(item.href);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      'flex items-center gap-2.5 px-2.5 py-2 rounded-md text-sm font-medium transition-colors',
                      active
                        ? 'bg-primary text-primary-foreground'
                        : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                    )}
                  >
                    <Icon className={cn('h-4 w-4 shrink-0', active ? 'opacity-100' : 'opacity-70')} />
                    <span className="truncate">{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="px-2 py-2 border-t border-sidebar-border space-y-0.5">
        <Link
          href={FOOTER_ITEM.href}
          className={cn(
            'flex items-center gap-2.5 px-2.5 py-2 rounded-md text-sm font-medium transition-colors',
            pathname === FOOTER_ITEM.href
              ? 'bg-primary text-primary-foreground'
              : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
          )}
        >
          <Settings className="h-4 w-4 shrink-0 opacity-70" />
          <span>{FOOTER_ITEM.label}</span>
        </Link>
        <button
          type="button"
          onClick={toggleTheme}
          className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md text-sm font-medium text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors"
          aria-label="Toggle dark mode"
        >
          {isDark ? (
            <Sun className="h-4 w-4 shrink-0 opacity-70" />
          ) : (
            <Moon className="h-4 w-4 shrink-0 opacity-70" />
          )}
          <span>{isDark ? 'Light mode' : 'Dark mode'}</span>
        </button>
      </div>
    </aside>
  );
}
