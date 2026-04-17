'use client';

import React, { useState } from 'react';
import { useABTests } from '@/hooks/useABTests';
import ActiveTestsTable from '@/components/tests/ActiveTestsTable';
import CompletedTestsTable from '@/components/tests/CompletedTestsTable';
import TestCreationFlow from '@/components/tests/TestCreationFlow';
import LearningEngine from '@/components/tests/LearningEngine';

type Tab = 'active' | 'completed' | 'learning';

export default function TestsPage() {
  const { activeTests, completedTests, isLoading, error, refresh } = useABTests();
  const [activeTab, setActiveTab] = useState<Tab>('active');
  const [showCreateModal, setShowCreateModal] = useState(false);

  const tabs: { key: Tab; label: string }[] = [
    { key: 'active', label: `Active (${activeTests.length})` },
    { key: 'completed', label: `Completed (${completedTests.length})` },
    { key: 'learning', label: 'Learning Engine' },
  ];

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">A/B Test Tracker</h1>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            Track listing changes, measure impact, and build institutional knowledge.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={refresh}
            className="px-4 py-2 bg-[var(--card-bg)] border border-[var(--border)] rounded-md text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--table-row-hover)]"
          >
            Refresh
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700"
          >
            + New Test
          </button>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-[var(--border)] mb-6">
        <nav className="flex space-x-8">
          {tabs.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`py-3 px-1 border-b-2 text-sm font-medium ${
                activeTab === key
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:border-[var(--border)]'
              }`}
            >
              {label}
            </button>
          ))}
        </nav>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-16 bg-[var(--surface)] rounded-lg animate-pulse" />
          ))}
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-6">
          <p className="text-sm text-red-700">Failed to load tests: {error}</p>
        </div>
      )}

      {/* Tab Content */}
      {!isLoading && !error && (
        <>
          {activeTab === 'active' && <ActiveTestsTable tests={activeTests} />}
          {activeTab === 'completed' && <CompletedTestsTable tests={completedTests} />}
          {activeTab === 'learning' && <LearningEngine />}
        </>
      )}

      {/* Create Test Modal */}
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
