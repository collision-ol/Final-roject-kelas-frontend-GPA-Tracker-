import React, { useState } from 'react';
import {
  EXTRA_ENGLISH_NAMES,
  curriculumData,
  getCoursesForState,
  getEnglishIssue,
} from '../engine/gpaEngine';
import { StepHeader, StepActions } from '../components/StepActions';

export function EnglishPage({
  state,
  setState,
  invalidateState,
  message,
  setMessage,
  toast,
  onNext,
  onBack,
}) {
  const [extraName, setExtraName] = useState('');
  const [extraCredits, setExtraCredits] = useState('');
  const [extraSemester, setExtraSemester] = useState('');
  const [extraError, setExtraError] = useState('');

  const allCourses = getCoursesForState(state);
  const englishIds = curriculumData(state.curriculum).englishIds;
  const baseCourses = allCourses.filter((c) => englishIds.includes(c.id));
  const extraCourses = allCourses.filter((c) => c.custom);
  const customOnly = extraCourses.filter(
    (c) => !EXTRA_ENGLISH_NAMES.some((n) => n.toLowerCase() === c.name.toLowerCase())
  );

  const toggleBaseEnglish = (id, checked) => {
    setMessage('');
    setState((prev) => {
      const r = { ...(prev.records[id] || {}) };
      if (!checked) {
        r.beforeSkip = { selected: Boolean(r.selected), grade: r.grade || '' };
        r.selected = false;
        r.skipped = true;
        delete r.grade;
      } else {
        const before = r.beforeSkip || { selected: false };
        Object.assign(r, before);
        r.skipped = false;
        delete r.beforeSkip;
      }
      return invalidateState({
        ...prev,
        records: { ...prev.records, [id]: r },
      });
    });
  };

  const addCatalogCourse = (name) => {
    setMessage('');
    const id = 'extra-' + Date.now();
    setState((prev) =>
      invalidateState({
        ...prev,
        extras: [
          ...prev.extras,
          {
            id,
            code: 'ENGLISH TAMBAHAN',
            name,
            credits: null,
            semester: null,
            custom: true,
            elective: false,
          },
        ],
        records: { ...prev.records, [id]: { selected: false } },
      })
    );
  };

  const updateCourseCredits = (id, raw) => {
    setMessage('');
    const val = raw === '' ? null : Number(raw);
    setState((prev) =>
      invalidateState({
        ...prev,
        creditsOverrides: { ...prev.creditsOverrides, [id]: val },
        extras: prev.extras.map((c) => (c.id === id ? { ...c, credits: val } : c)),
      })
    );
  };

  const updateCourseSemester = (id, raw) => {
    setMessage('');
    const val = raw === '' ? null : Number(raw);
    setState((prev) =>
      invalidateState({
        ...prev,
        semesterOverrides: { ...prev.semesterOverrides, [id]: val },
        extras: prev.extras.map((c) => (c.id === id ? { ...c, semester: val } : c)),
      })
    );
  };

  const handleManualSubmit = (e) => {
    e.preventDefault();
    const name = extraName.trim();
    const credits = Number(extraCredits);
    const semester = Number(extraSemester);
    if (
      !name ||
      !Number.isInteger(credits) ||
      credits < 1 ||
      credits > 12 ||
      !Number.isInteger(semester) ||
      semester < 1 ||
      semester > 14
    ) {
      setExtraError('Isi nama kelas, SKS 1–12, dan semester 1–14.');
      return;
    }
    if (allCourses.some((c) => c.name.toLowerCase() === name.toLowerCase())) {
      setExtraError('Kelas sudah ada. Pilih kelas tersebut di daftar.');
      return;
    }
    const id = 'extra-' + Date.now();
    setState((prev) =>
      invalidateState({
        ...prev,
        extras: [
          ...prev.extras,
          {
            id,
            name,
            credits,
            semester,
            custom: true,
            elective: false,
            code: 'ENGLISH TAMBAHAN',
          },
        ],
      })
    );
    setExtraName('');
    setExtraCredits('');
    setExtraSemester('');
    setExtraError('');
    toast('Kelas ditambahkan.');
  };

  const handleNext = () => {
    const issue = getEnglishIssue(state);
    if (issue) {
      setMessage(issue);
      return;
    }
    setState((prev) => ({ ...prev, setupComplete: true }));
    onNext();
  };

  const renderEnglishRow = (c) => {
    const on = !state.records[c.id]?.skipped;
    return (
      <div className="english-row" key={c.id}>
        <label className={`english-label ${on ? '' : 'off'}`}>
          <input
            type="checkbox"
            checked={on}
            onChange={(e) => toggleBaseEnglish(c.id, e.target.checked)}
          />
          <span>{c.name}</span>
        </label>
        {on ? (
          <div className="english-settings">
            <label>
              SKS sesuai KHS
              <input
                type="number"
                min={1}
                max={12}
                step={1}
                aria-label={`SKS ${c.name}`}
                value={c.credits ?? ''}
                placeholder="SKS"
                onChange={(e) => updateCourseCredits(c.id, e.target.value)}
              />
            </label>
            <label>
              Semester diambil
              <input
                type="number"
                min={1}
                max={14}
                step={1}
                aria-label={`Semester ${c.name}`}
                value={c.semester ?? ''}
                placeholder="Semester"
                onChange={(e) => updateCourseSemester(c.id, e.target.value)}
              />
            </label>
          </div>
        ) : null}
      </div>
    );
  };

  return (
    <>
      <StepHeader
        title="Kelas Bahasa Inggris."
        subtitle={
          <>
            Kelas Bahasa Inggris mengikuti hasil penempatan,
            <br />
            sehingga bisa berbeda dari kurikulum.
          </>
        }
      />
      <section className="english">
        <p className="intro">Pilih kelas yang sudah kamu ambil.</p>

        <div id="englishList">
          {baseCourses.map(renderEnglishRow)}
          {EXTRA_ENGLISH_NAMES.map((name) => {
            const existing = extraCourses.find(
              (c) => c.name.toLowerCase() === name.toLowerCase()
            );
            return existing ? (
              renderEnglishRow(existing)
            ) : (
              <div className="english-row" key={name}>
                <label className="english-label off">
                  <input type="checkbox" onChange={() => addCatalogCourse(name)} />
                  <span>{name}</span>
                </label>
              </div>
            );
          })}
          {customOnly.map(renderEnglishRow)}
        </div>

        <details className="manual">
          <summary>Tambah kelas manual</summary>
          <form id="extraForm" onSubmit={handleManualSubmit}>
            <div className="manual-grid">
              <label>
                Nama kelas
                <input
                  id="extraName"
                  required
                  maxLength={100}
                  placeholder="Nama kelas English"
                  value={extraName}
                  onChange={(e) => setExtraName(e.target.value)}
                />
              </label>
              <label>
                SKS
                <input
                  id="extraCredits"
                  type="number"
                  min={1}
                  max={12}
                  step={1}
                  required
                  placeholder="3"
                  value={extraCredits}
                  onChange={(e) => setExtraCredits(e.target.value)}
                />
              </label>
              <label>
                Semester diambil
                <input
                  id="extraSemester"
                  type="number"
                  min={1}
                  max={14}
                  step={1}
                  required
                  placeholder="1"
                  value={extraSemester}
                  onChange={(e) => setExtraSemester(e.target.value)}
                />
              </label>
            </div>
            <button className="outline" type="submit">
              Tambahkan
            </button>
            <div className="error" id="extraError" role="alert">
              {extraError}
            </div>
          </form>
        </details>

        <p className="skip-note">
          Kelas yang tidak dipilih dilewati tanpa pengakuan SKS.
        </p>
        <div className="error" id="englishError" role="alert">
          {message}
        </div>
        <StepActions
          nextLabel="Lanjut"
          onNext={handleNext}
          backLabel="Kembali"
          onBack={onBack}
        />
      </section>
    </>
  );
}
