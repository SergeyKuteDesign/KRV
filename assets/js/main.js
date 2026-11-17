/* =========================================================
   Что поесть — interactions
   GSAP + ScrollTrigger + Lenis (vendored in /assets/vendor)
   ========================================================= */
(() => {
  'use strict';

  const root = document.documentElement;
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => [...c.querySelectorAll(s)];
  const lerp = (a, b, t) => a + (b - a) * t;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const DESKTOP = '(min-width: 900px)';
  const MOBILE = '(max-width: 899px)';
  const VID_W = 1072, VID_H = 1904;

  if (!window.gsap || !window.ScrollTrigger) { root.classList.remove('js'); return; }

  try {
    gsap.registerPlugin(ScrollTrigger);
    root.classList.add('ready');
    init();
  } catch (err) {
    console.error(err);
    root.classList.remove('js');
  }

  function init() {
    /* ---------- smooth scroll ---------- */
    let lenis = null;
    if (!reduce && window.Lenis) {
      lenis = new Lenis({ lerp: 0.085, wheelMultiplier: 1, smoothWheel: true });
      lenis.on('scroll', ScrollTrigger.update);
      gsap.ticker.add((t) => lenis.raf(t * 1000));
      gsap.ticker.lagSmoothing(0);
    }

    /* ---------- nav / menu / anchors ---------- */
    const nav = $('[data-nav]');
    const menu = $('[data-menu]');
    const burger = $('[data-burger]');
    const setMenu = (open) => {
      menu.classList.toggle('is-open', open);
      menu.setAttribute('aria-hidden', String(!open));
      burger.setAttribute('aria-expanded', String(open));
      burger.setAttribute('aria-label', open ? 'Закрыть меню' : 'Открыть меню');
      if (lenis) open ? lenis.stop() : lenis.start();
    };
    burger.addEventListener('click', () => setMenu(!menu.classList.contains('is-open')));
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && menu.classList.contains('is-open')) setMenu(false); });

    $$('a[href^="#"]').forEach((a) => a.addEventListener('click', (e) => {
      const id = a.getAttribute('href');
      const target = id.length > 1 ? $(id) : null;
      if (!target) return;
      e.preventDefault();
      if (menu.classList.contains('is-open')) setMenu(false);
      if (lenis) lenis.scrollTo(target, { offset: 0, duration: 1.6, easing: (t) => 1 - Math.pow(1 - t, 4) });
      else target.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth' });
    }));

    /* ---------- hero video ---------- */
    const video = $('[data-hero-video]');
    const media = $('[data-hero-media]');
    const stage = $('[data-hero]');
    video.src = matchMedia(DESKTOP).matches ? 'assets/video/hero-1080.mp4' : 'assets/video/hero-720.mp4';
    const tryPlay = () => { const p = video.play(); if (p && p.catch) p.catch(() => {}); };
    tryPlay();
    new IntersectionObserver(([en]) => { en.isIntersecting ? tryPlay() : video.pause(); }, { threshold: 0.01 }).observe(stage);

    /* hero geometry: карточка → фуллскрин */
    const hs = { p: 0, intro: reduce ? 1 : 0 };
    let G = null;
    const measureHero = () => {
      const vw = stage.clientWidth, vh = stage.clientHeight;
      const navH = parseFloat(getComputedStyle(root).getPropertyValue('--nav-h')) || 60;
      const top = navH + 36, bot = 36;
      const ch = vh - top - bot, cw = ch * (VID_W / VID_H);
      const sEnd = Math.max(vw / VID_W, vh / VID_H);
      const w1 = VID_W * sEnd, h1 = VID_H * sEnd;
      Object.assign(video.style, { width: w1 + 'px', height: h1 + 'px', left: (vw - w1) / 2 + 'px', top: (vh - h1) / 2 + 'px' });
      G = { vw, vh, top, bot, cw, sEnd };
      fitTitle(vw, cw);
    };
    /* кегль заголовка: обе строки помещаются по бокам карточки и заходят под неё на ~0.1em */
    const titleL1 = $('[data-hero-l1]'), titleL2 = $('[data-hero-l2]');
    const fitTitle = (vw, cw) => {
      const gutter = Math.max(16, Math.min(vw * 0.04, 60)); // = --g
      stage.style.setProperty('--hero-fs', '100px');
      const r1 = titleL1.offsetWidth / 100, r2 = titleL2.offsetWidth / 100;
      const cardL = (vw - cw) / 2, cardR = cardL + cw;
      const k1 = 0.075, k2 = 0.02; // нахлёст в em (курсивная «в» уже сама заваливается влево)
      const fs = Math.min(vw * 0.16, 300, (cardL - gutter) / Math.max(r1 - k1, r2 - k2));
      stage.style.setProperty('--hero-fs', fs.toFixed(1) + 'px');
      stage.style.setProperty('--l1x', (cardL + fs * k1 - r1 * fs).toFixed(1) + 'px');
      stage.style.setProperty('--l2x', (cardR - fs * k2).toFixed(1) + 'px');
      stage.classList.add('is-fit');
    };
    const renderHero = () => {
      if (!G) return;
      const { vw, vh, top, bot, cw, sEnd } = G;
      const p = hs.p, e = hs.intro;
      const t = lerp(top, 0, p), b = lerp(bot, 0, p), l = lerp((vw - cw) / 2, 0, p), rad = lerp(22, 0, p);
      const tVisible = lerp(vh - b, t, e);
      const rw = vw - 2 * l, rh = vh - t - b;
      const s = (Math.max(rw / VID_W, rh / VID_H) / sEnd) * lerp(1.2, 1, e);
      media.style.clipPath = `inset(${tVisible}px ${l}px ${b}px ${l}px round ${rad}px)`;
      video.style.transform = `translate3d(0, ${(t - b) / 2}px, 0) scale(${s})`;
    };
    const heroDesktopOn = () => { media.classList.add('is-js'); measureHero(); renderHero(); };
    const heroDesktopOff = () => {
      media.classList.remove('is-js');
      media.style.clipPath = '';
      ['width', 'height', 'left', 'top', 'transform'].forEach((k) => (video.style[k] = ''));
      ['--hero-fs', '--l1x', '--l2x'].forEach((k) => stage.style.removeProperty(k));
      stage.classList.remove('is-fit');
      G = null;
    };

    /* ---------- text splitting ---------- */
    const WS = /([ \t\n\r]+)/;   // nbsp намеренно не разделяет слова
    function splitWords(el, masked) {
      if (el.dataset.split) return $$(masked ? '.wi' : '.w', el);
      el.dataset.split = '1';
      const mk = (content) => {
        const s = document.createElement('span');
        if (masked) {
          s.className = 'wm';
          const i = document.createElement('span'); i.className = 'wi';
          typeof content === 'string' ? (i.textContent = content) : i.appendChild(content);
          s.appendChild(i);
        } else {
          s.className = 'w';
          typeof content === 'string' ? (s.textContent = content) : s.appendChild(content);
        }
        return s;
      };
      const walk = (node) => {
        [...node.childNodes].forEach((n) => {
          if (n.nodeType === 3) {
            const frag = document.createDocumentFragment();
            n.textContent.split(WS).forEach((part) => {
              if (!part) return;
              frag.appendChild(WS.test(part) ? document.createTextNode(part) : mk(part));
            });
            n.replaceWith(frag);
          } else if (n.nodeType === 1) {
            if (n.classList.contains('chip')) { const ph = document.createComment(''); n.replaceWith(ph); ph.replaceWith(mk(n)); }
            else walk(n);
          }
        });
      };
      walk(el);
      return $$(masked ? '.wi' : '.w', el);
    }

    /* ---------- intro ---------- */
    const lines = $$('.hero__line .mask > *');
    const floats = $$('[data-hero-float]');
    const fades = $$('[data-hero-fade]');
    const badge = $('[data-hero-badge]');
    const isDesk = matchMedia(DESKTOP).matches;
    if (isDesk) heroDesktopOn();

    const fontsReady = Promise.race([document.fonts ? document.fonts.ready : Promise.resolve(), new Promise((r) => setTimeout(r, 1600))]);
    if (lenis) lenis.stop();

    fontsReady.then(() => {
      if (isDesk) { measureHero(); renderHero(); }
      const skip = reduce || window.scrollY > 40;
      const intro = gsap.timeline({ defaults: { ease: 'expo.out' }, onComplete: afterIntro });
      if (isDesk) intro.to(hs, { intro: 1, duration: 1.6, ease: 'expo.inOut', onUpdate: renderHero }, 0);
      else intro.fromTo(video, { scale: 1.18 }, { scale: 1, duration: 2, ease: 'expo.out' }, 0);
      intro
        .to(lines, { y: 0, yPercent: 0, duration: 1.5, stagger: 0.12 }, isDesk ? 0.55 : 0.15)
        .fromTo(floats, { opacity: 0, y: 80, scale: 0.85 }, { opacity: 1, y: 0, scale: 1, duration: 1.4, stagger: 0.12 }, isDesk ? 0.9 : 0.4)
        .fromTo(badge, { opacity: 0, scale: 0.4, rotate: -90 }, { opacity: 1, scale: 1, rotate: 0, duration: 1.4 }, isDesk ? 1.1 : 0.5)
        .fromTo(fades, { opacity: 0, y: 24 }, { opacity: 1, y: 0, duration: 1.2, stagger: 0.08 }, isDesk ? 1.05 : 0.45);
      if (skip) intro.progress(1);
    });

    function afterIntro() {
      document.body.classList.remove('is-loading');
      if (lenis) lenis.start();
      setupScroll();
      ScrollTrigger.refresh();
    }

    /* ---------- scroll scenes (в порядке DOM) ---------- */
    function setupScroll() {
      const mm = gsap.matchMedia();

      /* HERO */
      mm.add(DESKTOP, () => {
        heroDesktopOn();
        const tl = gsap.timeline({
          scrollTrigger: {
            trigger: stage, start: 'top top', end: '+=180%', pin: true, scrub: 1, anticipatePin: 1,
            invalidateOnRefresh: true,
            onRefresh: () => { measureHero(); renderHero(); },
          },
        });
        tl.to(hs, { p: 1, duration: 1, ease: 'power2.inOut', onUpdate: renderHero }, 0)
          .to('[data-hero-l1]', { xPercent: -70, opacity: 0, duration: 0.7, ease: 'power2.in' }, 0)
          .to('[data-hero-l2]', { xPercent: 70, opacity: 0, duration: 0.7, ease: 'power2.in' }, 0)
          .to('[data-hero-float="a"]', { x: '24vw', y: '-24vh', rotate: 22, opacity: 0, duration: 0.7, ease: 'power2.in' }, 0)
          .to('[data-hero-float="b"]', { x: '-24vw', y: '24vh', rotate: -22, opacity: 0, duration: 0.7, ease: 'power2.in' }, 0)
          .to(fades, { opacity: 0, y: 40, duration: 0.3, ease: 'power1.in' }, 0)
          .to(badge, { opacity: 0, scale: 0.3, rotate: 120, duration: 0.4, ease: 'power2.in' }, 0)
          .to('[data-hero-shade]', { opacity: 0.4, duration: 0.6 }, 0.45)
          .fromTo('[data-hero-quote] [data-q]', { opacity: 0, y: 50 }, { opacity: 1, y: 0, duration: 0.45, stagger: 0.12, ease: 'power3.out' }, 0.9)
          .to({}, { duration: 0.45 });
        return () => heroDesktopOff();
      });
      mm.add(MOBILE, () => {
        gsap.fromTo('[data-hero-quote] [data-q]', { opacity: 0, y: 40 }, {
          opacity: 1, y: 0, duration: 1.2, stagger: 0.12, ease: 'expo.out',
          scrollTrigger: { trigger: '[data-hero-quote]', start: 'top 75%' },
        });
      });

      /* word scrub (Serein) */
      $$('[data-scrub]').forEach((el) => {
        const words = splitWords(el, false);
        gsap.to(words, {
          opacity: 1, ease: 'none', stagger: 0.08,
          scrollTrigger: { trigger: el, start: 'top 82%', end: 'bottom 48%', scrub: 0.6 },
        });
      });

      /* headings: words rise from masks; blocks fade up */
      $$('[data-reveal]').forEach((el) => {
        if (el.matches('h1, h2, h3')) {
          const ws = splitWords(el, true);
          gsap.fromTo(ws, { y: 0, yPercent: 110 }, {
            yPercent: 0, duration: 1.3, ease: 'expo.out', stagger: 0.05,
            scrollTrigger: { trigger: el, start: 'top 88%' },
          });
        } else {
          el.classList.add('no-split');
          gsap.to(el, { opacity: 1, y: 0, duration: 1.2, ease: 'expo.out', scrollTrigger: { trigger: el, start: 'top 88%' } });
        }
      });

      /* HOW — горизонтальный скролл (Serein / Loiseau) */
      const howPin = $('[data-how]');
      const track = $('[data-how-track]');
      const bar = $('[data-how-progress]');
      const note = $('[data-note]');
      const days = $$('[data-day]');
      const playerBar = $('[data-player-bar]');
      const tickNote = () => $$('li', note).forEach((li, i) => setTimeout(() => li.classList.add('is-done'), 260 * i + 200));
      const tickDays = () => days.forEach((d, i) => setTimeout(() => d.classList.add('is-done'), 380 * i + 250));
      const steps = $$('.how__step', track);

      mm.add(DESKTOP, () => {
        const dist = () => Math.max(0, track.scrollWidth - window.innerWidth);
        const scroller = gsap.to(track, {
          x: () => -dist(), ease: 'none',
          scrollTrigger: {
            trigger: howPin, start: 'top top', end: () => '+=' + dist(), pin: true, scrub: 0.8,
            invalidateOnRefresh: true, anticipatePin: 1,
            onUpdate: (self) => gsap.set(bar, { scaleX: self.progress }),
          },
        });
        steps.forEach((step) => {
          const num = $('.how__num', step), text = $$('h3, p', step), mediaEl = $('.how__media', step);
          gsap.fromTo(num, { yPercent: 60, opacity: 0 }, { yPercent: 0, opacity: 1, ease: 'none', scrollTrigger: { trigger: step, containerAnimation: scroller, start: 'left 85%', end: 'left 35%', scrub: true } });
          gsap.fromTo(text, { y: 50, opacity: 0 }, { y: 0, opacity: 1, ease: 'none', stagger: 0.1, scrollTrigger: { trigger: step, containerAnimation: scroller, start: 'left 80%', end: 'left 30%', scrub: true } });
          gsap.fromTo(mediaEl, { rotate: 3, yPercent: 6 }, { rotate: -1.5, yPercent: -4, ease: 'none', scrollTrigger: { trigger: step, containerAnimation: scroller, start: 'left right', end: 'right left', scrub: true } });
        });
        ScrollTrigger.create({ trigger: steps[1], containerAnimation: scroller, start: 'left 55%', once: true, onEnter: tickNote });
        ScrollTrigger.create({ trigger: steps[3], containerAnimation: scroller, start: 'left 50%', once: true, onEnter: tickDays });
        gsap.fromTo(playerBar, { scaleX: 0.04 }, { scaleX: 1, ease: 'none', scrollTrigger: { trigger: steps[2], containerAnimation: scroller, start: 'left right', end: 'right left', scrub: true } });
        gsap.from('.how__chain span', { yPercent: 60, opacity: 0, stagger: 0.15, ease: 'none', scrollTrigger: { trigger: '.how__panel--outro', containerAnimation: scroller, start: 'left 90%', end: 'left 35%', scrub: true } });
        return () => gsap.set(track, { clearProps: 'transform' });
      });
      mm.add(MOBILE, () => {
        steps.forEach((step) => {
          gsap.from($$('.how__num, h3, p', step), { y: 40, opacity: 0, duration: 1.1, stagger: 0.08, ease: 'expo.out', scrollTrigger: { trigger: $('.how__text', step), start: 'top 85%' } });
        });
        ScrollTrigger.create({ trigger: note, start: 'top 75%', once: true, onEnter: tickNote });
        ScrollTrigger.create({ trigger: days[0], start: 'top 75%', once: true, onEnter: tickDays });
        gsap.fromTo(playerBar, { scaleX: 0.04 }, { scaleX: 1, ease: 'none', scrollTrigger: { trigger: steps[2], start: 'top bottom', end: 'bottom top', scrub: true } });
      });

      /* WHY — zoom-out images (Loiseau) */
      $$('[data-zoom]').forEach((img) => {
        gsap.fromTo(img, { scale: 1.22 }, { scale: 1, ease: 'none', scrollTrigger: { trigger: img.parentElement, start: 'top bottom', end: 'bottom 40%', scrub: true } });
      });
      $$('.checker__panel').forEach((p) => {
        gsap.from(p.children, { y: 40, opacity: 0, duration: 1.1, stagger: 0.07, ease: 'expo.out', scrollTrigger: { trigger: p, start: 'top 75%' } });
      });

      /* KCAL — reveal */
      gsap.from('.kcal__frame', { clipPath: 'inset(18% 18% 18% 18% round 24px)', duration: 1.6, ease: 'expo.out', scrollTrigger: { trigger: '.kcal__frame', start: 'top 80%' } });
      gsap.from('.kcal__num', { yPercent: 40, opacity: 0, duration: 1.4, ease: 'expo.out', scrollTrigger: { trigger: '.kcal__frame', start: 'top 60%' } });

      /* RIBBONS — wave in */
      gsap.from('.ribbons__svg', { yPercent: 20, opacity: 0, duration: 1.4, ease: 'expo.out', scrollTrigger: { trigger: '.ribbons', start: 'top 85%' } });

      /* INSIDE — list rows */
      $$('.menu-list li').forEach((li) => {
        gsap.from(li, { y: 40, opacity: 0, duration: 1.1, ease: 'expo.out', scrollTrigger: { trigger: li, start: 'top 92%' } });
      });

      /* ABOUT — parallax + counters */
      const aboutMainImg = $('.about__main img');
      if (aboutMainImg) gsap.fromTo(aboutMainImg, { yPercent: -12 }, { yPercent: 0, ease: 'none', scrollTrigger: { trigger: '.about__visual', start: 'top bottom', end: 'bottom top', scrub: true } });
      gsap.fromTo('.about__small', { yPercent: 10 }, { yPercent: -10, ease: 'none', scrollTrigger: { trigger: '.about__visual', start: 'top bottom', end: 'bottom top', scrub: true } });
      gsap.from('.about__main', { clipPath: 'inset(100% 0 0 0 round 999px 999px 22px 22px)', duration: 1.8, ease: 'expo.inOut', scrollTrigger: { trigger: '.about__visual', start: 'top 80%' } });
      $$('[data-count]').forEach((el) => {
        const end = +el.dataset.count;
        const fmt = (v) => (el.dataset.format === 'space' ? Math.round(v).toLocaleString('ru-RU').replace(/\s/g, ' ') : Math.round(v));
        const o = { v: 0 };
        ScrollTrigger.create({
          trigger: el, start: 'top 90%', once: true,
          onEnter: () => gsap.to(o, { v: end, duration: 2, ease: 'power3.out', onUpdate: () => (el.textContent = fmt(o.v)) }),
        });
      });

      /* REVIEWS — cards fly in */
      const cards = $$('[data-drag]');
      mm.add(DESKTOP, () => {
        gsap.from(cards, {
          y: 160, opacity: 0, rotate: () => gsap.utils.random(-14, 14), duration: 1.4, ease: 'expo.out',
          stagger: { each: 0.07, from: 'random' },
          scrollTrigger: { trigger: '[data-board]', start: 'top 72%' },
        });
      });

      /* PRICING */
      gsap.fromTo('[data-parallax-bg]', { yPercent: -8 }, { yPercent: 8, ease: 'none', scrollTrigger: { trigger: '.pricing', start: 'top bottom', end: 'bottom top', scrub: true } });
      gsap.from('[data-plan]', { y: 90, opacity: 0, duration: 1.4, stagger: 0.12, ease: 'expo.out', scrollTrigger: { trigger: '.plans', start: 'top 82%' } });

      /* FOOTER wordmark (Loiseau) */
      const word = $('[data-wordmark] em');
      if (word) {
        const txt = word.textContent; word.textContent = '';
        [...txt].forEach((c) => { const s = document.createElement('span'); s.className = 'ch'; s.textContent = c === ' ' ? ' ' : c; word.appendChild(s); });
        gsap.from($$('.ch', word), { yPercent: 100, opacity: 0, rotate: 6, duration: 1.4, stagger: 0.045, ease: 'expo.out', scrollTrigger: { trigger: '.footer__mark', start: 'top 92%' } });
      }

      /* floating CTA + nav */
      const floatCta = $('[data-float-cta]');
      ScrollTrigger.create({
        trigger: '.pain', start: 'top 70%', endTrigger: '.pricing', end: 'top 85%',
        onToggle: (self) => floatCta.classList.toggle('is-on', self.isActive),
      });
      ScrollTrigger.create({
        trigger: '.faq', start: 'top 60%', endTrigger: '.final', end: 'top 90%',
        onToggle: (self) => self.isActive && floatCta.classList.add('is-on'),
        onLeave: () => floatCta.classList.remove('is-on'),
        onLeaveBack: () => floatCta.classList.remove('is-on'),
      });
      ScrollTrigger.create({
        start: 0, end: 'max',
        onUpdate: (self) => {
          if (menu.classList.contains('is-open')) return;
          nav.classList.toggle('is-hidden', self.direction === 1 && self.scroll() > 240);
        },
      });
    }

    /* ---------- KCAL switcher ---------- */
    const sw = $('.kcal__switch');
    const swBtns = $$('button', sw);
    const frame = $('[data-kcal-frame]');
    const numEl = $('[data-kcal-num]');
    const numObj = { v: 1600 };
    const movePill = (b) => { sw.style.setProperty('--pill-x', b.offsetLeft + 'px'); sw.style.setProperty('--pill-w', b.offsetWidth + 'px'); };
    const current = () => swBtns.find((b) => b.classList.contains('on'));
    movePill(current());
    window.addEventListener('resize', () => movePill(current()));
    if (document.fonts) document.fonts.ready.then(() => movePill(current()));
    swBtns.forEach((b) => b.addEventListener('click', () => {
      if (b.classList.contains('on')) return;
      swBtns.forEach((x) => { x.classList.toggle('on', x === b); x.setAttribute('aria-selected', String(x === b)); });
      movePill(b);
      const k = b.dataset.k;
      const img = new Image();
      img.alt = `Реальный рацион на ${k} ккал в контейнерах`;
      img.src = `assets/img/ration-${k}.webp`;
      const show = () => {
        frame.appendChild(img);
        gsap.fromTo(img, { clipPath: 'inset(100% 0% 0% 0%)', scale: 1.18 }, {
          clipPath: 'inset(0% 0% 0% 0%)', scale: 1, duration: 1.1, ease: 'expo.inOut',
          onComplete: () => $$('img', frame).forEach((x) => x !== img && x.remove()),
        });
      };
      (img.decode ? img.decode() : Promise.resolve()).then(show, show);
      gsap.to(numObj, { v: +k, duration: 1, ease: 'power3.out', onUpdate: () => (numEl.textContent = Math.round(numObj.v)) });
    }));
    // прогреваем остальные фото рационов
    window.addEventListener('load', () => setTimeout(() => swBtns.forEach((b) => { const i = new Image(); i.src = `assets/img/ration-${b.dataset.k}.webp`; }), 2500));

    /* ---------- RIBBONS (curved marquee, скорость зависит от скролла) ---------- */
    const ribbons = $$('[data-ribbon]').map((tp) => {
      const textEl = tp.parentNode;
      const unitText = (tp.dataset.text || tp.textContent.trim()) + ' ✦ ';
      tp.textContent = unitText;
      const unit = textEl.getComputedTextLength() || 1500;
      const path = $(tp.getAttribute('href'));
      const pathLen = path && path.getTotalLength ? path.getTotalLength() : 2400;
      tp.textContent = unitText.repeat(Math.ceil(pathLen / unit) + 2);
      return { tp, unit, dir: +tp.dataset.ribbon, off: 0 };
    });
    let ribbonsVisible = false;
    const ribbonSection = $('.ribbons');
    if (ribbonSection) new IntersectionObserver(([en]) => (ribbonsVisible = en.isIntersecting)).observe(ribbonSection);
    if (!reduce) gsap.ticker.add((time, dt) => {
      if (!ribbonsVisible) return;
      const boost = lenis ? Math.min(Math.abs(lenis.velocity) * 0.6, 14) : 0;
      ribbons.forEach((r) => {
        r.off += (0.9 + boost) * (dt / 16.7);
        const o = r.dir > 0 ? -(r.off % r.unit) : -r.unit + (r.off % r.unit);
        r.tp.setAttribute('startOffset', o.toFixed(1));
      });
    });

    /* ---------- INSIDE: картинка за курсором ---------- */
    const list = $('[data-menu-list]');
    const ci = $('[data-cursor-img]');
    if (list && ci && matchMedia('(hover: hover) and (min-width: 900px)').matches) {
      const cimg = $('img', ci);
      let mx = 0, my = 0, cx = 0, cy = 0, on = false;
      list.addEventListener('mousemove', (e) => { mx = e.clientX; my = e.clientY; if (!on) { cx = mx; cy = my; } });
      $$('li', list).forEach((li) => li.addEventListener('mouseenter', () => {
        if (cimg.getAttribute('src') !== li.dataset.img) cimg.src = li.dataset.img;
        ci.classList.add('is-on'); on = true;
      }));
      list.addEventListener('mouseleave', () => { ci.classList.remove('is-on'); on = false; });
      gsap.ticker.add(() => {
        cx += (mx - cx) * 0.14; cy += (my - cy) * 0.14;
        const rot = gsap.utils.clamp(-14, 14, (mx - cx) * 0.12);
        ci.style.transform = `translate3d(${cx + 36}px, ${cy - 170}px, 0) rotate(${rot}deg)`;
      });
    }

    /* ---------- REVIEWS: перетаскивание (Sweet Tape) ---------- */
    let zTop = 20;
    $$('[data-drag]').forEach((card) => {
      let sx = 0, sy = 0, bx = 0, by = 0, dragging = false;
      const qx = gsap.quickTo(card, 'x', { duration: 0.45, ease: 'power3.out' });
      const qy = gsap.quickTo(card, 'y', { duration: 0.45, ease: 'power3.out' });
      card.addEventListener('pointerdown', (e) => {
        if (!matchMedia(DESKTOP).matches || e.button > 0) return;
        dragging = true; card.setPointerCapture(e.pointerId);
        sx = e.clientX; sy = e.clientY; bx = gsap.getProperty(card, 'x'); by = gsap.getProperty(card, 'y');
        card.style.zIndex = ++zTop; card.classList.add('is-drag');
        gsap.to(card, { scale: 1.06, duration: 0.35, ease: 'power3.out' });
      });
      card.addEventListener('pointermove', (e) => { if (!dragging) return; qx(bx + e.clientX - sx); qy(by + e.clientY - sy); });
      const end = () => { if (!dragging) return; dragging = false; card.classList.remove('is-drag'); gsap.to(card, { scale: 1, duration: 0.5, ease: 'back.out(2)' }); };
      card.addEventListener('pointerup', end);
      card.addEventListener('pointercancel', end);
    });

    /* ---------- FAQ: плавное раскрытие ---------- */
    $$('[data-faq] details').forEach((d) => {
      const s = $('summary', d), a = $('.faq__a', d);
      s.addEventListener('click', (e) => {
        e.preventDefault();
        if (d.open) {
          gsap.to(a, { height: 0, duration: 0.5, ease: 'power3.inOut', onComplete: () => { d.open = false; a.style.height = ''; ScrollTrigger.refresh(); } });
        } else {
          d.open = true;
          gsap.fromTo(a, { height: 0 }, { height: 'auto', duration: 0.7, ease: 'expo.out', onComplete: () => { a.style.height = ''; ScrollTrigger.refresh(); } });
        }
      });
    });
  }
})();
