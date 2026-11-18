import React, { useState } from 'react';
import { calculate, fmt, getCoursesForState, parseTarget } from '../engine/gpaEngine';
import { StepHeader, StepActions } from '../components/StepActions';

export function TargetPage({
  state,
  setState,
  onNext,
  onBack,
}) {
  const [targetInput, setTargetInput] = useState(() =>
    Number.isFinite(state.target) ? fmt(state.target) : ''
  );
  const [targetError, setTargetError] = useState('');

  const allCourses = getCoursesForState(state);
  const calc = calculate(state.records, allCourses);

  const handleSubmit = (e) => {
    e.preventDefault();
    const target = parseTarget(targetInput);
    if (!Number.isFinite(target) || target < 0 || target > 4) {
      setTargetError('Masukkan IPK 0,00–4,00, maksimal dua angka desimal.');
      return;
    }
    setTargetError('');
    setState((prev) => ({ ...prev, target }));
    onNext();
  };

  return (
    <>
      <StepHeader
        title="Tentukan target IPK-mu."
        subtitle="Berapa IPK yang ingin kamu capai saat lulus?"
      />

      <form id="targetForm" className="target-form" onSubmit={handleSubmit}>
        <p className="current">IPK saat ini: {fmt(calc.gpa)}</p>
        <label htmlFor="target">Target IPK</label>
        <input
          id="target"
          inputMode="decimal"
          autoComplete="off"
          required
          placeholder="3,75"
          value={targetInput}
          onChange={(e) => {
            setTargetInput(e.target.value);
            if (targetError) setTargetError('');
          }}
        />
        <p className="range">0,00 – 4,00</p>
        <div id="targetError" className="error" role="alert">
          {targetError}
        </div>
        <StepActions
          nextLabel="Lihat hasil"
          nextType="submit"
          backLabel="Kembali"
          onBack={onBack}
        />
      </form>
    </>
  );
}
