import React, { useEffect, useRef } from 'react';
import {
  WEIGHTS,
  calculate,
  fmt,
  forecast,
  getCourseDisplayName,
  getCoursesForState,
  meetsTarget,
} from '../engine/gpaEngine';
import { ArrowIcon } from '../components/StepActions';
import { SaveToAccountBar } from '../components/SaveToAccountBar';
import { playMotion } from '../utils/motion';

const GRADE_KEYS = Object.keys(WEIGHTS);

export function ResultPage({
  state,
  setState,
  simSemester,
  setSimSemester,
  accountContext,
  cloudLast,
  cloudBusy,
  onSaveAccount,
  onEditGrades,
  onChangeTarget,
}) {
  const projectionRef = useRef(null);

  const allCourses = getCoursesForState(state);
  const activeCourses = allCourses.filter((c) => !state.records[c.id]?.skipped);
  const remainingCourses = activeCourses.filter((c) => !state.records[c.id]?.selected);

  const calc = calculate(state.records, allCourses);
  const fc = forecast(state.records, state.predictions, state.target, allCourses);
  const blocked = calc.failed > 0;
  const rows = remainingCourses.filter(
    (c) => simSemester === 'all' || String(c.semester) === String(simSemester)
  );
  const possible = meetsTarget(fc.maximum, state.target);
  const projectedMet = meetsTarget(fc.projected, state.target);
  const maxSemester = Math.max(8, ...allCourses.map((c) => Number(c.semester) || 1));

  // Pulse target-reached glow
  useEffect(() => {
    if (!projectionRef.current) return;
    projectionRef.current.classList.toggle('target-reached', projectedMet);
  }, [projectedMet]);

  const flashSimRows = (targetId, isBulk) => {
    queueMicrotask(() => {
      document.querySelectorAll('#simRows tr').forEach((row, i) => {
        const control = row.querySelector('[data-predict]');
        if (!control) return;
        const match = isBulk || control.dataset.predict === targetId;
        if (match) {
          playMotion(
            row,
            [{ backgroundColor: '#7777ff40' }, { backgroundColor: 'transparent' }],
            { duration: 650, delay: Math.min(i * 25, 200) }
          );
        }
      });
    });
  };

  const handleBulkPredict = (grade) => {
    setState((prev) => {
      const next = { ...prev.predictions };
      for (const c of remainingCourses) {
        next[c.id] = grade;
      }
      return { ...prev, predictions: next };
    });
    flashSimRows(null, true);
  };

  const handlePredict = (id, grade) => {
    setState((prev) => ({
      ...prev,
      predictions: { ...prev.predictions, [id]: grade },
    }));
    flashSimRows(id, false);
  };

  const hasFailingPrediction = remainingCourses.some(
    (c) => Object.hasOwn(WEIGHTS, state.predictions[c.id]) && WEIGHTS[state.predictions[c.id]] < 2
  );

  return (
    <>
      <header className="results-head">
        <h1 tabIndex={-1}>Target &amp; simulasi.</h1>
        <h2>
          {blocked
            ? 'Simulasi menunggu aturan mengulang.'
            : `Target IPK ${fmt(state.target)} ${
                possible ? 'masih memungkinkan.' : 'belum memungkinkan.'
              }`}
        </h2>
        <p className="maximum">IPK maksimum {blocked ? '—' : fmt(fc.maximum)}</p>
        <p className="small">
          {calc.credits} SKS dinilai · {calc.remaining} SKS tersisa
        </p>
      </header>

      {blocked ? (
        <>
          <p className="notice">
            {calc.failed} SKS memiliki nilai di bawah C. IPK saat ini {fmt(calc.gpa)}.
            Perhitungan penggantian nilai belum tersedia dalam MVP.
          </p>
          <div className="actions">
            <button className="primary" id="edit" type="button" onClick={onEditGrades}>
              Edit nilai <ArrowIcon />
            </button>
          </div>
        </>
      ) : (
        <div className="simulation">
          <section>
            <p className="intro">Ubah nilai asumsi untuk melihat proyeksi IPK.</p>

            <div className="toolbar">
              <label>
                Semester
                <select
                  id="simSemester"
                  value={simSemester}
                  onChange={(e) => setSimSemester(e.target.value)}
                >
                  <option value="all">Semua semester</option>
                  {Array.from({ length: maxSemester }, (_, i) => i + 1).map((s) => (
                    <option key={s} value={String(s)}>
                      Semester {s}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Isi nilai semua semester
                <select
                  id="bulk"
                  value=""
                  disabled={!remainingCourses.length}
                  onChange={(e) => handleBulkPredict(e.target.value)}
                >
                  <option value="">Pilih nilai</option>
                  {GRADE_KEYS.map((g) => (
                    <option key={g} value={g}>
                      {g}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <table className="table">
              <thead>
                <tr>
                  <th>Mata kuliah</th>
                  <th>SKS</th>
                  <th>Nilai asumsi</th>
                </tr>
              </thead>
              <tbody id="simRows">
                {rows.length ? (
                  rows.map((c) => {
                    const displayName = getCourseDisplayName(state, c);
                    return (
                      <tr key={c.id}>
                        <td className="course-name">{displayName}</td>
                        <td>{c.credits}</td>
                        <td>
                          <select
                            data-predict={c.id}
                            aria-label={`Nilai asumsi ${displayName}`}
                            value={state.predictions[c.id] || ''}
                            onChange={(e) => handlePredict(c.id, e.target.value)}
                          >
                            <option value="">—</option>
                            {GRADE_KEYS.map((g) => (
                              <option key={g} value={g}>
                                {g}
                              </option>
                            ))}
                          </select>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={3} className="empty">
                      {remainingCourses.length
                        ? 'Tidak ada nilai tersisa pada semester ini.'
                        : 'Semua mata kuliah sudah dinilai.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>

            <div className="actions">
              <div className="links">
                <button
                  className="text-button underlined"
                  id="changeTarget"
                  type="button"
                  onClick={onChangeTarget}
                >
                  Ubah target
                </button>
                <button
                  className="text-button underlined"
                  id="edit"
                  type="button"
                  onClick={onEditGrades}
                >
                  Edit nilai
                </button>
              </div>
            </div>
          </section>

          <aside className="scenario-panel">
            <div className="projection" aria-live="polite" ref={projectionRef}>
              <div className="projection-line">
                <span className="projection-label">Proyeksi IPK</span>
                <span className="projection-score">{fmt(fc.projected)}</span>
              </div>
              <p>
                {fc.missing
                  ? `${fc.missing} nilai asumsi belum diisi di seluruh semester.`
                  : fc.projected === null
                  ? 'Belum ada SKS untuk dihitung.'
                  : `Skenario ini ${
                      projectedMet ? 'mencapai' : 'belum mencapai'
                    } target ${fmt(state.target)}.`}
              </p>
              {hasFailingPrediction ? (
                <p className="small">
                  Ada nilai asumsi di bawah C; mata kuliah tersebut belum lulus.
                </p>
              ) : null}
            </div>

            <SaveToAccountBar
              state={state}
              accountContext={accountContext}
              cloudLast={cloudLast}
              cloudBusy={cloudBusy}
              onSaveClick={onSaveAccount}
            />
          </aside>
        </div>
      )}
    </>
  );
}
