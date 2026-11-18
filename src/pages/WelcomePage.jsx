import React, { useEffect, useRef } from 'react';
import { ArrowIcon } from '../components/StepActions';
import { playMotion, reduceMotionQuery } from '../utils/motion';

const TEAM_MEMBERS = [
  { name: 'Kartika Sari', nim: 'NIM 105012410022', photo: './team/kartika.jpeg' },
  { name: 'Tangkulung, Feily Galeina', nim: 'NIM 105022410011', photo: './team/feily.jpeg' },
  { name: 'Frans, Justin Jonathan', nim: 'NIM 105012420075', photo: './team/justin.jpeg' },
  { name: 'Rantung, Natanael Rolando', nim: 'NIM 105012410004', photo: './team/natanael.png' },
  { name: 'Kafiar, Jeremy Belfast Utrek', nim: 'NIM 105022410060', photo: './team/jeremy.jpeg' },
  { name: 'Rotty, Bernathan Imanuel Dirly', nim: 'NIM 10502241018', photo: './team/bernathan.jpeg' },
];

export function WelcomePage({ onStart }) {
  const heroRef = useRef(null);
  const aboutRef = useRef(null);
  const teamRef = useRef(null);

  useEffect(() => {
    const hero = heroRef.current;
    if (!hero) return undefined;

    const reduceMotion = reduceMotionQuery();
    const objects = [...hero.querySelectorAll('[data-depth]')];
    const controller = new AbortController();
    const { signal } = controller;

    let frame = 0;
    let x = 0;
    let y = 0;
    let tx = 0;
    let ty = 0;
    let visible = true;

    const frameLoop = () => {
      frame = 0;
      if (!visible || document.hidden || reduceMotion.matches) return;
      x += (tx - x) * 0.09;
      y += (ty - y) * 0.09;
      const progress = Math.min(
        1,
        Math.max(0, -hero.getBoundingClientRect().top / hero.offsetHeight)
      );
      objects.forEach((el, i) => {
        const d = Number(el.dataset.depth);
        const side = i % 2 ? -1 : 1;
        el.style.transform = `translate3d(${x * 24 * d + side * progress * 75}px,${
          y * 18 * d - progress * 55
        }px,0) rotateX(${-y * 10 * d}deg) rotateY(${x * 16 * d}deg) rotateZ(${
          progress * side * 14
        }deg)`;
      });
      if (Math.abs(tx - x) + Math.abs(ty - y) > 0.002) {
        frame = requestAnimationFrame(frameLoop);
      }
    };

    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(frameLoop);
    };

    hero.addEventListener(
      'pointermove',
      (e) => {
        if (e.pointerType === 'touch') return;
        const r = hero.getBoundingClientRect();
        tx = ((e.clientX - r.left) / r.width) * 2 - 1;
        ty = ((e.clientY - r.top) / r.height) * 2 - 1;
        schedule();
      },
      { signal }
    );
    hero.addEventListener(
      'pointerleave',
      () => {
        tx = 0;
        ty = 0;
        schedule();
      },
      { signal }
    );
    window.addEventListener('scroll', schedule, { passive: true, signal });
    document.addEventListener('visibilitychange', schedule, { signal });

    const heroObserver = new IntersectionObserver((entries) => {
      visible = entries[0].isIntersecting;
      hero
        .querySelectorAll('.object-inner')
        .forEach((el) => (el.style.animationPlayState = visible ? 'running' : 'paused'));
      if (visible) schedule();
    });
    heroObserver.observe(hero);

    const revealObserver = new IntersectionObserver(
      (entries) =>
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            playMotion(
              entry.target,
              [
                { opacity: 0, transform: 'translateY(36px)' },
                { opacity: 1, transform: 'none' },
              ],
              { duration: 700 }
            );
            revealObserver.unobserve(entry.target);
          }
        }),
      { threshold: 0.15 }
    );
    document.querySelectorAll('[data-reveal]').forEach((el) => revealObserver.observe(el));

    document.querySelectorAll('.portrait-space').forEach((space) => {
      const frameEl = space.querySelector('.portrait-frame');
      space.addEventListener(
        'pointermove',
        (e) => {
          if (reduceMotion.matches || e.pointerType === 'touch') return;
          const r = space.getBoundingClientRect();
          frameEl.style.transform = `rotateX(${
            (-(e.clientY - r.top - r.height / 2) / r.height) * 16
          }deg) rotateY(${((e.clientX - r.left - r.width / 2) / r.width) * 22}deg) translateZ(12px)`;
        },
        { signal }
      );
      space.addEventListener(
        'pointerleave',
        () => {
          frameEl.style.transform = '';
        },
        { signal }
      );
    });

    const teamAnimations = new Map();
    const teamObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const card = entry.target;
          if (!entry.isIntersecting) {
            (teamAnimations.get(card) || []).forEach((a) => a?.cancel());
            teamAnimations.delete(card);
            return;
          }
          if (teamAnimations.has(card) || reduceMotion.matches) return;
          const index = [...card.parentElement.children].indexOf(card);
          const delay = window.matchMedia('(max-width:600px)').matches
            ? (index % 2) * 110
            : index * 110;
          const portrait = playMotion(
            card.querySelector('.portrait-space'),
            [
              {
                opacity: 0,
                transform: 'perspective(900px) translateY(65px) rotateX(14deg) scale(.9)',
              },
              { opacity: 1, transform: 'perspective(900px) translateY(0) rotateX(0) scale(1)' },
            ],
            { duration: 800, delay, fill: 'backwards' }
          );
          const label = playMotion(
            card.querySelector('.team-label'),
            [
              { opacity: 0, transform: 'translateY(18px)', filter: 'blur(5px)' },
              { opacity: 1, transform: 'none', filter: 'blur(0)' },
            ],
            { duration: 550, delay: delay + 180, fill: 'backwards' }
          );
          teamAnimations.set(card, [portrait, label]);
        });
      },
      { threshold: 0.18 }
    );
    document.querySelectorAll('.team-member').forEach((card) => teamObserver.observe(card));

    const reset = () => {
      x = 0;
      y = 0;
      tx = 0;
      ty = 0;
      objects.forEach((el) => {
        el.style.transform = 'none';
      });
      schedule();
    };
    reduceMotion.addEventListener('change', reset);

    schedule();

    return () => {
      controller.abort();
      cancelAnimationFrame(frame);
      heroObserver.disconnect();
      revealObserver.disconnect();
      teamObserver.disconnect();
      teamAnimations.forEach((list) => list.forEach((a) => a?.cancel()));
      reduceMotion.removeEventListener('change', reset);
    };
  }, []);

  const handleScrollCue = (e) => {
    e.preventDefault();
    aboutRef.current?.scrollIntoView({
      behavior: reduceMotionQuery().matches ? 'instant' : 'smooth',
    });
  };

  return (
    <>
      <section className="home-hero" id="homeHero" ref={heroRef}>
        <div className="hero-stage" aria-hidden="true">
          <div className="float-object cap-object" data-depth="1.1">
            <div className="object-inner">
              <div className="cap-model">
                <div className="cap-base" />
                <div className="cap-band" />
                <div className="cap-under" />
                <div className="cap-board" />
                <div className="cap-rim front" />
                <div className="cap-rim back" />
                <div className="cap-rim side" />
                <div className="cap-button" />
                <div className="cap-cord" />
                <div className="cap-tassel" />
              </div>
            </div>
          </div>

          <div className="float-object grade-object" data-depth="-.8">
            <div className="object-inner" style={{ animationDelay: '-2s' }}>
              <div className="grade-sculpture">A</div>
            </div>
          </div>

          <div className="float-object book-object" data-depth=".7">
            <div className="object-inner" style={{ animationDelay: '-4s' }}>
              <div className="book-model">
                <div className="book-back" />
                <div className="book-pages" />
                <div className="book-bottom" />
                <div className="book-cover" />
              </div>
            </div>
          </div>

          <div className="float-object orbit-object" data-depth="-.6">
            <div className="object-inner" style={{ animationDelay: '-1s' }}>
              <div className="orbit-ring" />
            </div>
          </div>
        </div>

        <div className="hero-copy">
          <h1 tabIndex={-1}>
            Rencanakan
            <br />
            IPK-mu.
          </h1>
          <p>
            Isi nilai, tentukan target,
            <br />
            lihat kemungkinannya.
          </p>
          <div className="actions">
            <button className="primary" id="next" type="button" onClick={onStart}>
              Mulai <ArrowIcon />
            </button>
          </div>
        </div>

        <a className="scroll-cue" href="#tentang" onClick={handleScrollCue}>
          Kenali GradPath<span aria-hidden="true">↓</span>
        </a>
      </section>

      <section
        className="about-gradpath"
        id="tentang"
        ref={aboutRef}
        aria-labelledby="about-title"
      >
        <h2 id="about-title" data-reveal="">
          Apa itu GradPath?
        </h2>
        <p data-reveal="">
          GradPath membantu mahasiswa merencanakan target IPK berdasarkan kurikulum dan
          nilai yang sudah diperoleh. Kamu bisa mencatat nilai, mencoba berbagai skenario,
          serta berdiskusi dengan asisten AI untuk memahami hasil dan menyusun rencana
          kuliah.
        </p>
      </section>

      <section className="team-section" id="tim" ref={teamRef}>
        <h2 data-reveal="">Ini torang</h2>
        <div className="team-grid">
          {TEAM_MEMBERS.map((member) => (
            <article className="team-member" key={member.nim}>
              <div className="team-label">
                <h3>{member.name}</h3>
                <p>{member.nim}</p>
                <svg className="team-arrow" viewBox="0 0 70 70" aria-hidden="true">
                  <path d="M40 2C-8 25 66 35 30 61" />
                  <path d="M24 52l6 9 11-4" />
                </svg>
              </div>
              <div className="portrait-space">
                <div className="portrait-float">
                  <div className="portrait-frame">
                    <img
                      src={member.photo}
                      alt={member.name}
                      width={480}
                      height={640}
                      loading="lazy"
                      decoding="async"
                    />
                  </div>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>
    </>
  );
}
