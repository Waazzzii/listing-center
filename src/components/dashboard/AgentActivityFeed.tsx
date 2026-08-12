'use client';

import { useState } from 'react';
import { formatDate } from '@/lib/utils';

interface AgentExecution {
  id: string;
  agent_name: string;
  started_at: string;
  completed_at: string | null;
  status: 'running' | 'completed' | 'failed';
  summary: string | null;
  properties_processed: number | null;
  errors_count: number | null;
}

interface AgentActivityFeedProps {
  executions: AgentExecution[];
  isLoading: boolean;
}

const AGENT_LABELS: Record<string, string> = {
  data_collection: 'Data Collection',
  funnel_analysis: 'Funnel Analysis',
  content_optimizer: 'Content Optimizer',
  review_manager: 'Review Manager',
  ab_test_tracker: 'A/B Test Tracker',
  scorecard_generator: 'Scorecard Generator',
  competitive_intel: 'Competitive Intel',
};

const STATUS_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  running: { bg: 'bg-secondary', text: 'text-secondary-foreground', label: 'Running' },
  completed: { bg: 'bg-health-green/15', text: 'text-health-green', label: 'Done' },
  failed: { bg: 'bg-destructive/15', text: 'text-destructive', label: 'Failed' },
};

export default function AgentActivityFeed({ executions, isLoading }: AgentActivityFeedProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [agentFilter, setAgentFilter] = useState<string>('');

  const filtered = agentFilter
    ? executions.filter((e) => e.agent_name === agentFilter)
    : executions;

  // Unique agent names for filter dropdown
  const agentNames = Array.from(new Set(executions.map((e) => e.agent_name)));

  return (
    <div className="bg-card rounded-lg border border-border">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border flex items-center justify-between">
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="flex items-center gap-2 text-sm font-semibold text-muted-foreground"
        >
          <span className={`transition-transform ${isCollapsed ? '-rotate-90' : ''}`}>
            {'\u25BC'}
          </span>
          Agent Activity
          <span className="text-xs font-normal text-muted-foreground">({executions.length})</span>
        </button>

        {!isCollapsed && (
          <select
            className="text-xs border border-border rounded px-2 py-1 bg-card text-foreground"
            value={agentFilter}
            onChange={(e) => setAgentFilter(e.target.value)}
          >
            <option value="">All Agents</option>
            {agentNames.map((name) => (
              <option key={name} value={name}>
                {AGENT_LABELS[name] || name}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Feed */}
      {!isCollapsed && (
        <div className="max-h-96 overflow-y-auto divide-y divide-[var(--border)]">
          {isLoading ? (
            <div className="p-4 text-center text-sm text-muted-foreground">Loading...</div>
          ) : filtered.length === 0 ? (
            <div className="p-4 text-center text-sm text-muted-foreground">No agent activity yet.</div>
          ) : (
            filtered.map((exec) => {
              const style = STATUS_STYLES[exec.status] || STATUS_STYLES.completed;

              return (
                <div key={exec.id} className="px-4 py-3 hover:bg-accent transition-colors">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-foreground">
                      {AGENT_LABELS[exec.agent_name] || exec.agent_name}
                    </span>
                    <span className={`text-xs px-1.5 py-0.5 rounded ${style.bg} ${style.text}`}>
                      {style.label}
                    </span>
                  </div>
                  {exec.summary && (
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{exec.summary}</p>
                  )}
                  <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                    <span>{formatDate(exec.started_at?.split('T')[0])}</span>
                    {exec.properties_processed !== null && (
                      <span>{exec.properties_processed} properties</span>
                    )}
                    {exec.errors_count !== null && exec.errors_count > 0 && (
                      <span className="text-destructive">{exec.errors_count} errors</span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
