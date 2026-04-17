'use client';

import React, { useState, useEffect } from 'react';

interface LearningPattern {
  test_type: string;
  target_metric: string;
  total_tests: number;
  positive_count: number;
  negative_count: number;
  no_change_count: number;
  success_rate: number;
  avg_positive_lift: number;
  autonomous_eligible: boolean;
  confidence_score: number;
}

export default function LearningEngine() {
  const [patterns, setPatterns] = useState<LearningPattern[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchPatterns() {
      try {
        const res = await fetch('/api/ab-tests?view=learning');
        if (!res.ok) throw new Error('Failed to fetch learning data');
        const data = await res.json();
        setPatterns(data.patterns || []);
      } catch {
        setPatterns([]);
      } finally {
        setIsLoading(false);
      }
    }
    fetchPatterns();
  }, []);

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-4">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-20 bg-[var(--surface)] rounded-lg" />
        ))}
      </div>
    );
  }

  if (patterns.length === 0) {
    return (
      <div className="text-center py-12 text-[var(--text-muted)]">
        <p className="text-lg font-medium">Not enough data yet</p>
        <p className="mt-1 text-sm">The Learning Engine needs 10+ completed tests to surface patterns.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-[var(--text-secondary)]">
        Aggregated insights from all completed A/B tests. Patterns with 80%+ success rate across 10+ tests
        become eligible for Phase 3 autonomous execution.
      </p>

      <div className="grid gap-4">
        {patterns.map((pattern) => (
          <div key={pattern.test_type} className="bg-[var(--card-bg)] border border-[var(--border)] rounded-lg p-5">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-lg font-semibold text-[var(--text-primary)] capitalize">
                  {pattern.test_type.replace(/_/g, ' ')}
                </h3>
                <p className="text-sm text-[var(--text-muted)]">
                  Target: {pattern.target_metric.replace(/_/g, ' ')} | {pattern.total_tests} tests
                </p>
              </div>
              {pattern.autonomous_eligible && (
                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                  Autonomous Eligible
                </span>
              )}
            </div>

            {/* Success Rate Bar */}
            <div className="mb-3">
              <div className="flex justify-between text-sm mb-1">
                <span className="text-[var(--text-secondary)]">Success Rate</span>
                <span className="font-medium">{pattern.success_rate}%</span>
              </div>
              <div className="w-full bg-[var(--surface)] rounded-full h-2">
                <div
                  className={`h-2 rounded-full ${
                    pattern.success_rate >= 80 ? 'bg-green-500' :
                    pattern.success_rate >= 50 ? 'bg-yellow-500' : 'bg-red-500'
                  }`}
                  style={{ width: `${Math.min(pattern.success_rate, 100)}%` }}
                />
              </div>
            </div>

            {/* Stats Row */}
            <div className="grid grid-cols-4 gap-4 text-center text-sm">
              <div>
                <div className="text-green-600 font-semibold">{pattern.positive_count}</div>
                <div className="text-[var(--text-muted)]">Positive</div>
              </div>
              <div>
                <div className="text-red-600 font-semibold">{pattern.negative_count}</div>
                <div className="text-[var(--text-muted)]">Negative</div>
              </div>
              <div>
                <div className="text-[var(--text-secondary)] font-semibold">{pattern.no_change_count}</div>
                <div className="text-[var(--text-muted)]">No Change</div>
              </div>
              <div>
                <div className="text-blue-600 font-semibold">+{pattern.avg_positive_lift}%</div>
                <div className="text-[var(--text-muted)]">Avg Lift</div>
              </div>
            </div>

            {/* Confidence */}
            <div className="mt-3 text-xs text-[var(--text-muted)]">
              Confidence Score: {pattern.confidence_score}/100
              {!pattern.autonomous_eligible && pattern.total_tests < 10 &&
                ` (need ${10 - pattern.total_tests} more tests for autonomy consideration)`
              }
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
