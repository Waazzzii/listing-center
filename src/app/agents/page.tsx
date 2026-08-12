'use client';

import {
  Bot,
  Activity,
  TrendingUp,
  Tag,
  FileText,
  Star,
  Gauge,
  Sparkles,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface AgentInfo {
  name: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  schedule: string;
  status: 'live' | 'scheduled' | 'paused';
  lastRun: string;
  proposed: number;
  approved: number;
  executed: number;
}

const AGENTS: AgentInfo[] = [
  {
    name: 'Data Collection',
    icon: Activity,
    description: 'Weekly authenticated scrape of Airbnb performance pages across all host accounts.',
    schedule: 'Sun 02:00 UTC',
    status: 'live',
    lastRun: '6 hours ago',
    proposed: 0,
    approved: 0,
    executed: 1107,
  },
  {
    name: 'Pricing Optimizer',
    icon: TrendingUp,
    description: 'Compares Wheelhouse asking rate against demand signals; recommends adjustments.',
    schedule: 'Daily 07:07 UTC',
    status: 'live',
    lastRun: '2 hours ago',
    proposed: 14,
    approved: 8,
    executed: 6,
  },
  {
    name: 'Discount Optimizer',
    icon: Tag,
    description: 'Length-of-stay, early-bird, and last-minute discount strategy per market.',
    schedule: 'Daily 06:03 UTC',
    status: 'live',
    lastRun: '3 hours ago',
    proposed: 9,
    approved: 4,
    executed: 4,
  },
  {
    name: 'Revenue Pacer',
    icon: Gauge,
    description: 'Tracks bookings against projection; flags at-risk properties twice daily.',
    schedule: 'Daily 08:12 / 14:12 UTC',
    status: 'live',
    lastRun: '45 min ago',
    proposed: 22,
    approved: 12,
    executed: 8,
  },
  {
    name: 'Content Optimizer',
    icon: FileText,
    description: 'Title, description, and amenity tuning. Weekly runs to avoid OTA throttling.',
    schedule: 'Mon 06:17 UTC',
    status: 'scheduled',
    lastRun: '4 days ago',
    proposed: 5,
    approved: 3,
    executed: 3,
  },
  {
    name: 'Review Manager',
    icon: Star,
    description: 'Drafts review responses, surfaces sentiment shifts, queues guest ratings.',
    schedule: 'On demand',
    status: 'live',
    lastRun: '12 min ago',
    proposed: 18,
    approved: 14,
    executed: 12,
  },
  {
    name: 'Testing Engine',
    icon: Sparkles,
    description: 'Snapshots A/B test deltas at 21-day soak; classifies outcomes; suggests reverts.',
    schedule: 'Daily 10:47 UTC',
    status: 'live',
    lastRun: '5 hours ago',
    proposed: 3,
    approved: 2,
    executed: 2,
  },
  {
    name: 'Scorecard Generator',
    icon: FileText,
    description: 'Monthly owner-facing PDF scorecards with health, revenue, and recommendations.',
    schedule: 'Monthly (1st)',
    status: 'scheduled',
    lastRun: '17 days ago',
    proposed: 1051,
    approved: 0,
    executed: 0,
  },
];

const STATUS_VARIANT = {
  live: 'success' as const,
  scheduled: 'info' as const,
  paused: 'warning' as const,
};

export default function AgentsPage() {
  const totalProposed = AGENTS.reduce((s, a) => s + a.proposed, 0);
  const totalApproved = AGENTS.reduce((s, a) => s + a.approved, 0);
  const totalExecuted = AGENTS.reduce((s, a) => s + a.executed, 0);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Agents</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {AGENTS.length} optimization agents running across the portfolio. Each agent proposes
          actions, awaits human approval where required, and executes against the OTA.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-semibold tabular-nums text-foreground">
              {totalProposed}
            </div>
            <div className="text-xs uppercase tracking-wide text-muted-foreground mt-1">
              Actions proposed (7d)
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-semibold tabular-nums text-chart-2">
              {totalApproved}
            </div>
            <div className="text-xs uppercase tracking-wide text-muted-foreground mt-1">
              Awaiting approval
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-semibold tabular-nums text-health-green">
              {totalExecuted}
            </div>
            <div className="text-xs uppercase tracking-wide text-muted-foreground mt-1">
              Executed (7d)
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {AGENTS.map((agent) => {
          const Icon = agent.icon;
          return (
            <Card key={agent.name} className="hover:border-foreground/20 transition-colors">
              <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-3">
                <div className="flex items-start gap-3 min-w-0">
                  <div className="flex h-9 w-9 items-center justify-center rounded-md bg-secondary text-secondary-foreground shrink-0">
                    <Icon className="h-4.5 w-4.5" />
                  </div>
                  <div className="min-w-0">
                    <CardTitle className="text-base">{agent.name}</CardTitle>
                    <CardDescription className="mt-1">{agent.description}</CardDescription>
                  </div>
                </div>
                <Badge variant={STATUS_VARIANT[agent.status]} dot>
                  {agent.status}
                </Badge>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-4 gap-3 pt-3 border-t border-border">
                  <div>
                    <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                      Schedule
                    </div>
                    <div className="text-xs font-medium text-foreground mt-1">{agent.schedule}</div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                      Last run
                    </div>
                    <div className="text-xs font-medium text-foreground mt-1">{agent.lastRun}</div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                      Proposed
                    </div>
                    <div className="text-xs font-medium text-foreground tabular-nums mt-1">
                      {agent.proposed}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                      Executed
                    </div>
                    <div
                      className={cn(
                        'text-xs font-medium tabular-nums mt-1',
                        agent.executed > 0 ? 'text-health-green' : 'text-foreground',
                      )}
                    >
                      {agent.executed}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card className="bg-muted/30 border-dashed">
        <CardContent className="p-6 flex items-start gap-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-secondary text-secondary-foreground shrink-0">
            <Bot className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">
              More agents on the roadmap
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              Image / content seasonality, event opportunities (Phoenix Open, Coachella, BNP),
              pricing anomaly detector, and fee optimization land in Phase F.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
