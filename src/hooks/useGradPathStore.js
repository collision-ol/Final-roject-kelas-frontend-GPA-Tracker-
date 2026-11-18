import { useState, useRef, useCallback, useEffect } from 'react';
import {
  CURRICULA,
  KEY,
  initial,
  restore,
  getCoursesForState,
  getCourseDisplayName,
  getIssues,
  resolveAllowedStep,
} from '../engine/gpaEngine';
import { getNavDirection, runViewTransition } from '../utils/motion';

export const ACTIVE_SESSION_KEY = 'gradpath-active-session';

const VALID_STEPS = new Set([
  'welcome',
  'curriculum',
  'english',
  'grades',
  'review',
  'target',
  'result',
]);

export function useGradPathStore() {
  const [state, setState] = useState(() => {
    try {
      const active = JSON.parse(sessionStorage.getItem(ACTIVE_SESSION_KEY));
      if (active?.accountContext?.userId && active?.state && typeof active.state === 'object') {
        return restore(active.state);
      }
    } catch {
      // Ignore malformed session storage.
    }
    try {
      const saved = JSON.parse(localStorage.getItem(KEY));
      if (saved && typeof saved === 'object') {
        return restore(saved);
      }
    } catch {
      // Ignore malformed storage.
    }
    return initial();
  });

  const [semester, setSemester] = useState('1');
  const [simSemester, setSimSemester] = useState('all');
  const [message, setMessage] = useState('');
  const [toastText, setToastText] = useState('');
  const [toastVisible, setToastVisible] = useState(false);
  const [storageError, setStorageError] = useState('');

  const curriculumDraftsRef = useRef(new Map());
  const toastTimerRef = useRef(null);
  const currentStepRef = useRef(state.step);
  currentStepRef.current = state.step;

  const toast = useCallback((text) => {
    clearTimeout(toastTimerRef.current);
    setToastText(text);
    setToastVisible(true);
    toastTimerRef.current = setTimeout(() => setToastVisible(false), 3500);
  }, []);

  useEffect(() => () => clearTimeout(toastTimerRef.current), []);

  const persistGuest = useCallback((nextState, hasAccountContext) => {
    if (hasAccountContext) return;
    try {
      localStorage.setItem(KEY, JSON.stringify(nextState));
      localStorage.setItem(`${KEY}-${nextState.curriculum}`, JSON.stringify(nextState));
      setStorageError('');
    } catch {
      setStorageError(
        'Penyimpanan browser tidak tersedia. Data akan hilang saat halaman ditutup.'
      );
    }
  }, []);

  const go = useCallback((step) => {
    const dir = getNavDirection(currentStepRef.current, step);
    let targetStep = step;
    runViewTransition(dir, () => {
      setMessage('');
      setState((prev) => {
        targetStep = resolveAllowedStep(step, prev);
        return { ...prev, step: targetStep };
      });
      currentStepRef.current = targetStep;
      window.scrollTo(0, 0);
    });
    const targetUrl = targetStep === 'welcome' ? window.location.pathname : `#${targetStep}`;
    const targetHash = targetStep === 'welcome' ? '' : `#${targetStep}`;
    if (window.location.hash !== targetHash || window.history.state?.step !== targetStep) {
      window.history.pushState({ step: targetStep }, '', targetUrl);
    }
    requestAnimationFrame(() => {
      document.querySelector('h1')?.focus({ preventScroll: true });
    });
  }, []);

  useEffect(() => {
    const search = window.location.search;
    if (!search.includes('code=') && !search.includes('error=')) {
      const hashStep = window.location.hash.replace(/^#/, '');
      const requestedStep = VALID_STEPS.has(hashStep) ? hashStep : state.step;
      const initialStep = resolveAllowedStep(requestedStep, state);
      const targetUrl = initialStep === 'welcome' ? window.location.pathname : `#${initialStep}`;
      window.history.replaceState({ step: initialStep }, '', targetUrl);
      if (initialStep !== state.step) {
        setState((prev) => ({
          ...prev,
          step: resolveAllowedStep(initialStep, prev),
        }));
      }
    }

    const onPopState = (e) => {
      const hashStep = window.location.hash.replace(/^#/, '');
      const candidate = e.state?.step || (VALID_STEPS.has(hashStep) ? hashStep : 'welcome');
      const requested = VALID_STEPS.has(candidate) ? candidate : 'welcome';
      const dir = getNavDirection(currentStepRef.current, requested);
      let resolved = requested;
      runViewTransition(dir, () => {
        setMessage('');
        setState((prev) => {
          resolved = resolveAllowedStep(requested, prev);
          if (prev.step === resolved) return prev;
          return { ...prev, step: resolved };
        });
        currentStepRef.current = resolved;
        window.scrollTo(0, 0);
      });
      if (resolved !== requested) {
        const resolvedUrl = resolved === 'welcome' ? window.location.pathname : `#${resolved}`;
        window.history.replaceState({ step: resolved }, '', resolvedUrl);
      }
    };

    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const invalidateState = (s) => ({
    ...s,
    confirmed: false,
    ack: false,
  });

  const clearPrivateDrafts = useCallback(() => {
    for (const [id, draft] of curriculumDraftsRef.current) {
      if (draft.context) curriculumDraftsRef.current.delete(id);
    }
  }, []);

  const courses = getCoursesForState(state);
  const active = courses.filter((c) => !state.records[c.id]?.skipped);
  const remaining = active.filter((c) => !state.records[c.id]?.selected);
  const courseName = (c) => getCourseDisplayName(state, c);
  const issues = () => getIssues(state);

  const loadGuestState = useCallback(() => {
    try {
      return restore(JSON.parse(localStorage.getItem(KEY)) || {});
    } catch {
      return initial();
    }
  }, []);

  const switchCurriculum = useCallback(
    (id, currentContext, currentCloudLast, applyContext) => {
      if (!Object.hasOwn(CURRICULA, id) || id === state.curriculum) return;
      persistGuest(state, Boolean(currentContext));
      curriculumDraftsRef.current.set(state.curriculum, {
        state: JSON.parse(JSON.stringify(state)),
        context: currentContext,
        last: typeof currentCloudLast === 'string' ? currentCloudLast : '',
      });

      let draft = curriculumDraftsRef.current.get(id);
      if (!draft) {
        try {
          const stored = JSON.parse(localStorage.getItem(`${KEY}-${id}`));
          if (stored?.curriculum === id) {
            draft = { state: restore(stored), context: null, last: '' };
          }
        } catch {
          // Ignore malformed draft.
        }
      }

      const nextState = draft ? draft.state : initial(id);
      setState(nextState);
      applyContext(draft?.context || null, draft?.last || '');
      setSemester('1');
      setSimSemester('all');
    },
    [state, persistGuest]
  );

  const resetAll = useCallback(
    (applyContext) => {
      if (
        !window.confirm(
          'Reset semua data input dan simulasi? Data yang sudah disimpan di akun tidak terhapus.'
        )
      ) {
        return;
      }
      curriculumDraftsRef.current.clear();
      try {
        localStorage.removeItem(KEY);
        localStorage.removeItem(`${KEY}-si2024`);
        localStorage.removeItem(`${KEY}-if2024`);
      } catch {
        // Ignore storage errors.
      }
      try {
        sessionStorage.removeItem(ACTIVE_SESSION_KEY);
      } catch {
        // Ignore session storage errors.
      }
      applyContext?.(null, '');
      runViewTransition('home', () => {
        setSemester('1');
        setSimSemester('all');
        setMessage('');
        setState(initial());
        currentStepRef.current = 'welcome';
        window.history.replaceState({ step: 'welcome' }, '', window.location.pathname);
        window.scrollTo(0, 0);
      });
      toast('Data berhasil direset.');
    },
    [toast]
  );

  return {
    state,
    setState,
    semester,
    setSemester,
    simSemester,
    setSimSemester,
    message,
    setMessage,
    toastText,
    toastVisible,
    toast,
    storageError,
    persistGuest,
    go,
    invalidateState,
    clearPrivateDrafts,
    loadGuestState,
    switchCurriculum,
    resetAll,
    courses,
    active,
    remaining,
    courseName,
    issues,
  };
}
