import React from 'react';
import {
  calculate,
  fmt,
  getCourseDisplayName,
  getCoursesForState,
  getIssues,
} from '../engine/gpaEngine';
import { StepHeader, StepActions } from '../components/StepActions';

export function ReviewPage({
  state,
  setState,
  onNext,
  onBack,
}) {
  const allCourses = getCoursesForState(state);
  const activeCourses = allCourses.filter((c) => !state.records[c.id]?.skipped);
  const selectedCourses = activeCourses.filter((c) => state.records[c.id]?.selected);
  const calc = calculate(state.records, allCourses);

  const handleConfirm = () => {
    if (state.ack && !getIssues(state).length) {
      setState((prev) => ({ ...prev, confirmed: true }));
      onNext();
    }
  };

  return (
    <>
      <StepHeader
        title="Periksa datamu."
        subtitle="Pastikan mata kuliah dan nilai sudah sesuai."
      />

      <table className="table">
        <thead>
          <tr>
            <th>Mata kuliah</th>
            <th>SKS</th>
            <th>Nilai</th>
          </tr>
        </thead>
        <tbody>
          {selectedCourses.length ? (
            selectedCourses.map((c) => (
              <tr key={c.id}>
                <td>{getCourseDisplayName(state, c)}</td>
                <td>{c.credits}</td>
                <td>{state.records[c.id].grade}</td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={3} className="empty">
                Belum ada nilai akhir.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      <div className="summary-rows">
        <div className="stat">
          <span>Total SKS dinilai</span>
          <b>{calc.credits} SKS</b>
        </div>
        <div className="stat">
          <span>SKS lulus (minimum C)</span>
          <b>{calc.passed} SKS</b>
        </div>
        <div className="stat">
          <span>IPK sementara</span>
          <b>{fmt(calc.gpa)}</b>
        </div>
      </div>

      {calc.failed ? (
        <p className="notice">
          Ada nilai di bawah C. Simulasi kelulusan menunggu aturan mengulang.
        </p>
      ) : null}

      <label className="ack">
        <input
          id="ack"
          type="checkbox"
          checked={Boolean(state.ack)}
          onChange={(e) => {
            const checked = e.target.checked;
            setState((prev) => ({ ...prev, ack: checked }));
          }}
        />
        Data yang saya isi sudah benar.
      </label>

      <StepActions
        nextLabel="Konfirmasi"
        onNext={handleConfirm}
        backLabel="Kembali edit nilai"
        onBack={onBack}
        disabled={!state.ack}
      />
    </>
  );
}
