import React, { useEffect, useRef, useState } from 'react';
import { useTheme } from './hooks/useTheme';
import { useGradPathStore } from './hooks/useGradPathStore';
import { useAccount } from './hooks/useAccount';
import { fmt, resolveAllowedStep } from './engine/gpaEngine';
import { playMotion, reduceMotionQuery } from './utils/motion';
import { TopControls } from './components/TopControls';
import { StepNav } from './components/StepNav';
import { AccountDialog } from './components/AccountDialog';
import { NotificationsDialog } from './components/NotificationsDialog';
import { ChatWidget } from './components/ChatWidget';
import { WelcomePage } from './pages/WelcomePage';
import { CurriculumPage } from './pages/CurriculumPage';
import { EnglishPage } from './pages/EnglishPage';
import { GradesPage } from './pages/GradesPage';
import { ReviewPage } from './pages/ReviewPage';
import { TargetPage } from './pages/TargetPage';
import { ResultPage } from './pages/ResultPage';
import { KaprodiPage } from './pages/KaprodiPage';

const MOTION_STEPS = ['welcome', 'curriculum', 'english', 'grades', 'review', 'target', 'result'];

export default function App() {
  const { theme, toggleTheme } = useTheme();
  const store = useGradPathStore();
  const account = useAccount({
    state: store.state,
    setState: store.setState,
    toast: store.toast,
    persistGuest: store.persistGuest,
    clearPrivateDrafts: store.clearPrivateDrafts,
    loadGuestState: store.loadGuestState,
  });

  const { state, setState, go, invalidateState, persistGuest } = store;
  const activeStep = resolveAllowedStep(state.step, state);
  const showKaprodi = Boolean(account.cloudUser && account.userRole === 'kaprodi');
  const isChatVisible = !showKaprodi && ['review', 'target', 'result'].includes(activeStep);
  const [chatOpen, setChatOpen] = useState(() => window.innerWidth >= 1024);

  useEffect(() => {
    document.body.dataset.chat = isChatVisible && chatOpen ? 'left' : 'none';
    return () => {
      document.body.dataset.chat = 'none';
    };
  }, [isChatVisible, chatOpen]);

  const mainRef = useRef(null);
  const stageRef = useRef(null);
  const motionStepRef = useRef('');
  const motionNumbersRef = useRef(new Map());
  const motionFrameRef = useRef(0);
  const motionFinalizersRef = useRef([]);

  // Persist guest state to localStorage when state changes
  useEffect(() => {
    persistGuest(state, Boolean(account.accountContext));
  }, [state, account.accountContext, persistGuest]);

  // Step & number count-up motion
  useEffect(() => {
    const finishMotion = () => {
      cancelAnimationFrame(motionFrameRef.current);
      motionFinalizersRef.current.forEach((fn) => fn());
      motionFinalizersRef.current = [];
    };

    const reduceMotion = reduceMotionQuery();
    finishMotion();

    const currentView = showKaprodi ? 'kaprodi' : activeStep;
    const prevStep = motionStepRef.current;
    const changed = prevStep !== currentView;
    const back = MOTION_STEPS.indexOf(currentView) < MOTION_STEPS.indexOf(prevStep);

    document.body.dataset.page = currentView;

    if (changed && stageRef.current) {
      const vtActive = Boolean(document.documentElement.dataset.navDir);
      if (!vtActive) {
        playMotion(
          stageRef.current,
          [
            { opacity: 0, transform: `translateX(${back ? -32 : 32}px) scale(.98)` },
            { opacity: 1, transform: 'none' },
          ],
          { duration: 420 }
        );
      }
      document
        .querySelectorAll(
          '.page-stage h1,.page-stage header p,.welcome .hero-copy p,.welcome .hero-copy .actions,.curriculum-choices .choice,.english-row,.toolbar,.summary-rows .stat,.target-form > *,.results-head > *,.projection,.scenario,.kaprodi-student-card:nth-child(-n+10),.kaprodi-plan-card,.page-stage .actions'
        )
        .forEach((el, i) =>
          playMotion(
            el,
            vtActive
              ? [{ transform: 'translateY(12px)' }, { transform: 'none' }]
              : [
                  { opacity: 0, transform: 'translateY(16px)', filter: 'blur(4px)' },
                  { opacity: 1, transform: 'none', filter: 'blur(0)' },
                ],
            { duration: 460, delay: Math.min(i * 42, 220), fill: 'backwards' }
          )
        );
    }

    const nextNumbers = new Map();
    const tweens = [];
    document
      .querySelectorAll('.projection-line span:last-child,.below-table [data-count]')
      .forEach((el, i) => {
        const key = `${activeStep}:${i}`;
        const text = el.textContent;
        const value = Number(text.replace(',', '.'));
        const previous = motionNumbersRef.current.get(key);
        nextNumbers.set(key, value);

        if (
          text !== '—' &&
          Number.isFinite(value) &&
          Number.isFinite(previous) &&
          previous !== value &&
          !changed &&
          !reduceMotion.matches
        ) {
          const write = (n) => {
            el.textContent = el.hasAttribute('data-count') ? String(Math.round(n)) : fmt(n);
          };
          const finish = () => {
            el.textContent = text;
          };
          motionFinalizersRef.current.push(finish);
          tweens.push({ el, from: previous, to: value, write, finish });
        }
      });

    if (tweens.length) {
      const start = performance.now();
      const tick = (now) => {
        const t = Math.min(1, (now - start) / 420);
        const e = 1 - Math.pow(1 - t, 3);
        tweens.forEach((v) => {
          if (v.el.isConnected) v.write(v.from + (v.to - v.from) * e);
        });
        if (t < 1) {
          motionFrameRef.current = requestAnimationFrame(tick);
        } else {
          finishMotion();
        }
      };
      motionFrameRef.current = requestAnimationFrame(tick);
    }

    motionNumbersRef.current = nextNumbers;
    motionStepRef.current = currentView;

    const handleReduceChange = () => {
      finishMotion();
      document.getAnimations?.().forEach((a) => a.cancel());
    };
    reduceMotion.addEventListener('change', handleReduceChange);

    return () => {
      finishMotion();
      reduceMotion.removeEventListener('change', handleReduceChange);
    };
  });

  const mainClass = showKaprodi
    ? 'wide'
    : activeStep === 'welcome'
    ? 'home'
    : ['curriculum', 'target'].includes(activeStep)
    ? 'centered'
    : activeStep === 'result'
    ? 'wide'
    : '';

  return (
    <>
      <TopControls
        theme={theme}
        onToggleTheme={toggleTheme}
        cloudUser={account.cloudUser}
        cloudBusy={account.cloudBusy}
        userRole={account.userRole}
        unreadCount={account.unreadCount}
        isHome={!showKaprodi && activeStep === 'welcome'}
        onGoHome={() => {
          if (activeStep === 'welcome') {
            window.scrollTo({ top: 0, behavior: 'smooth' });
          } else {
            go('welcome');
          }
        }}
        onReset={() => store.resetAll(account.applyContext)}
        onOpenAccount={() => account.openAccount(false)}
        onOpenNotifications={account.openNotifications}
      />

      <div className="aurora" aria-hidden="true" />

      <AccountDialog
        open={account.accountDialogOpen}
        cloudUser={account.cloudUser}
        cloudReady={account.cloudReady}
        cloudBusy={account.cloudBusy}
        accountContext={account.accountContext}
        accountPlans={account.accountPlans}
        loadingPlans={account.loadingPlans}
        accountErrorText={account.accountErrorText}
        saveIntentFlag={account.saveIntentFlag}
        profileName={account.profileName}
        loadingProfile={account.loadingProfile}
        needsProfileName={account.needsProfileName}
        userRole={account.userRole}
        onClose={account.closeAccount}
        onSignIn={account.signIn}
        onSignOut={account.signOut}
        onSaveCloud={account.saveCloud}
        onLoadCloud={account.loadCloud}
        onDeleteCloud={account.deleteCloud}
        onSaveProfile={account.saveProfile}
      />

      {!showKaprodi ? (
        <NotificationsDialog
          open={account.notificationsOpen}
          notifications={account.notifications}
          loading={account.loadingNotifications}
          unreadCount={account.unreadCount}
          onClose={account.closeNotifications}
          onMarkRead={account.markNotificationRead}
          onMarkAllRead={account.markAllNotificationsRead}
        />
      ) : null}

      <div id="storageError" role="alert" hidden={!store.storageError}>
        {store.storageError}
      </div>

      <main id="app" ref={mainRef} className={mainClass}>
        {!showKaprodi && activeStep !== 'welcome' ? (
          <StepNav activeStep={activeStep} state={state} onGo={go} />
        ) : null}

        <div className="page-stage" ref={stageRef} data-step={showKaprodi ? 'kaprodi' : activeStep}>
          {showKaprodi ? (
            <KaprodiPage
              cloudClientRef={account.cloudClientRef}
              cloudUser={account.cloudUser}
              profileName={account.profileName}
              toast={store.toast}
            />
          ) : (
            <>
              {activeStep === 'welcome' && (
                <WelcomePage onStart={() => go('curriculum')} />
              )}

              {activeStep === 'curriculum' && (
                <CurriculumPage
                  currentCurriculum={state.curriculum}
                  onNext={(chosen) => {
                    store.switchCurriculum(
                      chosen,
                      account.accountContext,
                      account.cloudLast,
                      account.applyContext
                    );
                    go('english');
                  }}
                  onBack={() => go('welcome')}
                />
              )}

              {activeStep === 'english' && (
                <EnglishPage
                  state={state}
                  setState={setState}
                  invalidateState={invalidateState}
                  message={store.message}
                  setMessage={store.setMessage}
                  toast={store.toast}
                  onNext={() => go('grades')}
                  onBack={() => go('curriculum')}
                />
              )}

              {activeStep === 'grades' && (
                <GradesPage
                  state={state}
                  setState={setState}
                  invalidateState={invalidateState}
                  semester={store.semester}
                  setSemester={store.setSemester}
                  message={store.message}
                  setMessage={store.setMessage}
                  toast={store.toast}
                  onNext={() => go('review')}
                  onBack={() => go('english')}
                />
              )}

              {activeStep === 'review' && (
                <ReviewPage
                  state={state}
                  setState={setState}
                  onNext={() => go('target')}
                  onBack={() => go('grades')}
                />
              )}

              {activeStep === 'target' && (
                <TargetPage
                  state={state}
                  setState={setState}
                  onNext={() => go('result')}
                  onBack={() => go('review')}
                />
              )}

              {activeStep === 'result' && (
                <ResultPage
                  state={state}
                  setState={setState}
                  simSemester={store.simSemester}
                  setSimSemester={store.setSimSemester}
                  accountContext={account.accountContext}
                  cloudLast={account.cloudLast}
                  cloudBusy={account.cloudBusy}
                  onSaveAccount={() => account.openAccount(true)}
                  onEditGrades={() => go('grades')}
                  onChangeTarget={() => go('target')}
                />
              )}
            </>
          )}
        </div>
      </main>

      <div id="toast" role="status" hidden={!store.toastVisible}>
        {store.toastText}
      </div>

      {!showKaprodi ? (
        <ChatWidget
          state={{ ...state, step: activeStep }}
          cloudUser={account.cloudUser}
          cloudClientRef={account.cloudClientRef}
          accountContext={account.accountContext}
          accountRevision={account.accountRevision}
          onOpenAccount={account.openAccount}
          isOpen={chatOpen}
          onToggleOpen={setChatOpen}
        />
      ) : null}
    </>
  );
}
