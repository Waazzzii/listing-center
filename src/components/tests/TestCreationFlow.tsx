'use client';

import React, { useState } from 'react';

interface Props {
  onClose: () => void;
  onCreated: () => void;
}

const SOAK_PERIODS: Record<string, number> = {
  hero_photo: 14,
  title: 14,
  description: 28,
  cancellation_policy: 28,
  amenities: 14,
  pricing: 28,
  checkout_time: 28,
};

function getSoakPeriodDays(testType: string): number {
  return SOAK_PERIODS[testType] ?? 21;
}

const TEST_TYPES = [
  { value: 'hero_photo', label: 'Hero Photo Swap', metric: 'ctr', description: 'Change the main search result photo' },
  { value: 'title', label: 'Title Rewrite', metric: 'ctr', description: 'Update the listing title' },
  { value: 'description', label: 'Description Update', metric: 'conversion', description: 'Improve the listing description' },
  { value: 'amenities', label: 'Amenity Addition', metric: 'conversion', description: 'Add missing amenity photos or details' },
  { value: 'cancellation_policy', label: 'Cancellation Policy', metric: 'impression_rate', description: 'Change cancellation policy flexibility' },
  { value: 'pricing', label: 'Pricing Change', metric: 'conversion', description: 'Adjust nightly rate' },
  { value: 'checkout_time', label: 'Checkout Time', metric: 'conversion', description: 'Adjust checkout time' },
];

type Step = 'type' | 'property' | 'thesis' | 'confirm';

export default function TestCreationFlow({ onClose, onCreated }: Props) {
  const [step, setStep] = useState<Step>('type');
  const [testType, setTestType] = useState('');
  const [propertyId, setPropertyId] = useState('');
  const [thesis, setThesis] = useState('');
  const [changeDescription, setChangeDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedType = TEST_TYPES.find(t => t.value === testType);
  const soakDays = testType ? getSoakPeriodDays(testType) : 0;

  async function handleSubmit() {
    setIsSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/ab-tests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          property_id: propertyId,
          test_type: testType,
          thesis,
          target_metric: selectedType?.metric || 'ctr',
          change_description: changeDescription,
          soak_period_days: soakDays,
          minimum_impressions: 3000,
        }),
      });
      if (!res.ok) throw new Error(`Failed to create test: ${res.status}`);
      onCreated();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-[var(--card-bg)] rounded-lg shadow-xl w-full max-w-lg p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-[var(--text-primary)]">Create A/B Test</h2>
          <button onClick={onClose} className="text-[var(--text-muted)] hover:text-[var(--text-secondary)] text-2xl leading-none">&times;</button>
        </div>

        {/* Step Indicator */}
        <div className="flex items-center mb-6 text-sm">
          {(['type', 'property', 'thesis', 'confirm'] as Step[]).map((s, i) => (
            <React.Fragment key={s}>
              <span className={`${step === s ? 'text-blue-600 font-semibold' : 'text-[var(--text-muted)]'}`}>
                {i + 1}. {s.charAt(0).toUpperCase() + s.slice(1)}
              </span>
              {i < 3 && <span className="mx-2 text-[var(--text-muted)]">&rarr;</span>}
            </React.Fragment>
          ))}
        </div>

        {/* Step: Select Test Type */}
        {step === 'type' && (
          <div className="space-y-3">
            <p className="text-sm text-[var(--text-secondary)] mb-4">What kind of change are you testing?</p>
            {TEST_TYPES.map(t => (
              <button
                key={t.value}
                onClick={() => { setTestType(t.value); setStep('property'); }}
                className={`w-full text-left p-3 rounded-lg border ${
                  testType === t.value ? 'border-blue-500 bg-blue-50' : 'border-[var(--border)] hover:border-[var(--border)]'
                }`}
              >
                <div className="font-medium text-[var(--text-primary)]">{t.label}</div>
                <div className="text-xs text-[var(--text-muted)] mt-1">
                  Target: {t.metric.replace(/_/g, ' ')} | Soak: {getSoakPeriodDays(t.value)} days
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Step: Select Property */}
        {step === 'property' && (
          <div className="space-y-4">
            <p className="text-sm text-[var(--text-secondary)]">Enter the property ID for this test.</p>
            <input
              type="text"
              value={propertyId}
              onChange={e => setPropertyId(e.target.value)}
              placeholder="Property UUID"
              className="w-full border border-[var(--border)] rounded-md px-3 py-2 text-sm bg-[var(--card-bg)] text-[var(--text-primary)]"
            />
            <div className="flex justify-between">
              <button onClick={() => setStep('type')} className="text-sm text-[var(--text-muted)] hover:text-[var(--text-secondary)]">Back</button>
              <button
                onClick={() => setStep('thesis')}
                disabled={!propertyId}
                className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        )}

        {/* Step: Thesis & Change Description */}
        {step === 'thesis' && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
                Thesis (required)
              </label>
              <textarea
                value={thesis}
                onChange={e => setThesis(e.target.value)}
                placeholder="I believe [change] will improve [metric] because [reasoning]"
                rows={3}
                className="w-full border border-[var(--border)] rounded-md px-3 py-2 text-sm bg-[var(--card-bg)] text-[var(--text-primary)]"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
                Change Description (required)
              </label>
              <textarea
                value={changeDescription}
                onChange={e => setChangeDescription(e.target.value)}
                placeholder="Swapped hero photo from kitchen interior to pool aerial shot"
                rows={2}
                className="w-full border border-[var(--border)] rounded-md px-3 py-2 text-sm bg-[var(--card-bg)] text-[var(--text-primary)]"
              />
            </div>
            <div className="flex justify-between">
              <button onClick={() => setStep('property')} className="text-sm text-[var(--text-muted)] hover:text-[var(--text-secondary)]">Back</button>
              <button
                onClick={() => setStep('confirm')}
                disabled={!thesis || !changeDescription}
                className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        )}

        {/* Step: Confirm */}
        {step === 'confirm' && (
          <div className="space-y-4">
            <div className="bg-[var(--surface)] rounded-lg p-4 space-y-2 text-sm">
              <div><span className="font-medium">Test Type:</span> {selectedType?.label}</div>
              <div><span className="font-medium">Target Metric:</span> {selectedType?.metric.replace(/_/g, ' ')}</div>
              <div><span className="font-medium">Soak Period:</span> {soakDays} days</div>
              <div><span className="font-medium">Thesis:</span> {thesis}</div>
              <div><span className="font-medium">Change:</span> {changeDescription}</div>
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <div className="flex justify-between">
              <button onClick={() => setStep('thesis')} className="text-sm text-[var(--text-muted)] hover:text-[var(--text-secondary)]">Back</button>
              <button
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="px-4 py-2 bg-green-600 text-white rounded-md text-sm font-medium hover:bg-green-700 disabled:opacity-50"
              >
                {isSubmitting ? 'Creating...' : 'Create Test'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
