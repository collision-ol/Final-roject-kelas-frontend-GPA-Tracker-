import React from 'react';

export function ArrowIcon() {
  return (
    <span className="arrow" aria-hidden="true">
      →
    </span>
  );
}

export function StepHeader({ title, subtitle }) {
  return (
    <header>
      <h1 tabIndex={-1}>{title}</h1>
      {subtitle ? <p>{subtitle}</p> : null}
    </header>
  );
}

export function StepActions({
  nextLabel,
  onNext,
  backLabel,
  onBack,
  disabled = false,
  nextType = 'button',
}) {
  return (
    <div className="actions">
      <button
        className="primary"
        id="next"
        type={nextType}
        disabled={disabled}
        onClick={nextType === 'button' ? onNext : undefined}
      >
        {nextLabel} <ArrowIcon />
      </button>
      {backLabel ? (
        <button className="text-button" id="back" type="button" onClick={onBack}>
          {backLabel}
        </button>
      ) : null}
    </div>
  );
}
