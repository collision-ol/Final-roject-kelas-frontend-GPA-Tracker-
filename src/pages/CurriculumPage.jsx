import React, { useState } from 'react';
import { StepHeader, StepActions } from '../components/StepActions';

const OPTIONS = [
  ['si2024', 'Sistem Informasi 2024'],
  ['if2024', 'Informatika 2024'],
];

export function CurriculumPage({ currentCurriculum, onNext, onBack }) {
  const [selected, setSelected] = useState(currentCurriculum);

  return (
    <>
      <StepHeader title="Pilih kurikulummu." />
      <div className="curriculum-choices">
        {OPTIONS.map(([id, label]) => (
          <div
            key={id}
            className="choice curriculum-option"
            onClick={(e) => {
              if (e.target.closest('a')) return;
              setSelected(id);
            }}
          >
            <input
              id={`curriculum-${id}`}
              type="radio"
              name="curriculum"
              checked={selected === id}
              value={id}
              onChange={() => setSelected(id)}
            />
            <div className="curriculum-copy">
              <label className="curriculum-name" htmlFor={`curriculum-${id}`}>
                {label}
              </label>
              <a
                className="curriculum-preview"
                href={`./curricula/${id}.pdf`}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`Lihat kurikulum ${label}, PDF di tab baru`}
              >
                Lihat kurikulum <span aria-hidden="true">↗</span>
              </a>
            </div>
          </div>
        ))}
      </div>
      <StepActions
        nextLabel="Lanjut"
        onNext={() => onNext(selected)}
        backLabel="Kembali"
        onBack={onBack}
      />
    </>
  );
}
