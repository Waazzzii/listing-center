'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';
import { useABTests } from '@/hooks/useABTests';
import ActiveTestsTable from '@/components/tests/ActiveTestsTable';
import CompletedTestsTable from '@/components/tests/CompletedTestsTable';
import TestCreationFlow from '@/components/tests/TestCreationFlow';
import LearningEngine from '@/components/tests/LearningEngine';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type Tab = 'active' | 'completed' | 'learning';

export default function TestsPage() {
  const { activeTests, completedTests, isLoading, error, refresh } = useABTests();
  const [activeTab, setActiveTab] = useState<Tab>('active');
  const [showCreateModal, setShowCreateModal] = useState(false);

  const tabs: { key: Tab; label: string; count: number | null }[] = [
    { key: 'active', label: 'Active', count: activeTests.length },
    { key: 'completed', label: 'Completed', count: completedTests.length },
    { key: 'learning', label: 'Learning Engine', count: null },
  ];

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            A/B Test Tracker
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Track listing changes, measure impact, and build institutional knowledge.
          </p>
        </div>
        <Button size="sm" onClick={() => setShowCreateModal(true)}>
          <Plus className="h-3.5 w-3.5" />
          New test
        </Button>
      </div>

      <div className="border-b border-border">
        <nav className="flex gap-6">
          {tabs.map(({ key, label, count }) => (
            <button
              key={key}
              type="button"
              onClick={() => setActiveTab(key)}
              className={cn(
                'py-2.5 px-1 border-b-2 text-sm font-medium transition-colors',
                activeTab === key
                  ? 'border-foreground text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground',
              )}
            >
              {label}
              {count !== null && (
                <span className="ml-1.5 text-xs text-muted-foreground tabular-nums">
                  ({count})
                </span>
              )}
            </button>
          ))}
        </nav>
      </div>

      {isLoading && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 bg-muted rounded-md animate-pulse" />
          ))}
        </div>
      )}

      {error && (
        <Card className="border-destructive/40 bg-destructive/5">
          <CardContent className="p-4">
            <p className="text-sm text-destructive">Failed to load tests: {error}</p>
          </CardContent>
        </Card>
      )}

      {!isLoading && !error && (
        <>
          {activeTab === 'active' && <ActiveTestsTable tests={activeTests} />}
          {activeTab === 'completed' && <CompletedTestsTable tests={completedTests} />}
          {activeTab === 'learning' && <LearningEngine />}
        </>
      )}

      {showCreateModal && (
        <TestCreationFlow
          onClose={() => setShowCreateModal(false)}
          onCreated={() => {
            setShowCreateModal(false);
            refresh();
          }}
        />
      )}
    </div>
  );
}
