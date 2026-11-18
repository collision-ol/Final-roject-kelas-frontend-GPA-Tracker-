import { flushSync } from 'react-dom';

export const NAV_STEP_ORDER = [
  'welcome',
  'curriculum',
  'english',
  'grades',
  'review',
  'target',
  'result',
];

export const reduceMotionQuery = () => window.matchMedia('(prefers-reduced-motion: reduce)');

export function getNavDirection(fromStep, toStep) {
  if (!fromStep || fromStep === toStep) return 'forward';
  if (toStep === 'welcome') return 'home';
  const fromIdx = NAV_STEP_ORDER.indexOf(fromStep);
  const toIdx = NAV_STEP_ORDER.indexOf(toStep);
  if (fromIdx === -1 || toIdx === -1) return 'forward';
  return toIdx < fromIdx ? 'backward' : 'forward';
}

let activeTransitionToken = 0;

export function runViewTransition(direction, updateFn) {
  if (
    typeof document === 'undefined' ||
    typeof document.startViewTransition !== 'function' ||
    reduceMotionQuery().matches
  ) {
    updateFn();
    return false;
  }

  const token = ++activeTransitionToken;
  document.documentElement.dataset.navDir = direction || 'forward';

  try {
    const transition = document.startViewTransition(() => {
      flushSync(() => {
        updateFn();
      });
    });
    Promise.resolve(transition.ready).catch(() => {});
    Promise.resolve(transition.updateCallbackDone).catch(() => {});
    Promise.resolve(transition.finished)
      .catch(() => {})
      .finally(() => {
        if (token === activeTransitionToken) {
          delete document.documentElement.dataset.navDir;
        }
      });
    return true;
  } catch {
    delete document.documentElement.dataset.navDir;
    updateFn();
    return false;
  }
}

export function playMotion(el, frames, options = {}) {
  if (el && !reduceMotionQuery().matches && el.animate) {
    return el.animate(frames, {
      duration: 380,
      easing: 'cubic-bezier(.2,.8,.2,1)',
      ...options,
    });
  }
  return null;
}
