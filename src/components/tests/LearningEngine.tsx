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
          <div key={i} className="h-20 bg-muted rounded-lg" />
        ))}
      </div>
    );
  }

  if (patterns.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p className="text-lg font-medium">Not enough data yet</p>
        <p className="mt-1 text-sm">The Learning Engine needs 10+ completed tests to surface patterns.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        Aggregated insights from all completed A/B tests. Patterns with 80%+ success rate across 10+ tests
        become eligible for Phase 3 autonomous execution.
      </p>

      <div className="grid gap-4">
        {patterns.map((pattern) => (
          <div key={pattern.test_type} className="bg-card border border-border rounded-lg p-5">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-lg font-semibold text-foreground capitalize">
                  {pattern.test_type.replace(/_/g, ' ')}
                </h3>
                <p className="text-sm text-muted-foreground">
                  Target: {pattern.target_metric.replace(/_/g, ' ')} | {pattern.total_tests} tests
                </p>
              </div>
              {pattern.autonomous_eligible && (
                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-health-green/15 text-health-green">
                  Autonomous Eligible
                </span>
              )}
            </div>

            {/* Success Rate Bar */}
            <div className="mb-3">
              <div className="flex justify-between text-sm mb-1">
                <span className="text-muted-foreground">Success Rate</span>
                <span className="font-medium">{pattern.success_rate}%</span>
              </div>
              <div className="w-full bg-muted rounded-full h-2">
                <div
                  className={`h-2 rounded-full ${
                    pattern.success_rate >= 80 ? 'bg-health-green' :
                    pattern.success_rate >= 50 ? 'bg-health-yellow' : 'bg-destructive'
                  }`}
                  style={{ width: `${Math.min(pattern.success_rate, 100)}%` }}
                />
              </div>
            </div>

            {/* Stats Row */}
            <div className="grid grid-cols-4 gap-4 text-center text-sm">
              <div>
                <div className="text-health-green font-semibold">{pattern.positive_count}</div>
                <div className="text-muted-foreground">Positive</div>
              </div>
              <div>
                <div className="text-destructive font-semibold">{pattern.negative_count}</div>
                <div className="text-muted-foreground">Negative</div>
              </div>
              <div>
                <div className="text-muted-foreground font-semibold">{pattern.no_change_count}</div>
                <div className="text-muted-foreground">No Change</div>
              </div>
              <div>
                <div className="text-chart-2 font-semibold">+{pattern.avg_positive_lift}%</div>
                <div className="text-muted-foreground">Avg Lift</div>
              </div>
            </div>

            {/* Confidence */}
            <div className="mt-3 text-xs text-muted-foreground">
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
