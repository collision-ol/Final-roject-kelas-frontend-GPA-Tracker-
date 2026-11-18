import DATA from '../../data.json' with { type: 'json' };

export { DATA };
export const CURRICULA = { si2024: DATA, if2024: DATA.informatika };
export const curriculumData = (id) => CURRICULA[id] || DATA;

export const WEIGHTS = {
  A: 4,
  'A-': 3.7,
  'B+': 3.3,
  B: 3,
  'B-': 2.7,
  'C+': 2.3,
  C: 2,
  'C-': 1.7,
  D: 1,
  F: 0,
};

export const EXTRA_ENGLISH_NAMES = [
  'Intermediate English I',
  'Intermediate English II',
  'Business English Correspondence',
];

export const KEY = 'gradpath-si-flow-v1';

export function calculate(records, courses = DATA.courses) {
  let credits = 0;
  let passed = 0;
  let quality = 0;
  let missing = 0;
  let count = 0;
  let failed = 0;
  let skipped = 0;
  let total = 0;

  for (const c of courses) {
    const r = records[c.id];
    if (r?.skipped) {
      skipped += Number(c.credits) || 0;
      continue;
    }
    total += Number(c.credits) || 0;
    if (!r?.selected) continue;
    count++;
    if (!Object.hasOwn(WEIGHTS, r.grade)) {
      missing++;
      continue;
    }
    const cr = Number(c.credits) || 0;
    credits += cr;
    quality += cr * WEIGHTS[r.grade];
    if (WEIGHTS[r.grade] >= 2) passed += cr;
    else failed += cr;
  }

  return {
    credits,
    passed,
    quality,
    missing,
    count,
    failed,
    skipped,
    total,
    gpa: credits ? quality / credits : null,
    remaining: total - credits,
  };
}

export function forecast(records, predictions, target, courses = DATA.courses) {
  const a = calculate(records, courses);
  let quality = a.quality;
  let missing = a.missing;

  for (const c of courses) {
    if (records[c.id]?.selected || records[c.id]?.skipped) continue;
    if (!Object.hasOwn(WEIGHTS, predictions[c.id])) missing++;
    else quality += c.credits * WEIGHTS[predictions[c.id]];
  }

  return {
    maximum: a.missing || !a.total ? null : (a.quality + 4 * a.remaining) / a.total,
    projected: missing || !a.total ? null : quality / a.total,
    missing,
  };
}

const defaultEnglishSkipped = (curriculum) =>
  Object.fromEntries(
    curriculumData(curriculum).englishIds.map((id) => [id, { skipped: true }])
  );

export const initial = (curriculum = 'si2024') => {
  const cur = Object.hasOwn(CURRICULA, curriculum) ? curriculum : 'si2024';
  return {
    records: defaultEnglishSkipped(cur),
    extras: [],
    predictions: {},
    scenarios: [],
    step: 'welcome',
    curriculum: cur,
    setupComplete: false,
    target: 3.75,
    confirmed: false,
    ack: false,
    newStudent: false,
    creditsOverrides: {},
    semesterOverrides: {},
    designVersion: 4,
  };
};

const VALID_STEPS = new Set([
  'welcome',
  'curriculum',
  'english',
  'grades',
  'review',
  'target',
  'result',
]);

export function restore(saved) {
  const cur = Object.hasOwn(CURRICULA, saved?.curriculum) ? saved.curriculum : 'si2024';
  const s = { ...initial(cur), ...saved };
  const hasRecords = saved?.records && Object.keys(saved.records).length > 0;
  s.records =
    hasRecords || saved?.setupComplete || saved?.confirmed
      ? saved?.records || {}
      : defaultEnglishSkipped(cur);
  s.predictions = saved?.predictions || {};
  s.extras = Array.isArray(saved?.extras) ? saved.extras : [];
  s.scenarios = Array.isArray(saved?.scenarios) ? saved.scenarios : [];
  s.semesterOverrides = saved?.semesterOverrides || {};
  s.creditsOverrides = saved?.creditsOverrides || {};
  s.curriculum = cur;
  s.step = VALID_STEPS.has(saved?.step) ? saved.step : 'welcome';
  if (s.step === 'result' && !s.confirmed) {
    s.step = 'grades';
  }
  s.designVersion = 4;
  return s;
}

export const fmt = (n) =>
  n === null || !Number.isFinite(n)
    ? '—'
    : n.toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function parseTarget(value) {
  const s = value.trim();
  return /^(?:\d+(?:[.,]\d{1,2})?|[.,]\d{1,2})$/.test(s) ? Number(s.replace(',', '.')) : NaN;
}

export function meetsTarget(gpa, target) {
  if (gpa === null || !Number.isFinite(gpa) || !Number.isFinite(target)) return false;
  const displayedGpa = parseTarget(fmt(gpa));
  const displayedTarget = parseTarget(fmt(target));
  return (
    Number.isFinite(displayedGpa) &&
    Number.isFinite(displayedTarget) &&
    displayedGpa + 1e-10 >= displayedTarget
  );
}

export function getCoursesForState(state) {
  const data = curriculumData(state.curriculum);
  const englishIds = data.englishIds;
  const creditsOverrides = state.creditsOverrides || {};
  const semesterOverrides = state.semesterOverrides || {};
  return [...data.courses, ...state.extras]
    .map((c) => {
      let credits = c.credits;
      if (Object.hasOwn(creditsOverrides, c.id)) {
        credits = creditsOverrides[c.id];
      } else if (englishIds.includes(c.id)) {
        credits = null;
      }
      const semester = Object.hasOwn(semesterOverrides, c.id)
        ? semesterOverrides[c.id]
        : c.semester;
      return {
        ...c,
        credits,
        semester,
      };
    })
    .sort((a, b) => (a.semester ?? 99) - (b.semester ?? 99));
}

export function getCourseDisplayName(state, course) {
  return (
    curriculumData(state.curriculum).electives.find(
      (e) => e.code === state.records[course.id]?.choice
    )?.name || course.name
  );
}

export function getIssues(state) {
  const courses = getCoursesForState(state);
  const active = courses.filter((c) => !state.records[c.id]?.skipped);
  const a = calculate(state.records, courses);
  const out = [];

  if (a.missing) {
    out.push(`${a.missing} mata kuliah dicentang belum memiliki nilai. Periksa semua semester.`);
  }
  if (!a.count) {
    out.push('Centang dan isi nilai minimal satu mata kuliah untuk melanjutkan.');
  }

  const seen = new Set();
  for (const c of active.filter((item) => item.elective)) {
    const r = state.records[c.id];
    if (r?.selected && !r.choice) {
      out.push(`Pilih nama mata kuliah elective semester ${c.semester}.`);
    }
    if (r?.choice) {
      if (seen.has(r.choice)) {
        out.push('Mata kuliah elective yang sama tidak boleh dipilih dua kali.');
      }
      seen.add(r.choice);
    }
  }

  return [...new Set(out)];
}

export function cleanPlan(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input) || JSON.stringify(input).length > 240000) {
    throw Error('Format rencana tidak valid.');
  }
  const curriculum = input.curriculum || 'si2024';
  if (!Object.hasOwn(CURRICULA, curriculum)) {
    throw Error('Kurikulum tidak didukung.');
  }
  const result = { ...initial(curriculum), records: {} };
  const selectedData = curriculumData(curriculum);
  const englishIds = selectedData.englishIds;
  const extraIds = new Set();

  result.extras = (Array.isArray(input.extras) ? input.extras : []).slice(0, 100).map((c) => {
    if (
      !c ||
      typeof c.id !== 'string' ||
      !/^extra-[a-zA-Z0-9-]{1,100}$/.test(c.id) ||
      extraIds.has(c.id) ||
      typeof c.name !== 'string' ||
      !c.name.trim() ||
      c.name.length > 100 ||
      !Number.isInteger(c.credits) ||
      c.credits < 1 ||
      c.credits > 12 ||
      !Number.isInteger(c.semester) ||
      c.semester < 1 ||
      c.semester > 14
    ) {
      throw Error('Data kelas English belum lengkap.');
    }
    extraIds.add(c.id);
    return {
      id: c.id,
      name: c.name.trim(),
      credits: c.credits,
      semester: c.semester,
      custom: true,
      elective: false,
      code: 'ENGLISH TAMBAHAN',
    };
  });

  const all = [...selectedData.courses, ...result.extras];
  const ids = new Set(all.map((c) => c.id));
  const grade = (g) => (Object.hasOwn(WEIGHTS, g) ? g : '');
  const predictions = (p) =>
    Object.fromEntries(
      Object.entries(p || {}).filter(([id, g]) => ids.has(id) && Object.hasOwn(WEIGHTS, g))
    );

  for (const c of all) {
    const r = input.records?.[c.id];
    if (!r || typeof r !== 'object') continue;
    const skip = Boolean((englishIds.includes(c.id) || c.custom) && r.skipped === true);
    const record = {
      selected: !skip && r.selected === true,
      skipped: skip,
      grade: skip ? '' : grade(r.grade),
    };
    if (c.elective && selectedData.electives.some((e) => e.code === r.choice)) {
      record.choice = r.choice;
    }
    if (skip && r.beforeSkip) {
      record.beforeSkip = {
        selected: r.beforeSkip.selected === true,
        grade: grade(r.beforeSkip.grade),
      };
    }
    result.records[c.id] = record;
  }

  result.predictions = predictions(input.predictions);
  result.scenarios = (Array.isArray(input.scenarios) ? input.scenarios : [])
    .slice(0, 100)
    .map((s) => ({
      name: String(s?.name || 'Skenario').slice(0, 60),
      predictions: predictions(s?.predictions),
    }));

  for (const [id, cred] of Object.entries(input.creditsOverrides || {})) {
    if (ids.has(id) && Number.isInteger(cred) && cred >= 1 && cred <= 12) {
      result.creditsOverrides[id] = cred;
    }
  }
  if (input.creditsOverrides === undefined && input.confirmed === true) {
    for (const c of selectedData.courses) {
      if (englishIds.includes(c.id) && !result.records[c.id]?.skipped && Number.isInteger(c.credits)) {
        result.creditsOverrides[c.id] = c.credits;
      }
    }
  }

  for (const [id, sem] of Object.entries(input.semesterOverrides || {})) {
    if (ids.has(id) && Number.isInteger(sem) && sem >= 1 && sem <= 14) {
      result.semesterOverrides[id] = sem;
    }
  }

  result.target =
    Number.isFinite(input.target) && input.target >= 0 && input.target <= 4 ? input.target : 3.75;
  result.newStudent = false;
  result.setupComplete = input.setupComplete === true;
  result.confirmed = input.confirmed === true;
  result.ack = input.ack === true;
  result.curriculum = curriculum;
  return result;
}

export function getEnglishIssue(state) {
  const allCourses = getCoursesForState(state);
  const englishIds = curriculumData(state.curriculum).englishIds;
  const activeEnglish = allCourses.filter(
    (c) => (englishIds.includes(c.id) || c.custom) && !state.records[c.id]?.skipped
  );
  if (!activeEnglish.length) {
    return 'Pilih minimal satu kelas Bahasa Inggris untuk melanjutkan.';
  }
  const activeCourses = allCourses.filter((c) => !state.records[c.id]?.skipped);
  const invalid = activeCourses.find(
    (c) =>
      !Number.isInteger(c.credits) ||
      c.credits < 1 ||
      c.credits > 12 ||
      !Number.isInteger(c.semester) ||
      c.semester < 1 ||
      c.semester > 14
  );
  return invalid ? `Lengkapi SKS dan semester untuk ${invalid.name}.` : '';
}

export function getStepLockReason(stepId, state) {
  if (stepId === 'welcome' || stepId === 'curriculum' || stepId === 'english') {
    return '';
  }
  const englishIssue = getEnglishIssue(state);
  if (englishIssue) {
    return englishIssue;
  }
  if (stepId === 'grades') {
    return '';
  }
  const gradeIssues = getIssues(state);
  if (gradeIssues.length) {
    return gradeIssues[0];
  }
  if (stepId === 'review') {
    return '';
  }
  if (!state.confirmed) {
    return 'Konfirmasi data nilai di tahap Ringkasan terlebih dahulu.';
  }
  if (stepId === 'target') {
    return '';
  }
  if (
    stepId === 'result' &&
    (!Number.isFinite(state.target) || state.target < 0 || state.target > 4)
  ) {
    return 'Tentukan target IPK terlebih dahulu.';
  }
  return '';
}

export function resolveAllowedStep(requestedStep, state) {
  if (!VALID_STEPS.has(requestedStep)) return 'welcome';
  if (requestedStep === 'welcome' || requestedStep === 'curriculum' || requestedStep === 'english') {
    return requestedStep;
  }
  if (getEnglishIssue(state)) return 'english';
  if (requestedStep === 'grades') return 'grades';
  if (getIssues(state).length) return 'grades';
  if (requestedStep === 'review') return 'review';
  if (!state.confirmed) return 'review';
  if (requestedStep === 'target') return 'target';
  if (!Number.isFinite(state.target) || state.target < 0 || state.target > 4) {
    return 'target';
  }
  return requestedStep;
}

export function planFingerprint(value) {
  const p = JSON.parse(JSON.stringify(value));
  delete p.step;
  delete p.ack;
  delete p.confirmed;
  return JSON.stringify(p);
}
