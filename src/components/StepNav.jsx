import React from 'react';
import { getStepLockReason } from '../engine/gpaEngine';

const STEPS = [
  { id: 'curriculum', label: 'Kurikulum' },
  { id: 'english', label: 'Inggris' },
  { id: 'grades', label: 'Nilai' },
  { id: 'review', label: 'Ringkasan' },
  { id: 'target', label: 'Target' },
  { id: 'result', label: 'Proyeksi' },
];

export function StepNav({ activeStep, state, onGo }) {
  const activeIndex = Math.max(
    0,
    STEPS.findIndex((s) => s.id === activeStep)
  );
  const progressPct =
    STEPS.length > 1 ? Math.round((activeIndex / (STEPS.length - 1)) * 100) : 0;

  return (
    <nav
      className="step-nav"
      aria-label="Navigasi tahapan simulasi"
      style={{ '--step-progress': `${progressPct}%` }}
    >
      <div className="step-nav-track" aria-hidden="true">
        <span className="step-nav-fill" />
      </div>

      <ol className="step-nav-list">
        {STEPS.map((step, index) => {
          const isCurrent = step.id === activeStep;
          const isDone = index < activeIndex;
          const lockReason = isCurrent ? '' : getStepLockReason(step.id, state);
          const isLocked = Boolean(lockReason);

          return (
            <li key={step.id} className="step-nav-item">
              <button
                type="button"
                className={`step-nav-btn${isCurrent ? ' is-current' : ''}${
                  isDone ? ' is-done' : ''
                }`}
                aria-current={isCurrent ? 'step' : undefined}
                disabled={isLocked}
                title={isLocked ? lockReason : `Buka tahap ${step.label}`}
                onClick={() => {
                  if (!isCurrent && !isLocked) {
                    onGo(step.id);
                  }
                }}
              >
                <span className="step-nav-dot" aria-hidden="true">
                  {isDone ? (
                    <svg viewBox="0 0 16 16" fill="none">
                      <path
                        d="M3.5 8.5 6.5 11.5 12.5 4.8"
                        stroke="currentColor"
                        strokeWidth="2.1"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  ) : (
                    index + 1
                  )}
                </span>
                <span className="step-nav-label">{step.label}</span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
