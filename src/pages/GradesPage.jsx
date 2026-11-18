import React from 'react';
import {
  WEIGHTS,
  calculate,
  curriculumData,
  getCourseDisplayName,
  getCoursesForState,
  getIssues,
} from '../engine/gpaEngine';
import { StepHeader, StepActions } from '../components/StepActions';
import { playMotion } from '../utils/motion';

const GRADE_KEYS = Object.keys(WEIGHTS);

export function GradesPage({
  state,
  setState,
  invalidateState,
  semester,
  setSemester,
  message,
  setMessage,
  toast,
  onNext,
  onBack,
}) {
  const allCourses = getCoursesForState(state);
  const activeCourses = allCourses.filter((c) => !state.records[c.id]?.skipped);
  const calc = calculate(state.records, allCourses);
  const rows = activeCourses.filter((c) => semester === 'all' || String(c.semester) === String(semester));
  const electives = curriculumData(state.curriculum).electives;
  const maxSemester = Math.max(8, ...allCourses.map((c) => Number(c.semester) || 1));

  const flashRows = (targetId, isBulk) => {
    queueMicrotask(() => {
      document.querySelectorAll('#gradeRows tr').forEach((row, i) => {
        const control = row.querySelector('[data-check]');
        if (!control) return;
        const match = isBulk ? control.checked : control.dataset.check === targetId;
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

  const handleBulkGrade = (grade) => {
    if (!Object.hasOwn(WEIGHTS, grade)) return;
    setMessage('');
    let count = 0;
    setState((prev) => {
      const nextRecords = { ...prev.records };
      for (const c of activeCourses) {
        const r = nextRecords[c.id];
        if (r?.selected) {
          nextRecords[c.id] = { ...r, grade };
          count++;
        }
      }
      return invalidateState({ ...prev, records: nextRecords });
    });
    flashRows(null, true);
    toast(`${count} mata kuliah yang dicentang diisi nilai ${grade}.`);
  };

  const handleCheck = (id, checked, inputEl) => {
    setMessage('');
    setState((prev) => {
      const r = { ...(prev.records[id] || {}), selected: checked };
      if (!checked) delete r.grade;
      return invalidateState({
        ...prev,
        newStudent: false,
        records: { ...prev.records, [id]: r },
      });
    });
    if (inputEl) {
      queueMicrotask(() => {
        const replacement = document.querySelector(`[data-check="${id}"]`);
        if (replacement?.isConnected) {
          playMotion(
            replacement,
            [{ transform: 'scale(.8)' }, { transform: 'scale(1.18)' }, { transform: 'scale(1)' }],
            { duration: 300 }
          );
        }
      });
    }
    flashRows(id, false);
  };

  const handleGrade = (id, grade) => {
    setMessage('');
    setState((prev) => {
      const r = { ...(prev.records[id] || {}), grade };
      return invalidateState({
        ...prev,
        records: { ...prev.records, [id]: r },
      });
    });
    flashRows(id, false);
  };

  const handleChoice = (id, choice) => {
    setMessage('');
    setState((prev) => {
      const r = { ...(prev.records[id] || {}), choice };
      return invalidateState({
        ...prev,
        records: { ...prev.records, [id]: r },
      });
    });
  };

  const handleNext = () => {
    const errors = getIssues(state);
    if (errors.length) {
      setMessage(errors.join(' '));
      return;
    }
    setState((prev) => ({ ...prev, ack: false }));
    onNext();
  };

  return (
    <>
      <StepHeader
        title="Isi nilaimu."
        subtitle="Centang mata kuliah yang sudah mendapat nilai akhir."
      />
      <div className="toolbar">
        <label>
          Semester
          <select id="semester" value={semester} onChange={(e) => setSemester(e.target.value)}>
            <option value="all">Semua semester</option>
            {Array.from({ length: maxSemester }, (_, i) => i + 1).map((s) => (
              <option key={s} value={String(s)}>
                Semester {s}
              </option>
            ))}
          </select>
        </label>
        <label>
          Isi nilai yang dicentang
          <select
            id="bulkGrade"
            value=""
            disabled={!calc.count}
            onChange={(e) => handleBulkGrade(e.target.value)}
          >
            <option value="">Pilih nilai</option>
            {GRADE_KEYS.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
          <span className="small muted" style={{ fontWeight: 400 }}>
            Semua semester · hanya yang dicentang
          </span>
        </label>
      </div>

      <table className="table">
        <thead>
          <tr>
            <th>Mata kuliah</th>
            <th>SKS</th>
            <th>Nilai</th>
          </tr>
        </thead>
        <tbody id="gradeRows">
          {rows.length ? (
            rows.map((c) => {
              const r = state.records[c.id] || {};
              const displayName = getCourseDisplayName(state, c);
              return (
                <tr key={c.id}>
                  <td>
                    <label className="course-label">
                      <input
                        type="checkbox"
                        data-check={c.id}
                        checked={Boolean(r.selected)}
                        aria-label={`Sudah mendapat nilai: ${displayName}`}
                        onChange={(e) => handleCheck(c.id, e.target.checked, e.target)}
                      />
                      <span className="course-name">{displayName}</span>
                    </label>
                    {c.elective ? (
                      <select
                        className="elective"
                        data-choice={c.id}
                        aria-label={`Elective semester ${c.semester} ${c.id}`}
                        value={r.choice || ''}
                        onChange={(e) => handleChoice(c.id, e.target.value)}
                      >
                        <option value="">Pilih mata kuliah</option>
                        {electives.map((el) => (
                          <option key={el.code} value={el.code}>
                            {el.name}
                          </option>
                        ))}
                      </select>
                    ) : null}
                  </td>
                  <td>{c.credits}</td>
                  <td>
                    <select
                      data-grade={c.id}
                      aria-label={`Nilai ${displayName}`}
                      disabled={!r.selected}
                      value={r.grade || ''}
                      onChange={(e) => handleGrade(c.id, e.target.value)}
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
                Tidak ada mata kuliah pada semester ini.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      <p className="below-table">
        <span data-count="">{calc.count}</span> mata kuliah ·{' '}
        <span data-count="">{calc.credits}</span> SKS dinilai
        {calc.failed ? ` · ${calc.failed} SKS belum lulus` : ''}
      </p>

      <div className="error" id="inputError" role="alert">
        {message}
      </div>
      <StepActions
        nextLabel="Lanjut"
        onNext={handleNext}
        backLabel="Kembali"
        onBack={onBack}
      />
    </>
  );
}
