'use client';

import { Database, KeyRound, Slack, Webhook, Mail, Users, ShieldCheck } from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

const SECTIONS = [
  {
    icon: Database,
    title: 'Data integrations',
    description: 'Streamline PMS, Wheelhouse, Supabase. Configure connection credentials.',
    items: [
      { name: 'Streamline PMS', status: 'connected' as const, detail: 'Last sync 2h ago' },
      { name: 'Wheelhouse', status: 'connected' as const, detail: 'Daily 06:00 UTC' },
      { name: 'Supabase', status: 'connected' as const, detail: '••••••••••••••••lywtt' },
    ],
  },
  {
    icon: KeyRound,
    title: 'Airbnb host accounts',
    description: '7 authenticated host accounts feeding the extranet scraper.',
    items: [
      { name: 'Casago Arizona Flannery', status: 'connected' as const, detail: '261 listings' },
      {
        name: 'Casago Coachella Valley Rasky',
        status: 'connected' as const,
        detail: '400 listings',
      },
      {
        name: 'ACME House Company Flannery',
        status: 'connected' as const,
        detail: '161 listings',
      },
      {
        name: 'Casago Arizona Flannery (Secondary)',
        status: 'connected' as const,
        detail: '282 listings',
      },
      { name: 'Casago Arizona (CasagoAZ)', status: 'pending' as const, detail: '0 listings' },
      { name: 'Casago Flannery (Legacy 1)', status: 'connected' as const, detail: '2 listings' },
      { name: 'Casago Flannery (Legacy 2)', status: 'connected' as const, detail: '1 listing' },
    ],
  },
  {
    icon: Slack,
    title: 'Notifications',
    description: 'Slack and email destinations for approvals and alerts.',
    items: [
      { name: 'Slack — #listing-center', status: 'connected' as const, detail: 'Approvals + alerts' },
      { name: 'Email digest', status: 'pending' as const, detail: 'Weekly Monday' },
    ],
  },
  {
    icon: Webhook,
    title: 'Cron schedule',
    description: 'Vercel cron jobs powering each agent.',
    items: [
      { name: 'data-collection — weekly', status: 'connected' as const, detail: 'Sun 02:00 UTC' },
      { name: 'pricing-optimizer — daily', status: 'connected' as const, detail: '07:07 UTC' },
      { name: 'discount-optimizer — daily', status: 'connected' as const, detail: '06:03 UTC' },
      { name: 'revenue-pacer — 2x daily', status: 'connected' as const, detail: '08:12 / 14:12 UTC' },
      { name: 'testing-engine — daily', status: 'connected' as const, detail: '10:47 UTC' },
    ],
  },
  {
    icon: Users,
    title: 'Team access',
    description: 'Permission keys for the Wazzi auth service.',
    items: [
      { name: 'listing_center_user', status: 'pending' as const, detail: 'Read-only · 0 users' },
      { name: 'listing_center_manager', status: 'pending' as const, detail: 'Edit · 0 users' },
      {
        name: 'listing_center_full_access',
        status: 'pending' as const,
        detail: 'Admin · 0 users',
      },
    ],
  },
  {
    icon: ShieldCheck,
    title: 'Security',
    description: 'Encryption keys, session policies, and audit log.',
    items: [
      { name: 'AIRBNB_SESSION_ENCRYPTION_KEY', status: 'connected' as const, detail: 'AES-256-GCM · 32B' },
      { name: 'Session TTL', status: 'connected' as const, detail: '30 days · auto-refresh' },
      { name: 'Audit log retention', status: 'connected' as const, detail: '90 days' },
    ],
  },
];

const VARIANT = {
  connected: 'success' as const,
  pending: 'warning' as const,
  disconnected: 'danger' as const,
};

export default function SettingsPage() {
  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Integrations, host accounts, notifications, schedules, team access, and security.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {SECTIONS.map((section) => {
          const Icon = section.icon;
          return (
            <Card key={section.title}>
              <CardHeader className="flex flex-row items-start gap-3 space-y-0 pb-4">
                <div className="flex h-9 w-9 items-center justify-center rounded-md bg-secondary text-secondary-foreground shrink-0">
                  <Icon className="h-4.5 w-4.5" />
                </div>
                <div className="flex-1 min-w-0">
                  <CardTitle className="text-base">{section.title}</CardTitle>
                  <CardDescription className="mt-1">{section.description}</CardDescription>
                </div>
                <Button variant="outline" size="sm">
                  Manage
                </Button>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 pt-3 border-t border-border">
                  {section.items.map((item) => (
                    <li key={item.name} className="flex items-center justify-between gap-3 text-sm">
                      <div className="min-w-0 flex-1">
                        <div className="text-foreground font-medium truncate">{item.name}</div>
                        <div className="text-xs text-muted-foreground">{item.detail}</div>
                      </div>
                      <Badge variant={VARIANT[item.status]} dot>
                        {item.status}
                      </Badge>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card className="bg-muted/30 border-dashed">
        <CardContent className="p-6 flex items-start gap-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-secondary text-secondary-foreground shrink-0">
            <Mail className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">Need to add a teammate?</p>
            <p className="text-sm text-muted-foreground mt-1">
              Once <code className="font-mono text-xs px-1 rounded bg-muted">wazzi-auth</code> is
              wired up, invite teammates with the right permission key (user / manager /
              full_access). Until then, access is limited to Vercel project members.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
