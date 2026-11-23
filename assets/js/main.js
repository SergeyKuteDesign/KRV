/* =========================================================
   Что поесть — interactions v4
   GSAP + ScrollTrigger (+ Lenis только для колеса мыши).
   Сцены на sticky, эффекты привязаны к прогрессу скролла → работают в обе стороны.
   Анимируем только transform и opacity: без filter: blur и без перерисовки больших слоёв.
   ========================================================= */
(() => {
  'use strict';

  const root = document.documentElement;
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => [...c.querySelectorAll(s)];
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const easeIO = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const easeOut = (t) => 1 - Math.pow(1 - t, 3);
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const DESK = '(min-width: 768px)';
  const MOB = '(max-width: 767px)';
  const isDesk = () => matchMedia(DESK).matches;
  const touch = matchMedia('(hover: none), (pointer: coarse)').matches;
  const INK = '#1D1B14', PAPER = '#FFFDF6';

  typograph(document.body);

  if (!window.gsap || !window.ScrollTrigger) { root.classList.remove('js'); root.classList.add('no-loader'); return; }
  try {
    gsap.registerPlugin(ScrollTrigger);
    init();
    root.classList.add('ready');
  } catch (err) {
    console.error(err);
    root.classList.remove('js');
    root.classList.add('no-loader');
  }

  /* ---------- типограф: без висячих предлогов ---------- */
  function typograph(scope) {
    const short = 'а|в|во|и|к|ко|о|об|обо|с|со|у|я|ты|мы|вы|он|она|они|не|ни|но|на|по|за|из|от|до|для|без|под|над|при|про|через|перед|или|как|что|это|то|так|уже|ещё|еще|где|кто|чем|все|всё|мой|моя|мои|твой|твоя|твои|раз|два|три|её|его|их|если|когда';
    const reAfter = new RegExp('(^|[\\s\\u00A0(«"„])(' + short + ')[ \\t\\n\\r]+', 'gi');
    const reParticle = /[ \t\n\r]+(же|ли|бы)(?=[\s.,!?…»]|$)/gi;
    const reDash = /[ \t\n\r]+([—–])/g;
    const reNum = /(\d)[ \t\n\r]+(?=[\dА-Яа-яЁёA-Za-z₽%+≈])/g;
    const walker = document.createTreeWalker(scope, NodeFilter.SHOW_TEXT, {
      acceptNode(n) {
        const p = n.parentElement;
        if (!p || p.closest('script, style, textarea, svg, code, pre, .kcal__line')) return NodeFilter.FILTER_REJECT;
        return /\S/.test(n.nodeValue) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
      },
    });
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach((n) => {
      const t = n.nodeValue.replace(reAfter, '$1$2 ').replace(reAfter, '$1$2 ')
        .replace(reParticle, ' $1').replace(reDash, ' $1').replace(reNum, '$1 ');
      if (t !== n.nodeValue) n.nodeValue = t;
    });
    $$('h1, h2, h3', scope).forEach((h) => {
      if (h.querySelector('.kcal__line')) return;
      const texts = [];
      const w = document.createTreeWalker(h, NodeFilter.SHOW_TEXT);
      while (w.nextNode()) if (/\S/.test(w.currentNode.nodeValue)) texts.push(w.currentNode);
      const last = texts[texts.length - 1];
      if (!last) return;
      const v = last.nodeValue.replace(/\s+$/, '');
      const i = v.lastIndexOf(' ');
      const tail = v.slice(i + 1);
      if (i > 0 && tail.length <= 9 && !tail.includes(' ')) last.nodeValue = v.slice(0, i) + ' ' + tail + last.nodeValue.slice(v.length);
    });
  }

  function init() {
    ScrollTrigger.config({ ignoreMobileResize: true });

    /* ---------- плавный скролл только для колеса мыши; на тач-экранах — родной ---------- */
    let lenis = null;
    if (!reduce && window.Lenis && !touch) {
      lenis = new Lenis({ lerp: 0.12, smoothWheel: true });
      lenis.on('scroll', ScrollTrigger.update);
      gsap.ticker.add((t) => lenis.raf(t * 1000));
      gsap.ticker.lagSmoothing(0);
    }
    let locks = 0;
    const lock = () => { if (++locks === 1) { if (lenis) lenis.stop(); document.body.classList.add('is-locked'); } };
    const unlock = () => { if (locks > 0 && --locks === 0) { if (lenis) lenis.start(); document.body.classList.remove('is-locked'); } };
    const sheetState = () => root.classList.toggle('sheet-open', !!(accessOpen || rOpen || (menuOpen && !isDesk())));

    /* скорость скролла (px/с) — для лент */
    let scrollVel = 0;
    {
      let lastY = scrollY, lastT = performance.now();
      gsap.ticker.add(() => {
        const now = performance.now(), y = scrollY, dt = Math.max(8, now - lastT);
        const v = lenis ? lenis.velocity * 60 : ((y - lastY) / dt) * 1000;
        scrollVel += (v - scrollVel) * 0.2;
        lastY = y; lastT = now;
      });
    }

    const nav = $('[data-nav]');
    const burger = $('[data-menu-open]');
    const menu = $('[data-menu]');
    const scrim = $('[data-scrim]');
    const dock = $('[data-dock]');
    const access = $('[data-access]');
    const accessInner = $('[data-access-inner]');
    const rsheet = $('[data-rsheet]');
    const hero = $('[data-hero]');
    const heroSticky = $('[data-hero-sticky]');
    const media = $('[data-hero-media]');
    const video = $('[data-hero-video]');
    const shade = $('[data-hero-shade]');
    const content = $('[data-hero-content]');
    const ctaSlot = $('[data-cta-slot]');
    const floats = $$('[data-float]');
    let menuOpen = false, accessOpen = false, rOpen = false, heroP = 0, introDone = false;

    /* ---------- видео ---------- */
    const wide = isDesk();
    video.poster = wide ? 'assets/img/hero-poster-wide.webp' : 'assets/img/hero-poster.webp';
    video.src = wide ? 'assets/video/hero-wide.mp4' : 'assets/video/hero-640.mp4';
    const playVideo = () => { const p = video.play(); if (p && p.catch) p.catch(() => {}); };
    const videoReady = new Promise((res) => {
      if (video.readyState >= 3) return res();
      video.addEventListener('canplay', res, { once: true });
      video.addEventListener('error', res, { once: true });
      setTimeout(res, 3500);
    });

    /* =====================================================
       HERO-сцена: видео → карточка → фраза позади
       ===================================================== */
    const safeProbe = document.createElement('div');
    safeProbe.style.cssText = 'position:fixed;left:0;bottom:0;width:0;height:env(safe-area-inset-bottom);visibility:hidden;pointer-events:none';
    document.body.appendChild(safeProbe);
    const DOCK_GAP = 16;
    const H = { W: 0, H: 0, cardW: 0, cardH: 0, cy: 0, dist: 1, ctaY: 0, dockH: 60, safe: 0 };
    const floatDir = [[-1, -0.6, -14], [-1, 0.6, 12], [1, -0.6, 12], [1, 0.6, -12]];
    const floatSpeed = [1.25, 1.55, 1.1, 1.45];
    const measureHero = () => {
      H.W = innerWidth;
      // кадр сцены = 100svh: не меняется, когда панель браузера прячется
      H.H = heroSticky.clientHeight || innerHeight;
      if (isDesk()) { H.cardH = Math.min(H.H * 0.46, (H.W * 0.56) / 1.9); H.cardW = H.cardH * 1.9; H.cy = H.H * 0.51; H.dist = H.H * 1.7; }
      else { H.cardW = H.W * 0.84; H.cardH = Math.min(H.H * 0.52, H.cardW * 1.3); H.cy = H.H * 0.5; H.dist = H.H * 1.4; }
      H.dockH = dock.offsetHeight || 60;
      H.safe = safeProbe.offsetHeight;
      H.ctaY = ctaSlot.offsetTop;
    };

    // кнопка: в hero её двигает JS (от верха кадра), внизу экрана — CSS (bottom), чтобы
    // она ехала вместе с панелью браузера и не «телепортировалась» после resize
    let docked = false;
    const dockAt = (y) => { dock.style.transform = `translate3d(-50%, ${y.toFixed(1)}px, 0)`; };
    const setDocked = (v) => {
      if (v === docked) return;
      docked = v;
      dock.classList.toggle('is-docked', v);
      if (v) dock.style.transform = '';
    };
    const renderHero = () => {
      const P = heroP;
      const { W, cardW, cardH, cy } = H;
      const Hh = H.H;
      const s = easeIO(clamp(P / 0.42));
      const f = easeIO(clamp((P - 0.5) / 0.46));
      const topIn = lerp(0, cy - cardH / 2, s), botIn = lerp(0, Hh - cy - cardH / 2, s), sideIn = lerp(0, (W - cardW) / 2, s);
      media.style.clipPath = `inset(${topIn.toFixed(1)}px ${sideIn.toFixed(1)}px ${botIn.toFixed(1)}px ${sideIn.toFixed(1)}px round ${lerp(0, 28, s).toFixed(1)}px)`;
      media.style.transform = `translate3d(0, ${(-f * (cy + cardH / 2 + 40)).toFixed(1)}px, 0)`;
      media.style.visibility = f >= 1 ? 'hidden' : 'visible';
      shade.style.opacity = lerp(1, 0.35, s).toFixed(3);
      const c = clamp(P / 0.16);
      content.style.opacity = (1 - c).toFixed(3);
      content.style.transform = `translate3d(0, ${(-50 * clamp(P / 0.24)).toFixed(1)}px, 0)`;
      content.style.visibility = c >= 1 ? 'hidden' : 'visible';
      floats.forEach((el, i) => {
        if (el.offsetParent === null) return;
        const e = easeOut(clamp((P - 0.1 - i * 0.045) / 0.3));
        const [dx, dy, rot] = floatDir[i];
        const x = (1 - e) * dx * W * 0.32;
        const y = (1 - e) * dy * Hh * 0.25 - f * Hh * floatSpeed[i];
        el.style.opacity = e.toFixed(3);
        el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) rotate(${((1 - e) * rot).toFixed(2)}deg)`;
        el.style.visibility = e <= 0 || f >= 1 ? 'hidden' : 'visible';
      });
      if (introDone) {
        if (P >= 0.7) setDocked(true);
        else {
          setDocked(false);
          const yCta = H.ctaY, yCard = cy - H.dockH / 2, yDock = innerHeight - H.dockH - DOCK_GAP - H.safe;
          const d = easeIO(clamp((P - 0.5) / 0.2));
          dockAt(P < 0.5 ? lerp(yCta, yCard, s) : lerp(yCard, yDock, d));
        }
      }
    };
    measureHero(); renderHero();
    ScrollTrigger.create({
      trigger: hero, start: 'top top', end: () => '+=' + Math.round(H.dist),
      onUpdate: (self) => { heroP = self.progress; renderHero(); },
      onRefresh: (self) => { measureHero(); heroP = self.progress; renderHero(); },
    });
    window.addEventListener('resize', () => { measureHero(); renderHero(); });
    new IntersectionObserver(([en]) => (en.isIntersecting ? playVideo() : video.pause())).observe(media);

    /* ---------- scrim / шиты ---------- */
    const showScrim = () => { scrim.hidden = false; gsap.to(scrim, { opacity: 1, duration: 0.4, overwrite: true }); };
    const hideScrim = () => gsap.to(scrim, { opacity: 0, duration: 0.35, overwrite: true, onComplete: () => { if (!menuOpen && !accessOpen && !rOpen) scrim.hidden = true; } });
    scrim.addEventListener('click', () => { closeMenu(); closeAccess(); closeReviews(); });

    /* =====================================================
       Виджет доступа: кнопка «раскрывается» в карточку (iOS)
       ===================================================== */
    const radii = (r) => `${r}px ${r}px ${r}px ${r}px`;
    function openAccess() {
      if (accessOpen) return;
      if (menuOpen) closeMenu();
      accessOpen = true; lock(); sheetState();
      dock.setAttribute('aria-expanded', 'true');
      const r0 = dock.getBoundingClientRect();
      access.hidden = false;
      access.classList.remove('is-morph');
      gsap.set(access, { clearProps: 'all' });
      const r1 = access.getBoundingClientRect();
      const end = isDesk() ? radii(28) : '26px 26px 0px 0px';
      accessInner.style.width = r1.width + 'px';
      access.classList.add('is-morph');
      gsap.set(access, { left: r0.left, top: r0.top, width: r0.width, height: r0.height, borderRadius: radii(r0.height / 2), backgroundColor: INK });
      gsap.set(accessInner, { opacity: 0 });
      dock.classList.add('is-morph');
      showScrim();
      gsap.timeline({
        onComplete: () => {
          access.classList.remove('is-morph');
          gsap.set(access, { clearProps: 'left,top,width,height,borderRadius,backgroundColor' });
          accessInner.style.width = '';
        },
      })
        .to(access, { left: r1.left, top: r1.top, width: r1.width, height: r1.height, borderRadius: end, backgroundColor: PAPER, duration: reduce ? 0.01 : 0.75, ease: 'expo.out' }, 0)
        .to(accessInner, { opacity: 1, duration: 0.3 }, 0.2)
        .fromTo(accessInner.children, { y: 16, opacity: 0 }, { y: 0, opacity: 1, duration: 0.6, stagger: 0.04, ease: 'power3.out' }, 0.2);
      setTimeout(() => $('.sheet__close', access).focus({ preventScroll: true }), 400);
    }
    function closeAccess(mode) {
      if (!accessOpen) return Promise.resolve();
      accessOpen = false; sheetState();
      dock.setAttribute('aria-expanded', 'false');
      return new Promise((res) => {
        const finish = () => {
          access.hidden = true;
          access.classList.remove('is-morph');
          gsap.set(access, { clearProps: 'all' });
          gsap.set(accessInner, { clearProps: 'all' });
          gsap.set(accessInner.children, { clearProps: 'all' });
          accessInner.style.width = '';
          dock.classList.remove('is-morph');
          hideScrim(); unlock(); res();
        };
        gsap.killTweensOf([access, accessInner]);
        const r0 = dock.getBoundingClientRect();
        if (mode === 'slide' || r0.top > innerHeight || dock.classList.contains('is-away')) { gsap.to(access, { y: '100%', opacity: mode === 'slide' ? 1 : 0, duration: 0.4, ease: 'power3.in', onComplete: finish }); return; }
        const r1 = access.getBoundingClientRect();
        accessInner.style.width = r1.width + 'px';
        access.classList.add('is-morph');
        gsap.set(access, { left: r1.left, top: r1.top, width: r1.width, height: r1.height, borderRadius: isDesk() ? radii(28) : '26px 26px 0px 0px', backgroundColor: PAPER, y: 0 });
        gsap.timeline({ onComplete: finish })
          .to(accessInner, { opacity: 0, duration: 0.16 }, 0)
          .to(access, { left: r0.left, top: r0.top, width: r0.width, height: r0.height, borderRadius: radii(r0.height / 2), backgroundColor: INK, duration: reduce ? 0.01 : 0.6, ease: 'expo.inOut' }, 0.04);
      });
    }
    dock.addEventListener('click', openAccess);
    $('[data-close]', access).addEventListener('click', () => closeAccess());

    /* ---------- меню ---------- */
    const menuKids = () => $$('.menu__links a, .menu__foot > *', menu);
    function openMenu() {
      if (menuOpen) return;
      if (accessOpen) closeAccess();
      if (rOpen) closeReviews();
      menuOpen = true; sheetState();
      burger.setAttribute('aria-expanded', 'true');
      menu.hidden = false;
      gsap.set(menu, { clearProps: 'clipPath,y' });
      if (isDesk()) {
        nav.classList.add('is-menu');
        const cut = menu.offsetHeight - nav.offsetHeight;
        gsap.fromTo(menu, { clipPath: `inset(0px 0px ${cut}px 0px round 30px)` }, { clipPath: 'inset(0px 0px 0px 0px round 30px)', duration: 0.8, ease: 'expo.out' });
      } else {
        lock(); showScrim();
        gsap.fromTo(menu, { y: '100%' }, { y: 0, duration: 0.7, ease: 'expo.out' });
      }
      gsap.fromTo(menuKids(), { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.7, stagger: 0.04, ease: 'power3.out', delay: 0.1 });
    }
    function closeMenu(mode) {
      if (!menuOpen) return Promise.resolve();
      menuOpen = false; sheetState();
      burger.setAttribute('aria-expanded', 'false');
      return new Promise((res) => {
        const done = () => { menu.hidden = true; gsap.set(menu, { clearProps: 'clipPath,y,transform' }); nav.classList.remove('is-menu'); res(); };
        if (isDesk() && mode !== 'slide') {
          const cut = menu.offsetHeight - nav.offsetHeight;
          gsap.to(menuKids(), { opacity: 0, duration: 0.15 });
          gsap.to(menu, { clipPath: `inset(0px 0px ${cut}px 0px round 30px)`, duration: 0.55, ease: 'expo.inOut', onComplete: done });
        } else {
          gsap.to(menu, { y: '100%', duration: 0.42, ease: 'power3.in', onComplete: () => { done(); hideScrim(); unlock(); } });
        }
      });
    }
    burger.addEventListener('click', () => (menuOpen ? closeMenu() : openMenu()));
    $('[data-close]', menu).addEventListener('click', () => closeMenu());
    if (matchMedia('(hover: hover)').matches) {
      let ht;
      const enter = () => { if (!isDesk()) return; clearTimeout(ht); ht = setTimeout(openMenu, 140); };
      const leave = () => { if (!isDesk()) return; clearTimeout(ht); ht = setTimeout(() => { if (!nav.matches(':hover') && !menu.matches(':hover')) closeMenu(); }, 360); };
      burger.addEventListener('mouseenter', enter);
      burger.addEventListener('mouseleave', leave);
      menu.addEventListener('mouseenter', () => clearTimeout(ht));
      menu.addEventListener('mouseleave', leave);
    }
    document.addEventListener('pointerdown', (e) => { if (menuOpen && isDesk() && !menu.contains(e.target) && !nav.contains(e.target)) closeMenu(); });

    /* =====================================================
       Все отзывы — боттом-шит с колонками
       ===================================================== */
    const rbody = $('[data-rsheet-body]', rsheet);
    const rgrid = $('[data-rsheet-grid]', rsheet);
    const rItems = $$('.rsheet__item', rgrid);
    let rCols = 0, rOpener = null;
    const layoutReviews = () => {
      const w = rgrid.clientWidth || innerWidth;
      const n = w >= 900 ? 3 : w >= 560 ? 2 : 1;
      if (n === rCols) return;
      rCols = n;
      const cols = [], hs = [];
      for (let i = 0; i < n; i++) { const c = document.createElement('div'); c.className = 'rsheet__col'; cols.push(c); hs.push(0); }
      // порядок важен (сильные отзывы сверху) → кладём в самую короткую колонку
      rItems.forEach((it) => {
        const im = $('img', it);
        const r = (+im.getAttribute('height') || 1) / (+im.getAttribute('width') || 1);
        const k = hs.indexOf(Math.min(...hs));
        cols[k].appendChild(it); hs[k] += r + 0.06;
      });
      rgrid.replaceChildren(...cols);
    };
    function openReviews(e) {
      if (rOpen) return;
      if (menuOpen) closeMenu();
      if (accessOpen) closeAccess();
      rOpen = true; rOpener = e && e.currentTarget ? e.currentTarget : null; sheetState();
      lock(); showScrim();
      rsheet.hidden = false;
      layoutReviews();
      rbody.scrollTop = 0;
      gsap.killTweensOf(rsheet);
      gsap.fromTo(rsheet, { yPercent: 100, y: 0 }, { yPercent: 0, duration: reduce ? 0.01 : 0.75, ease: 'expo.out' });
      gsap.fromTo($$('.rsheet__col', rgrid), { y: 70, opacity: 0 }, { y: 0, opacity: 1, duration: 0.9, stagger: 0.07, ease: 'expo.out', delay: 0.12 });
      setTimeout(() => $('.sheet__close', rsheet).focus({ preventScroll: true }), 380);
    }
    function closeReviews() {
      if (!rOpen) return Promise.resolve();
      rOpen = false; sheetState();
      return new Promise((res) => {
        gsap.killTweensOf(rsheet);
        gsap.to(rsheet, {
          yPercent: 100, duration: reduce ? 0.01 : 0.45, ease: 'power3.in',
          onComplete: () => {
            rsheet.hidden = true; gsap.set(rsheet, { clearProps: 'transform' });
            hideScrim(); unlock();
            if (rOpener) rOpener.focus({ preventScroll: true });
            res();
          },
        });
      });
    }
    $$('[data-rsheet-open]').forEach((b) => b.addEventListener('click', openReviews));
    $('[data-close]', rsheet).addEventListener('click', () => closeReviews());
    $$('[data-open-access]').forEach((b) => b.addEventListener('click', () => { closeReviews().then(() => setTimeout(openAccess, 60)); }));
    window.addEventListener('resize', () => { if (rOpen) layoutReviews(); });

    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { closeMenu(); closeAccess(); closeReviews(); } });

    /* ---------- боттом-шиты: свайп вниз ---------- */
    function draggable(sheet, close) {
      const handle = $('[data-drag-handle]', sheet);
      if (!handle) return;
      let y0 = 0, dy = 0, t0 = 0, on = false;
      handle.addEventListener('pointerdown', (e) => { if (isDesk()) return; on = true; y0 = e.clientY; dy = 0; t0 = performance.now(); handle.setPointerCapture(e.pointerId); gsap.killTweensOf(sheet); });
      handle.addEventListener('pointermove', (e) => { if (!on) return; dy = Math.max(0, e.clientY - y0); gsap.set(sheet, { y: dy }); });
      const end = () => {
        if (!on) return; on = false;
        const v = dy / Math.max(1, performance.now() - t0);
        if (dy > 110 || v > 0.6) close('slide'); else gsap.to(sheet, { y: 0, duration: 0.5, ease: 'expo.out' });
      };
      handle.addEventListener('pointerup', end);
      handle.addEventListener('pointercancel', end);
    }
    draggable(menu, closeMenu);
    draggable(access, closeAccess);
    draggable(rsheet, closeReviews);

    /* ---------- якоря ---------- */
    const goTo = (t) => {
      if (t === hero) { if (lenis) lenis.scrollTo(0, { duration: 1.6 }); else window.scrollTo({ top: 0, behavior: 'smooth' }); return; }
      const y = t.getBoundingClientRect().top + (lenis ? lenis.scroll : scrollY);
      if (lenis) lenis.scrollTo(y, { duration: 1.6, easing: (x) => 1 - Math.pow(1 - x, 4) });
      else window.scrollTo({ top: y, behavior: reduce ? 'auto' : 'smooth' });
    };
    document.addEventListener('click', (e) => {
      const a = e.target.closest('a[href^="#"]');
      if (!a) return;
      const id = a.getAttribute('href');
      const t = id.length > 1 ? $(id) : null;
      if (!t) return;
      e.preventDefault();
      Promise.all([closeMenu(), closeAccess(), closeReviews()]).then(() => goTo(t));
    });

    /* =====================================================
       Прелоадер: маскот прыгает на надпись, надпись пишется
       ===================================================== */
    const loader = $('[data-loader]');
    const lMascot = $('[data-loader-mascot]');
    const lShadow = $('[data-loader-shadow]');
    const lWord = $('[data-loader-word]');
    const lHint = $('[data-loader-hint]');
    const lBar = $('[data-loader-bar]');
    lock();
    const fontLoad = document.fonts && document.fonts.load ? document.fonts.load('48px Lobster', 'Что поесть') : Promise.resolve();
    const mascotLoad = lMascot.complete ? Promise.resolve() : new Promise((r) => { lMascot.onload = lMascot.onerror = r; });
    Promise.race([Promise.all([fontLoad, mascotLoad]), new Promise((r) => setTimeout(r, 900))]).then(() => {
      if (reduce) { gsap.set(lMascot, { opacity: 1 }); gsap.set(lWord, { clipPath: 'none' }); gsap.set(lHint, { opacity: 1 }); return; }
      gsap.timeline()
        .set(lMascot, { opacity: 1 })
        .fromTo(lMascot, { y: -130, scaleX: 0.9, scaleY: 1.12 }, { y: 0, duration: 0.48, ease: 'power2.in' }, 0)
        .fromTo(lShadow, { opacity: 0, scaleX: 0.25 }, { opacity: 1, scaleX: 1, duration: 0.48, ease: 'power2.in' }, 0)
        .to(lMascot, { scaleX: 1.15, scaleY: 0.84, duration: 0.1, ease: 'power1.out' }, 0.48)
        .to(lShadow, { scaleX: 1.2, duration: 0.1 }, 0.48)
        .to(lMascot, { scaleX: 1, scaleY: 1, duration: 0.8, ease: 'elastic.out(1.1, 0.38)' }, 0.58)
        .to(lShadow, { scaleX: 1, duration: 0.5, ease: 'power2.out' }, 0.58)
        .to(lWord, { clipPath: 'inset(0 0% 0 0)', duration: 1, ease: 'power2.inOut' }, 0.42)
        .to(lHint, { opacity: 1, duration: 0.5 }, 1)
        .to(lMascot, { rotation: -8, duration: 0.16, ease: 'sine.inOut', yoyo: true, repeat: 3 }, 1.35);
    });
    const lp = gsap.to(lBar, { scaleX: 0.85, duration: 1.9, ease: 'power2.out' });
    const fontsReady = document.fonts ? document.fonts.ready : Promise.resolve();
    const posterReady = new Promise((res) => { const i = new Image(); i.onload = i.onerror = res; i.src = video.poster; });
    const assetsReady = Promise.race([Promise.all([fontsReady, posterReady, videoReady]), new Promise((r) => setTimeout(r, 5000))]);
    Promise.all([assetsReady, new Promise((r) => setTimeout(r, reduce ? 500 : 2300))]).then(() => {
      lp.kill();
      gsap.to(lBar, { scaleX: 1, duration: 0.3, ease: 'power2.inOut', onComplete: exitLoader });
    });
    function exitLoader() {
      gsap.timeline({ onComplete: () => loader.remove() })
        .to(lMascot, { y: -18, scaleX: 0.94, scaleY: 1.08, duration: 0.2, ease: 'power2.out' }, 0)
        .to(lShadow, { scaleX: 0.6, opacity: 0.5, duration: 0.2 }, 0)
        .to('.loader__inner', { y: -40, opacity: 0, duration: 0.42, ease: 'power2.in' }, 0.18)
        .to(loader, { yPercent: -100, duration: 0.9, ease: 'expo.inOut' }, 0.4)
        .add(heroIntro, 0.62);
    }
    function heroIntro() {
      playVideo();
      measureHero();
      introDone = true;
      renderHero();
      gsap.timeline()
        .add(() => { unlock(); setupScroll(); ScrollTrigger.refresh(); }, 0.6)
        .fromTo(video, { scale: 1.12 }, { scale: 1, duration: 2, ease: 'expo.out', clearProps: 'transform' }, 0)
        .fromTo('[data-intro]', { opacity: 0, y: 34 }, { opacity: 1, y: 0, duration: 1.2, stagger: 0.12, ease: 'expo.out' }, 0.1)
        .add(() => dock.classList.add('is-ready'), 0.45);
    }

    /* =====================================================
       КАЛОРИЙНОСТЬ: табы в карточке, фото и бейдж меняются вместе
       ===================================================== */
    const sw = $('.kcal__switch');
    const swBtns = $$('button', sw);
    const frame = $('[data-kcal-frame]');
    const badge = $('[data-kcal-badge]');
    const kIdx = () => swBtns.findIndex((b) => b.classList.contains('on'));
    const movePill = () => { const b = swBtns[kIdx()]; if (!b) return; sw.style.setProperty('--pill-x', b.offsetLeft + 'px'); sw.style.setProperty('--pill-w', b.offsetWidth + 'px'); };
    movePill();
    window.addEventListener('resize', movePill);
    if (document.fonts) document.fonts.ready.then(movePill);
    const setK = (i) => {
      const b = swBtns[i];
      const cur = kIdx();
      if (!b || i === cur) return;
      const dir = i > cur ? 1 : -1;
      swBtns.forEach((x) => { x.classList.toggle('on', x === b); x.setAttribute('aria-selected', String(x === b)); x.tabIndex = x === b ? 0 : -1; });
      movePill();
      const k = b.dataset.k;
      badge.textContent = k;
      gsap.fromTo(badge, { yPercent: dir * 70, opacity: 0 }, { yPercent: 0, opacity: 1, duration: 0.55, ease: 'expo.out' });
      const img = new Image();
      img.alt = `Реальный рацион на ${k} ккал в контейнерах`;
      img.decoding = 'async';
      img.src = `assets/img/ration-${k}.webp`;
      const show = () => {
        if (!b.classList.contains('on')) return;
        frame.insertBefore(img, $('.kcal__badge', frame));
        gsap.fromTo(img, { clipPath: dir > 0 ? 'inset(0% 0% 0% 100%)' : 'inset(0% 100% 0% 0%)', scale: 1.1 }, {
          clipPath: 'inset(0% 0% 0% 0%)', scale: 1, duration: 0.85, ease: 'expo.inOut',
          onComplete: () => { $$('img', frame).forEach((x) => x !== img && x.remove()); gsap.set(img, { clearProps: 'clipPath,transform' }); },
        });
      };
      (img.decode ? img.decode() : Promise.resolve()).then(show, show);
    };
    swBtns.forEach((b, i) => { b.tabIndex = b.classList.contains('on') ? 0 : -1; b.addEventListener('click', () => setK(i)); });
    sw.addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
      e.preventDefault();
      const i = clamp(kIdx() + (e.key === 'ArrowRight' ? 1 : -1), 0, swBtns.length - 1);
      setK(i); swBtns[i].focus();
    });
    {
      let sx = 0, sy = 0, on = false;
      frame.addEventListener('pointerdown', (e) => { on = true; sx = e.clientX; sy = e.clientY; });
      frame.addEventListener('pointerup', (e) => {
        if (!on) return; on = false;
        const dx = e.clientX - sx, dy = e.clientY - sy;
        if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy) * 1.3) setK(clamp(kIdx() + (dx < 0 ? 1 : -1), 0, swBtns.length - 1));
      });
      frame.addEventListener('pointercancel', () => { on = false; });
    }

    /* ---------- ленты: текст течёт по волне ---------- */
    initRibbons();

    /* ---------- ЧТО ВНУТРИ: строка списка → фото справа ---------- */
    {
      const feats = $$('[data-feat-item]');
      const stageImgs = $$('[data-feat-stage] img');
      const setFeat = (i) => {
        feats.forEach((li, k) => li.classList.toggle('is-active', k === i));
        stageImgs.forEach((im, k) => im.classList.toggle('is-active', k === i));
      };
      feats.forEach((li, i) => {
        li.addEventListener('mouseenter', () => { if (isDesk()) setFeat(i); });
        li.addEventListener('focus', () => { if (isDesk()) setFeat(i); });
        li.addEventListener('click', () => { if (isDesk()) setFeat(i); });
      });
    }

    /* ---------- горизонтальные карусели: тени по краям показывают, куда листать ---------- */
    $$('[data-hs]').forEach((w) => {
      const t = $('.hs__track', w);
      if (!t) return;
      let raf = 0;
      const upd = () => {
        raf = 0;
        const max = t.scrollWidth - t.clientWidth;
        w.classList.toggle('can-left', t.scrollLeft > 4);
        w.classList.toggle('can-right', max > 4 && t.scrollLeft < max - 4);
      };
      t.addEventListener('scroll', () => { if (!raf) raf = requestAnimationFrame(upd); }, { passive: true });
      window.addEventListener('resize', upd);
      upd();
    });

    /* ---------- ТАРИФЫ: вкладки на телефоне ---------- */
    const tabs = $$('[data-plan-tab]');
    const plans = $$('[data-plan]');
    tabs.forEach((b) => b.addEventListener('click', () => {
      const i = +b.dataset.planTab;
      tabs.forEach((x) => { x.classList.toggle('on', x === b); x.setAttribute('aria-selected', String(x === b)); });
      plans.forEach((p, k) => p.classList.toggle('is-active', k === i));
      gsap.fromTo(plans[i], { opacity: 0, y: 18 }, { opacity: 1, y: 0, duration: 0.6, ease: 'expo.out' });
    }));

    /* ---------- FAQ ---------- */
    $$('[data-faq] details').forEach((d) => {
      const s = $('summary', d), a = $('.faq__a', d);
      s.addEventListener('click', (e) => {
        e.preventDefault();
        if (d.open) {
          gsap.to(a, { height: 0, duration: 0.45, ease: 'power3.inOut', onComplete: () => { d.open = false; a.style.height = ''; } });
        } else {
          $$('[data-faq] details[open]').forEach((o) => { const oa = $('.faq__a', o); gsap.to(oa, { height: 0, duration: 0.4, ease: 'power3.inOut', onComplete: () => { o.open = false; oa.style.height = ''; } }); });
          d.open = true;
          gsap.fromTo(a, { height: 0 }, { height: 'auto', duration: 0.6, ease: 'expo.out', onComplete: () => { a.style.height = ''; ScrollTrigger.refresh(); } });
        }
      });
    });

    /* =====================================================
       Скролл-сцены (scrub/toggle → работают в обе стороны)
       ===================================================== */
    function setupScroll() {
      const mm = gsap.matchMedia();
      const rev = { toggleActions: 'play none none reverse' };
      const reveal = (els, trigger, start = 'top 72%') => {
        els = els.filter(Boolean);
        if (!els.length) return;
        gsap.fromTo(els, { opacity: 0, y: 28 }, { opacity: 1, y: 0, duration: 0.9, stagger: 0.07, ease: 'expo.out', scrollTrigger: { trigger, start, ...rev } });
      };
      // уходящий слой: гаснет и чуть уменьшается, только когда новый слой закрыл ~40% экрана.
      // Без blur: текст читается, пока блок на месте, и не грузит видеокарту.
      const layer = (target, next) => {
        const el = typeof target === 'string' ? $(target) : target;
        if (!el) return;
        gsap.fromTo(el, { scale: 1, opacity: 1 }, {
          scale: 0.94, opacity: 0.35, ease: 'power1.in', immediateRender: false,
          scrollTrigger: { trigger: next, start: 'top 60%', end: 'top 4%', scrub: true },
        });
      };
      // крупные фото шагов и карточек декодируем заранее, а не в момент показа
      const predecode = (imgs) => imgs.forEach((im) => { if (!im) return; im.loading = 'eager'; if (im.decode) im.decode().catch(() => {}); });
      ScrollTrigger.create({ trigger: '#pain', start: 'top bottom', once: true, onEnter: () => predecode($$('[data-step-img] img')) });
      ScrollTrigger.create({ trigger: '#how', start: 'top bottom', once: true, onEnter: () => predecode($$('.why__img img')) });
      ScrollTrigger.create({ trigger: '#kcal', start: 'top bottom', once: true, onEnter: () => predecode(isDesk() ? $$('[data-feat-stage] img') : $$('.feat__img img')) });

      /* hero → боль */
      layer('[data-statement]', '#pain');
      reveal($$('[data-reveal]', $('#pain')), '#pain', 'top 62%');
      const gardenEl = $('[data-garden]');
      if (gardenEl) growGarden(gardenEl, buildGarden(gardenEl));
      layer('.mission__sticky', '#how');

      /* STEPS: 4 экрана сменяют друг друга */
      const stepsSec = $('[data-steps]');
      const steps = $$('[data-step]');
      const simgs = $$('[data-step-img]');
      const bars = $$('[data-step-bar]');
      const num = $('[data-step-num]');
      let cur = 0;
      const showStep = (i, dir) => {
        if (i === cur) return;
        const prev = cur; cur = i;
        const out = steps[prev], inn = steps[i];
        gsap.killTweensOf([out, inn, ...out.children, ...inn.children]);
        steps.forEach((s, k) => { if (k !== prev && k !== i) { s.classList.remove('is-active'); gsap.set(s, { clearProps: 'all' }); gsap.set(s.children, { clearProps: 'all' }); } });
        gsap.to(out, { opacity: 0, y: dir > 0 ? -30 : 30, duration: 0.35, ease: 'power2.in', onComplete: () => { out.classList.remove('is-active'); gsap.set(out, { clearProps: 'all' }); } });
        inn.classList.add('is-active');
        gsap.set(inn, { opacity: 1, y: 0 });
        gsap.fromTo(inn.children, { opacity: 0, y: dir > 0 ? 40 : -40 }, { opacity: 1, y: 0, duration: 0.85, stagger: 0.08, ease: 'expo.out', delay: 0.18 });
        // фото: новое выезжает «шторкой» — только transform
        const of = simgs[prev], nf = simgs[i];
        simgs.forEach((f, k) => { if (k !== prev && k !== i) { gsap.killTweensOf([f, $('img', f)]); gsap.set(f, { opacity: 0.001, zIndex: 0, yPercent: 0 }); gsap.set($('img', f), { yPercent: 0, scale: 1 }); } });
        gsap.killTweensOf([of, nf, $('img', of), $('img', nf)]);
        gsap.set(of, { zIndex: 1, opacity: 1, yPercent: 0 });
        gsap.set(nf, { zIndex: 2, opacity: 1 });
        gsap.fromTo(nf, { yPercent: dir > 0 ? 100 : -100 }, { yPercent: 0, duration: 1, ease: 'expo.inOut' });
        gsap.fromTo($('img', nf), { yPercent: dir > 0 ? -60 : 60, scale: 1.12 }, { yPercent: 0, scale: 1, duration: 1.15, ease: 'expo.inOut' });
        gsap.to($('img', of), { yPercent: dir > 0 ? -16 : 16, duration: 1, ease: 'expo.inOut', onComplete: () => { gsap.set(of, { opacity: 0.001, zIndex: 0 }); gsap.set($('img', of), { yPercent: 0, scale: 1 }); } });
        num.textContent = String(i + 1).padStart(2, '0');
        gsap.fromTo(num, { yPercent: dir > 0 ? 100 : -100 }, { yPercent: 0, duration: 0.7, ease: 'expo.out' });
      };
      ScrollTrigger.create({
        trigger: stepsSec, start: 'top top', end: () => '+=' + Math.round(innerHeight * (isDesk() ? 2 : 1.4)),
        onUpdate: (self) => {
          const p = self.progress;
          bars.forEach((b, k) => b.style.setProperty('--p', clamp(p * 4 - k).toFixed(3)));
          const i = clamp(Math.floor(p * 4), 0, 3);
          if (i !== cur) showStep(i, i > cur ? 1 : -1);
        },
      });
      layer('.steps__sticky', '#why');

      /* WHY: панели наслаиваются (десктоп), карусель (телефон) */
      mm.add(DESK, () => {
        const panels = $$('[data-why-panel]');
        panels.forEach((p, i) => {
          if (!i) return;
          gsap.fromTo($('.why__box', panels[i - 1]), { scale: 1, opacity: 1 }, {
            scale: 0.92, opacity: 0.4, ease: 'power1.in',
            scrollTrigger: { trigger: p, start: 'top 65%', end: 'top top', scrub: true },
          });
          gsap.fromTo($$('.why__copy > *, .why__img', p), { opacity: 0, y: 50 }, { opacity: 1, y: 0, stagger: 0.06, ease: 'none', scrollTrigger: { trigger: p, start: 'top 85%', end: 'top 20%', scrub: true } });
        });
        reveal($$('[data-reveal]', $('#why')), '#why', 'top 55%');
      });
      mm.add(MOB, () => {
        reveal([...$$('[data-reveal]', $('#why')), ...$$('.why__track .why__panel').slice(0, 2)], '#why', 'top 62%');
      });

      /* KCAL */
      reveal($$('[data-reveal]', $('#kcal')), '#kcal');
      gsap.fromTo('.kcal__card', { opacity: 0, y: 60, scale: 0.94, rotation: 2 }, { opacity: 1, y: 0, scale: 1, rotation: 0, duration: 1.2, ease: 'expo.out', scrollTrigger: { trigger: '#kcal', start: 'top 68%', ...rev } });

      /* INSIDE */
      reveal($$('[data-reveal]', $('#inside')), '#inside');
      mm.add(DESK, () => {
        reveal($$('.feat__item'), '.feat', 'top 80%');
        gsap.fromTo('.inside__stage', { opacity: 0, y: 60, scale: 0.92 }, { opacity: 1, y: 0, scale: 1, duration: 1.3, ease: 'expo.out', scrollTrigger: { trigger: '.inside__body', start: 'top 75%', ...rev } });
      });
      mm.add(MOB, () => reveal($$('.feat__item').slice(0, 2), '.feat', 'top 85%'));

      /* ABOUT → на него наезжают отзывы */
      reveal($$('[data-reveal]', $('#about')), '#about', 'top 60%');
      gsap.fromTo('.about__photo', { opacity: 0, y: 80, scale: 0.9 }, { opacity: 1, y: 0, scale: 1, duration: 1.4, ease: 'expo.out', scrollTrigger: { trigger: '#about', start: 'top 62%', ...rev } });
      gsap.fromTo('.about__photo img', { scale: 1.25 }, { scale: 1, duration: 1.8, ease: 'expo.out', scrollTrigger: { trigger: '#about', start: 'top 62%', ...rev } });
      $$('[data-count]').forEach((el) => {
        const end = +el.dataset.count;
        const fmt = (v) => (el.dataset.format === 'space' ? Math.round(v).toLocaleString('ru-RU').replace(/\s/g, ' ') : Math.round(v));
        const o = { v: 0 };
        ScrollTrigger.create({ trigger: '#about', start: 'top 50%', once: true, onEnter: () => gsap.to(o, { v: end, duration: 1.8, ease: 'power3.out', onUpdate: () => (el.textContent = fmt(o.v)) }) });
      });
      layer('.about__sticky', '#reviews');

      /* REVIEWS: карточки проплывают поверх заголовка и тают у верхнего края — и на телефоне тоже */
      gsap.fromTo('.reviews__titlebox', { opacity: 0, y: 40 }, { opacity: 1, y: 0, duration: 1.2, ease: 'expo.out', scrollTrigger: { trigger: '#reviews', start: 'top 45%', ...rev } });
      const floatCards = () => {
        $$('.rv__item').filter((it) => it.offsetParent !== null).forEach((it) => {
          gsap.timeline({ scrollTrigger: { trigger: it, start: 'top bottom', end: 'bottom top', scrub: true } })
            .fromTo(it, { opacity: 0, y: 110, scale: 0.92 }, { opacity: 1, y: 0, scale: 1, duration: 0.26, ease: 'power2.out' })
            .to(it, { duration: 0.46 })
            .to(it, { opacity: 0, y: -50, scale: 0.94, duration: 0.28, ease: 'power2.in' });
        });
      };
      mm.add(DESK, floatCards);
      mm.add(MOB, floatCards);
      gsap.fromTo('.more-btn', { opacity: 0, y: 30, scale: 0.94 }, { opacity: 1, y: 0, scale: 1, duration: 1, ease: 'expo.out', scrollTrigger: { trigger: '.reviews__more', start: 'top 92%', ...rev } });

      /* PRICING */
      reveal($$('[data-reveal]', $('#pricing')), '#pricing');
      gsap.fromTo('.pricing__bg img', { yPercent: -6 }, { yPercent: 6, ease: 'none', scrollTrigger: { trigger: '#pricing', start: 'top bottom', end: 'bottom top', scrub: true } });
      gsap.fromTo('[data-plan], .plans-tabs', { opacity: 0, y: 60 }, { opacity: 1, y: 0, duration: 1.1, stagger: 0.12, ease: 'expo.out', scrollTrigger: { trigger: '.plans', start: 'top 90%', ...rev } });
      // в блоке тарифов кнопка внизу не нужна — там свои
      ScrollTrigger.create({ trigger: '#pricing', start: 'top 70%', end: 'bottom 30%', onToggle: (self) => dock.classList.toggle('is-away', self.isActive) });

      /* FAQ → финал наезжает (на телефоне FAQ идёт обычным потоком) */
      reveal([...$$('[data-reveal]', $('#faq')), ...$$('[data-faq] details')], '#faq', 'top 64%');
      mm.add(DESK, () => layer('.faq__sticky', '.final'));
      reveal($$('[data-reveal]', $('.final')), '.final', 'top 60%');

      /* шапка прячется при скролле вниз */
      ScrollTrigger.create({ start: 0, end: 'max', onUpdate: (self) => { if (menuOpen) return; nav.classList.toggle('is-hidden', self.direction === 1 && self.scroll() > 200); } });

      if (document.fonts) document.fonts.ready.then(() => ScrollTrigger.refresh());
    }

    /* =====================================================
       Ленты «паста ✦ пицца…»: canvas, буквы едут вдоль кривой («змейкой»).
       Лента рисуется один раз в кэш, каждый кадр — только ~150 букв из атласа.
       ===================================================== */
    function initRibbons() {
      const sec = $('[data-ribbons]');
      const cv = sec && $('[data-ribbons-canvas]', sec);
      if (!cv || !cv.getContext) return;
      const ctx = cv.getContext('2d');
      const VW = 1440, VH = 360, BAND = 62, FONT = 27, TRACK = 0.06;
      const defs = [
        { d: 'M-900,120 C-500,250 -200,90 200,170 C560,240 760,70 1060,170 C1300,250 1520,210 2340,140', band: '#2E3520', ink: '#DCE7A9', text: 'не грудка с гречкой ✦ не диета ✦ не марафон ✦ без запретов ✦ ', dir: -1 },
        { d: 'M-900,210 C-500,90 -200,260 180,150 C520,52 700,300 1000,200 C1260,112 1480,150 2340,170', band: '#CFE08A', ink: '#2E3520', text: 'паста ✦ пицца ✦ хачапури ✦ лазанья ✦ супы ✦ брауни ✦ креветки ✦ роллы с манго ✦ и да, шоколадки ✦ ', dir: 1 },
      ];
      // кривая → таблица «длина дуги → x, y, угол» с шагом 1 ед.
      const cubic = (a, b, c, d, t) => { const u = 1 - t; return u * u * u * a + 3 * u * u * t * b + 3 * u * t * t * c + t * t * t * d; };
      const buildLUT = (dstr) => {
        const n = dstr.match(/-?\d+(\.\d+)?/g).map(Number);
        const P = []; for (let i = 0; i < n.length; i += 2) P.push([n[i], n[i + 1]]);
        const pts = [];
        for (let s = 0; s + 3 < P.length; s += 3) {
          const [p0, p1, p2, p3] = [P[s], P[s + 1], P[s + 2], P[s + 3]];
          for (let i = s ? 1 : 0; i <= 400; i++) { const t = i / 400; pts.push([cubic(p0[0], p1[0], p2[0], p3[0], t), cubic(p0[1], p1[1], p2[1], p3[1], t)]); }
        }
        const cum = [0];
        for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
        const L = cum[cum.length - 1], N = Math.ceil(L) + 1;
        const X = new Float32Array(N), Y = new Float32Array(N), CO = new Float32Array(N), SI = new Float32Array(N);
        let j = 0;
        for (let s = 0; s < N; s++) {
          while (j < cum.length - 2 && cum[j + 1] < s) j++;
          const seg = cum[j + 1] - cum[j] || 1, t = clamp((s - cum[j]) / seg);
          X[s] = lerp(pts[j][0], pts[j + 1][0], t); Y[s] = lerp(pts[j][1], pts[j + 1][1], t);
          const a = Math.atan2(pts[j + 1][1] - pts[j][1], pts[j + 1][0] - pts[j][0]);
          CO[s] = Math.cos(a); SI[s] = Math.sin(a);
        }
        return { L, N, X, Y, CO, SI };
      };
      const R = defs.map((d) => ({ ...d, lut: buildLUT(d.d), off: 0, glyphs: [], unit: 1, atlas: null, bandC: null, s0: 0, s1: 0 }));
      let dpr = 1, cw = 0, ch = 0, k = 1, ox = 0, oy = 0, ready = false, visible = false, speed = 1;
      const font = `600 ${FONT}px Geist, -apple-system, "Segoe UI", Arial, sans-serif`;
      const drawStar = (c, x, y, r) => {
        c.beginPath();
        for (let i = 0; i < 8; i++) { const a = (i * Math.PI) / 4 - Math.PI / 2, rr = i % 2 ? r * 0.28 : r; c.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
        c.closePath(); c.fill();
      };
      const build = () => {
        cw = sec.clientWidth; ch = sec.clientHeight;
        if (!cw || !ch) return;
        dpr = Math.min(window.devicePixelRatio || 1, 2);
        cv.width = Math.round(cw * dpr); cv.height = Math.round(ch * dpr);
        k = Math.max(cw / VW, ch / VH); ox = (cw - VW * k) / 2; oy = (ch - VH * k) / 2;
        const S = dpr * k; // пикселей устройства на 1 ед. макета
        R.forEach((r) => {
          // лента → кэш
          const bc = document.createElement('canvas'); bc.width = cv.width; bc.height = cv.height;
          const b = bc.getContext('2d');
          b.setTransform(S, 0, 0, S, ox * dpr, oy * dpr);
          b.strokeStyle = r.band; b.lineWidth = BAND; b.lineCap = 'butt'; b.lineJoin = 'round';
          b.stroke(new Path2D(r.d));
          r.bandC = bc;
          // атлас букв
          const txt = r.text.toUpperCase();
          const chars = [...new Set([...txt])];
          const m = document.createElement('canvas').getContext('2d');
          m.font = font;
          const adv = {}; chars.forEach((c) => { adv[c] = c === '✦' ? FONT * 0.95 : m.measureText(c).width + FONT * TRACK; });
          const cellH = Math.ceil(FONT * 1.5 * S), pad = Math.ceil(4 * S);
          const cells = {}; let x = 0;
          chars.forEach((c) => { const w = Math.ceil((c === '✦' ? FONT : adv[c]) * S) + pad * 2; cells[c] = { x, w }; x += w; });
          const at = document.createElement('canvas'); at.width = Math.max(1, x); at.height = cellH;
          const a = at.getContext('2d');
          a.fillStyle = r.ink; a.textBaseline = 'middle'; a.textAlign = 'center';
          a.font = `600 ${FONT * S}px Geist, -apple-system, "Segoe UI", Arial, sans-serif`;
          chars.forEach((c) => {
            const cell = cells[c], cx = cell.x + cell.w / 2;
            if (c === '✦') drawStar(a, cx, cellH / 2, FONT * 0.36 * S);
            else if (c !== ' ') a.fillText(c, cx, cellH / 2 + FONT * 0.04 * S);
          });
          r.atlas = at;
          r.glyphs = [...txt].map((c) => ({ c, adv: adv[c], cell: cells[c] }));
          r.unit = r.glyphs.reduce((s, g) => s + g.adv, 0);
          r.cellH = cellH;
          // видимый кусок кривой (кривые монотонны по x) → рисуем только его
          const xl = -ox / k - 60, xr = (cw - ox) / k + 60, L = r.lut;
          let s0 = 0; while (s0 < L.N - 1 && L.X[s0] < xl) s0++;
          let s1 = L.N - 1; while (s1 > 0 && L.X[s1] > xr) s1--;
          r.s0 = s0; r.s1 = s1;
        });
        ready = true;
        draw();
      };
      const draw = () => {
        if (!ready) return;
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, cv.width, cv.height);
        const S = dpr * k;
        R.forEach((r) => {
          ctx.setTransform(1, 0, 0, 1, 0, 0);
          ctx.drawImage(r.bandC, 0, 0);
          const L = r.lut, U = r.unit;
          let s = (((r.off % U) + U) % U) - U + r.s0 - (r.s0 % U);
          while (s < r.s0 - U) s += U;
          let gi = 0;
          const G = r.glyphs, n = G.length;
          while (s < r.s1) {
            const g = G[gi];
            const mid = s + g.adv / 2;
            if (mid >= r.s0 && mid < r.s1 && g.c !== ' ') {
              const ii = mid | 0;
              const co = L.CO[ii], si = L.SI[ii];
              const X = (L.X[ii] * k + ox) * dpr, Y = (L.Y[ii] * k + oy) * dpr;
              ctx.setTransform(co, si, -si, co, X, Y);
              ctx.drawImage(r.atlas, g.cell.x, 0, g.cell.w, r.cellH, -g.cell.w / 2, -r.cellH / 2, g.cell.w, r.cellH);
            }
            s += g.adv; gi++; if (gi === n) gi = 0;
          }
        });
        ctx.setTransform(1, 0, 0, 1, 0, 0);
      };
      const tick = (time, dt) => {
        if (!visible || !ready) return;
        const target = 1 + Math.min(Math.abs(scrollVel) * 0.0045, 4);
        speed += (target - speed) * 0.08;
        const step = 46 * speed * (Math.min(dt, 50) / 1000);
        R.forEach((r) => { r.off += r.dir * step; });
        draw();
      };
      new IntersectionObserver(([en]) => { visible = en.isIntersecting; }, { rootMargin: '80px 0px' }).observe(sec);
      if (!reduce) gsap.ticker.add(tick);
      let rt;
      const ro = new ResizeObserver(() => { clearTimeout(rt); rt = setTimeout(build, 120); });
      ro.observe(sec);
      const fl = document.fonts && document.fonts.load ? document.fonts.load(`600 ${FONT}px Geist`, 'ПАСТА') : Promise.resolve();
      Promise.race([fl, new Promise((r) => setTimeout(r, 1500))]).then(build, build);
    }

    /* =====================================================
       Сад в блоке «Дело не в силе воли»: трава, цветы, базилик, лианы.
       SVG рисуется кодом; рост — один раз, потом лёгкое покачивание на CSS
       (анимируется весь слой целиком → композитор, без перерисовки).
       ===================================================== */
    function buildGarden(host) {
      const NS = 'http://www.w3.org/2000/svg';
      const mk = (t, a, p) => { const e = document.createElementNS(NS, t); for (const key in a) e.setAttribute(key, a[key]); if (p) p.appendChild(e); return e; };
      let seed = 29;
      const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
      const R = (a, b) => a + (b - a) * rnd();
      const f1 = (v) => v.toFixed(1);
      const small = !isDesk();
      const C = { deep: '#3B4625', olive: '#5E6A3A', leaf: '#728645', fresh: '#8DA754', bright: '#A8C265', sage: '#B4BF94', pale: '#CDD5B0', petal: '#FFFDF6', yolk: '#E6BA4C', clay: '#96583F', blush: '#EBAC9B', tomato: '#D6533A', poppy: '#C9452F', line: 'rgba(78, 90, 48, .38)' };
      const out = { groups: [] };
      const svg = (cls, w, h) => mk('svg', { class: cls, viewBox: `0 0 ${w} ${h}`, 'aria-hidden': 'true', focusable: 'false' }, host);
      const group = (kind, opts = {}) => { const g = { kind, els: [], ...opts }; out.groups.push(g); return g; };

      const blade = (p, G, x, base, h, lean, w, fill) => {
        G.els.push(mk('path', { d: `M${f1(x - w / 2)},${base} C${f1(x - w / 2)},${f1(base - h * 0.45)} ${f1(x + lean * 0.35)},${f1(base - h * 0.78)} ${f1(x + lean)},${f1(base - h)} C${f1(x + lean * 0.3 + w * 0.12)},${f1(base - h * 0.72)} ${f1(x + w / 2)},${f1(base - h * 0.4)} ${f1(x + w / 2)},${base} Z`, fill }, p));
      };
      const leaf = (p, G, x, y, ang, L, W, fill, vein) => {
        const g = mk('g', { transform: `translate(${f1(x)} ${f1(y)}) rotate(${f1(ang)})` }, p);
        const inner = mk('g', {}, g);
        mk('path', { d: `M0,0 C${f1(L * 0.12)},${f1(-W * 1.15)} ${f1(L * 0.7)},${f1(-W * 1.05)} ${f1(L)},0 C${f1(L * 0.7)},${f1(W * 1.05)} ${f1(L * 0.12)},${f1(W * 1.15)} 0,0 Z`, fill }, inner);
        if (vein) mk('path', { d: `M${f1(L * 0.1)},0 Q${f1(L * 0.5)},${f1(-W * 0.12)} ${f1(L * 0.86)},0`, fill: 'none', stroke: vein, 'stroke-width': 1.2, 'stroke-linecap': 'round', opacity: 0.55 }, inner);
        G.els.push(inner);
      };
      const stem = (p, G, d, color, w) => { const e = mk('path', { d, fill: 'none', stroke: color, 'stroke-width': w, 'stroke-linecap': 'round' }, p); G.els.push(e); return e; };
      const bloomG = (p, G, x, y, rot) => { const g = mk('g', { transform: `translate(${f1(x)} ${f1(y)}) rotate(${f1(rot)})` }, p); const inner = mk('g', {}, g); G.els.push(inner); return inner; };
      const daisy = (p, G, x, y, r) => {
        const g = bloomG(p, G, x, y, R(0, 30));
        for (let i = 0; i < 13; i++) mk('ellipse', { cx: f1(r * 0.56), cy: 0, rx: f1(r * 0.48), ry: f1(r * 0.16), fill: C.petal, stroke: C.line, 'stroke-width': 0.9, transform: `rotate(${f1((i * 360) / 13)})` }, g);
        mk('circle', { r: f1(r * 0.3), fill: C.yolk }, g);
        mk('circle', { cx: f1(-r * 0.08), cy: f1(-r * 0.08), r: f1(r * 0.12), fill: '#F2D27E', opacity: 0.8 }, g);
      };
      const poppy = (p, G, x, y, r) => {
        const g = bloomG(p, G, x, y, R(0, 90));
        for (let i = 0; i < 4; i++) { const a = (i * Math.PI) / 2; mk('circle', { cx: f1(Math.cos(a) * r * 0.42), cy: f1(Math.sin(a) * r * 0.42), r: f1(r * 0.62), fill: i % 2 ? C.poppy : C.tomato }, g); }
        mk('circle', { r: f1(r * 0.24), fill: C.deep }, g);
        for (let i = 0; i < 8; i++) { const a = (i * Math.PI) / 4; mk('circle', { cx: f1(Math.cos(a) * r * 0.33), cy: f1(Math.sin(a) * r * 0.33), r: f1(r * 0.06), fill: C.deep }, g); }
      };
      const bell = (p, G, x, y, s, rot) => {
        const g = bloomG(p, G, x, y, rot);
        mk('path', { d: `M${f1(-s * 0.42)},${f1(s * 0.15)} C${f1(-s * 0.48)},${f1(s * 0.7)} ${f1(-s * 0.36)},${f1(s * 1.02)} ${f1(-s * 0.56)},${f1(s * 1.2)} Q0,${f1(s * 1.05)} ${f1(s * 0.56)},${f1(s * 1.2)} C${f1(s * 0.36)},${f1(s * 1.02)} ${f1(s * 0.48)},${f1(s * 0.7)} ${f1(s * 0.42)},${f1(s * 0.15)} C${f1(s * 0.28)},${f1(-s * 0.06)} ${f1(-s * 0.28)},${f1(-s * 0.06)} ${f1(-s * 0.42)},${f1(s * 0.15)} Z`, fill: C.blush }, g);
        mk('path', { d: `M0,${f1(s * 0.1)} L0,${f1(s * 1.0)}`, stroke: 'rgba(150, 88, 63, .35)', 'stroke-width': 1, fill: 'none' }, g);
      };
      const jasmine = (p, G, x, y, r) => {
        const g = bloomG(p, G, x, y, R(0, 72));
        for (let i = 0; i < 5; i++) mk('path', { d: `M0,0 C${f1(r * 0.35)},${f1(-r * 0.45)} ${f1(r * 0.95)},${f1(-r * 0.32)} ${f1(r)},0 C${f1(r * 0.95)},${f1(r * 0.32)} ${f1(r * 0.35)},${f1(r * 0.45)} 0,0 Z`, fill: C.petal, stroke: C.line, 'stroke-width': 0.8, transform: `rotate(${i * 72})` }, g);
        mk('circle', { r: f1(r * 0.2), fill: C.yolk }, g);
      };
      const tomatoes = (p, G, x, y, r) => {
        const g = bloomG(p, G, x, y, 0);
        [[0, 0], [r * 1.7, r * 0.9], [-r * 1.4, r * 1.3]].forEach(([dx, dy], i) => {
          const rr = r * (1 - i * 0.12);
          mk('path', { d: `M0,${f1(-r * 1.6)} Q${f1(dx * 0.4)},${f1(dy * 0.2 - r)} ${f1(dx)},${f1(dy - rr)}`, fill: 'none', stroke: C.leaf, 'stroke-width': 1.6 }, g);
          mk('circle', { cx: f1(dx), cy: f1(dy), r: f1(rr), fill: C.tomato }, g);
          mk('circle', { cx: f1(dx - rr * 0.35), cy: f1(dy - rr * 0.35), r: f1(rr * 0.26), fill: '#fff', opacity: 0.32 }, g);
          drawCalyx(g, dx, dy - rr, rr * 0.55);
        });
      };
      const drawCalyx = (p, x, y, r) => { let d = ''; for (let i = 0; i < 5; i++) { const a = (i * 2 * Math.PI) / 5 - Math.PI / 2; d += `M${f1(x)},${f1(y)} L${f1(x + Math.cos(a) * r)},${f1(y + Math.sin(a) * r * 0.6)} `; } mk('path', { d, stroke: C.olive, 'stroke-width': 1.6, 'stroke-linecap': 'round', fill: 'none' }, p); };
      const smooth = (pts) => {
        let d = `M${f1(pts[0][0])},${f1(pts[0][1])}`;
        for (let i = 0; i < pts.length - 1; i++) {
          const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
          d += ` C${f1(p1[0] + (p2[0] - p0[0]) / 6)},${f1(p1[1] + (p2[1] - p0[1]) / 6)} ${f1(p2[0] - (p3[0] - p1[0]) / 6)},${f1(p2[1] - (p3[1] - p1[1]) / 6)} ${f1(p2[0])},${f1(p2[1])}`;
        }
        return d;
      };
      const tendril = (p, G, x, y, ang, r, dir) => {
        const a0 = (ang * Math.PI) / 180, cx = x + Math.cos(a0) * r, cy = y + Math.sin(a0) * r;
        let d = `M${f1(x)},${f1(y)}`;
        for (let i = 1; i <= 26; i++) { const t = i / 26, th = a0 + Math.PI + dir * t * Math.PI * 3.2, rr = r * (1 - t * 0.82); d += ` L${f1(cx + Math.cos(th) * rr)},${f1(cy + Math.sin(th) * rr)}`; }
        stem(p, G, d, C.leaf, 1.4);
      };
      const cosmos = (p, G, x, y, r) => {
        const g = bloomG(p, G, x, y, R(0, 45));
        for (let i = 0; i < 8; i++) mk('path', { d: `M0,0 C${f1(r * 0.2)},${f1(-r * 0.42)} ${f1(r * 0.9)},${f1(-r * 0.4)} ${f1(r)},${f1(-r * 0.08)} L${f1(r * 0.92)},${f1(r * 0.1)} C${f1(r * 0.9)},${f1(r * 0.4)} ${f1(r * 0.2)},${f1(r * 0.42)} 0,0 Z`, fill: i % 2 ? C.blush : '#F2C2B4', transform: `rotate(${i * 45})` }, g);
        mk('circle', { r: f1(r * 0.24), fill: C.yolk }, g);
      };
      const clover = (p, G, x, y, r, ang) => {
        const g = bloomG(p, G, x, y, ang);
        mk('path', { d: `M0,0 L0,${f1(r * 1.6)}`, stroke: C.leaf, 'stroke-width': 1.6, fill: 'none' }, g);
        for (let i = 0; i < 3; i++) mk('circle', { cx: f1(Math.cos((i * 2 * Math.PI) / 3 - Math.PI / 2) * r * 0.62), cy: f1(Math.sin((i * 2 * Math.PI) / 3 - Math.PI / 2) * r * 0.62), r: f1(r * 0.58), fill: i ? C.fresh : C.leaf }, g);
      };
      // лиана: стебель + листья по очереди + усики + цветы, всё вдоль длины
      // на телефоне всё мельче в 2,5 раза → листья и стебли рисуем крупнее, чтобы читались
      const K = small ? 1.35 : 1;
      const vine = (p, pts, sw, cols, flower, every, leafK = 1) => {
        const V = group('vine');
        const path = stem(p, V, smooth(pts), C.olive, sw * (small ? 1.5 : 1));
        const L = group('vleaf'), T = group('tendril'), B = group('bloom');
        const len = path.getTotalLength(), n = Math.max(4, Math.round(len / (22 * K)));
        for (let i = 1; i < n; i++) {
          const s = (i / n) * len, a = path.getPointAtLength(s), b = path.getPointAtLength(Math.min(len, s + 1));
          const tang = (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;
          const side = i % 2 ? 1 : -1, sz = K * leafK * R(0.82, 1.12) * (1 - (i / n) * 0.28);
          leaf(p, L, a.x, a.y, tang + side * R(44, 70), 42 * sz, 15.5 * sz, cols[i % cols.length], C.deep);
          if (i % 4 === 2) tendril(p, T, a.x, a.y, tang - side * 70, R(9, 14) * K, side);
          if (flower && i % every === every - 1) flower(p, B, a.x + side * 8, a.y + 4, R(9, 12.5) * K);
        }
      };

      // ---------- луг: s = 1 — левый, -1 — правый (зеркально) ----------
      const bw = 600, bh = 420;
      const HK = small ? 1.3 : 1;
      const meadow = (s) => {
        const X = (x) => (s > 0 ? x : bw - x);
        const cls = s > 0 ? 'g-bl' : 'g-br';
        const flowerA = s > 0 ? jasmine : (p, G, x, y, r) => bell(p, G, x, y, r * 1.3, R(-20, 20));
        const back = svg(`${cls} g-back`, bw, bh);
        // лианы по краю — тянутся вверх вдоль боковой стороны
        vine(back, [[X(30), 430], [X(22), 330], [X(44), 230], [X(20), 130], [X(46), 30], [X(26), -80], [X(50), small ? -150 : -200]], 3.2, [C.leaf, C.fresh, C.olive, C.bright], flowerA, 3);
        if (!small) vine(back, [[X(96), 430], [X(84), 350], [X(110), 270], [X(88), 190], [X(112), 110]], 2.6, [C.fresh, C.bright, C.leaf], s > 0 ? cosmos : jasmine, 4, 0.85);
        // куст у края
        const BU = group('leaf');
        for (let i = 0; i < (small ? 9 : 14); i++) {
          const x = X(R(0, 190)), ang = s > 0 ? R(-160, -40) : R(-140, -20);
          leaf(back, BU, x, bh + 6, ang, R(70, 120), R(22, 34), [C.deep, C.olive, C.leaf][i % 3], 'rgba(255,255,255,.35)');
        }
        // трава задняя
        const G = group('blade');
        for (let i = 0; i < (small ? 16 : 26); i++) { const x = R(8, 592), d = s > 0 ? x : bw - x; blade(back, G, x, bh, R(130, 290) * (1 - d / 1250) * HK, R(-42, 42), R(7, 12) * K, [C.sage, C.pale, C.leaf][i % 3]); }
        // цветы на стеблях
        const S = group('stem'), B = group('bloom');
        const fl = [[150, 320, daisy, 22], [235, 262, poppy, 18], [318, 230, cosmos, 19], [96, 350, poppy, 16], [400, 190, daisy, 18], [205, 190, cosmos, 15]];
        fl.slice(0, small ? 4 : 6).forEach(([x0, h, fn, r]) => {
          const x = X(x0), lean = R(-34, 34), tx = x + lean, ty = bh - h;
          stem(back, S, `M${f1(x)},${bh} C${f1(x)},${f1(bh - h * 0.5)} ${f1(tx - lean * 0.2)},${f1(ty + h * 0.3)} ${f1(tx)},${f1(ty)}`, C.leaf, 2.3);
          fn(back, B, tx, ty, r);
        });
        if (s < 0) {
          // папоротник
          const F = group('stem'), FL = group('leaf');
          const fx = X(small ? 140 : 110);
          const fern = stem(back, F, smooth([[fx, bh], [fx + 14, bh - 120], [fx + 66, bh - 220], [fx + 150, bh - 272]]), C.olive, 2.4);
          const len = fern.getTotalLength(), n = small ? 10 : 14;
          for (let i = 1; i < n; i++) {
            const a = fern.getPointAtLength((i / n) * len), b = fern.getPointAtLength(Math.min(len, (i / n) * len + 1));
            const tang = (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI, sz = 1.2 - (i / n) * 0.8;
            leaf(back, FL, a.x, a.y, tang - 64, 36 * sz, 8.5 * sz, C.leaf, null);
            leaf(back, FL, a.x, a.y, tang + 64, 36 * sz, 8.5 * sz, C.fresh, null);
          }
        }
        const front = svg(`${cls} g-front`, bw, bh);
        const S2 = group('stem'), LF = group('leaf'), T = group('bloom');
        if (s > 0) {
          // базилик
          const bx = X(small ? 128 : 112), bhgt = small ? 190 : 235, bl = 14;
          const bs = stem(front, S2, `M${bx},${bh} C${bx},${bh - bhgt * 0.4} ${bx + bl * 0.6},${bh - bhgt * 0.7} ${bx + bl},${bh - bhgt}`, C.leaf, 4.8);
          const blen = bs.getTotalLength();
          for (let i = 1; i <= 5; i++) {
            const t = i / 5.6, a = bs.getPointAtLength(blen * t), b = bs.getPointAtLength(Math.min(blen, blen * t + 1));
            const tang = (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI, sz = 1.05 - t * 0.5;
            leaf(front, LF, a.x, a.y, tang - 72, 70 * sz, 27 * sz, i % 2 ? C.fresh : C.bright, C.olive);
            leaf(front, LF, a.x, a.y, tang + 72, 66 * sz, 25 * sz, i % 2 ? C.bright : C.fresh, C.olive);
          }
          leaf(front, LF, bx + bl, bh - bhgt, -112, 32, 13, C.bright, C.olive);
          leaf(front, LF, bx + bl, bh - bhgt, -68, 30, 12, C.fresh, C.olive);
        } else {
          // куст томатов
          const tx0 = X(small ? 150 : 140);
          const tst = stem(front, S2, smooth([[tx0, bh], [tx0 - 10, bh - 95], [tx0 + 12, bh - 170], [tx0 - 4, bh - 225]]), C.leaf, 3.8);
          const tl = tst.getTotalLength();
          for (let i = 1; i <= 5; i++) { const a = tst.getPointAtLength((tl * i) / 5.6); leaf(front, LF, a.x, a.y, i % 2 ? -32 : -148, 48 - i * 4, 16 - i, i % 2 ? C.fresh : C.leaf, C.olive); }
          tomatoes(front, T, tx0 - 30, bh - 150, small ? 12 : 14);
          tomatoes(front, T, tx0 + 26, bh - 92, small ? 10 : 12);
        }
        // трава передняя
        const G2 = group('blade');
        for (let i = 0; i < (small ? 13 : 20); i++) { const x = R(0, 590), d = s > 0 ? x : bw - x; blade(front, G2, x, bh, R(70, 190) * (1 - d / 1150) * HK, R(-32, 34), R(8, 13) * K, [C.olive, C.deep, C.leaf][i % 3]); }
        // низкие листья, клевер и мелкие ромашки у земли
        const LF2 = group('leaf');
        for (let i = 0; i < (small ? 5 : 8); i++) { const x = X(R(150, 520)); leaf(front, LF2, x, bh + 2, R(-160, -20), R(34, 52), R(11, 16), i % 2 ? C.leaf : C.fresh, C.deep); }
        const CL = group('bloom');
        for (let i = 0; i < (small ? 3 : 5); i++) clover(front, CL, X(R(200, 470)), bh - R(16, 30), R(9, 12), R(-25, 25));
        for (let i = 0; i < (small ? 2 : 4); i++) daisy(front, CL, X(R(240, 500)), bh - R(30, 70), R(8, 11));
      };
      meadow(1);
      meadow(-1);

      // ---------- лианы сверху ----------
      {
        const vw = 380, vh = 560;
        const tl = svg('g-tl', vw, vh);
        vine(tl, [[26, -20], [62, 70], [40, 160], [94, 250], [78, 340], [128, 420], [114, 510]], 3.4, [C.leaf, C.fresh, C.olive, C.bright], jasmine, 3);
        vine(tl, [[132, -20], [168, 60], [140, 140], [190, 220], [176, 300]], 2.8, [C.fresh, C.bright, C.leaf], cosmos, 4, 0.9);
        if (!small) vine(tl, [[232, -20], [256, 50], [236, 110], [268, 170]], 2.2, [C.bright, C.leaf], jasmine, 4, 0.8);
        const tr = svg('g-tr', vw, vh);
        vine(tr, [[354, -20], [320, 80], [340, 170], [288, 260], [306, 350], [252, 440], [266, 500]], 3.4, [C.fresh, C.leaf, C.olive, C.bright], (p, G, x, y, r) => bell(p, G, x, y, r * 1.25, R(-25, 25)), 3);
        vine(tr, [[246, -20], [214, 70], [238, 150], [200, 230], [214, 290]], 2.8, [C.leaf, C.bright, C.fresh], jasmine, 4, 0.9);
        if (!small) vine(tr, [[150, -20], [126, 50], [146, 110], [116, 160]], 2.2, [C.fresh, C.leaf], cosmos, 4, 0.8);
      }
      // ---------- лепестки, которые медленно падают ----------
      for (let i = 0; i < (small ? 4 : 7); i++) {
        const el = document.createElement('i');
        el.className = 'petal';
        el.style.cssText = `left:${(R(4, 30) + (i % 2 ? 66 : 0)).toFixed(1)}%;top:${R(-6, 30).toFixed(1)}%;--d:${R(9, 15).toFixed(1)}s;--dl:${(-R(0, 12)).toFixed(1)}s;--x:${R(-60, 60).toFixed(0)}px;--c:${[C.petal, C.blush, C.bright, '#F2C2B4'][i % 4]}`;
        host.appendChild(el);
      }
      return out;
    }

    function growGarden(host, plan) {
      if (reduce) { host.classList.add('is-alive'); return; }
      const tl = gsap.timeline({ paused: true, onComplete: () => host.classList.add('is-alive') });
      let t = { blade: 0, stem: 0.15, leaf: 0.45, bloom: 0.95 };
      plan.groups.forEach((G) => {
        if (!G.els.length) return;
        if (G.kind === 'blade') {
          gsap.set(G.els, { scaleY: 0, transformOrigin: '50% 100%' });
          tl.to(G.els, { scaleY: 1, duration: 0.9, stagger: 0.025, ease: 'power3.out' }, t.blade); t.blade += 0.12;
        } else if (G.kind === 'stem' || G.kind === 'tendril' || G.kind === 'vine') {
          G.els.forEach((e) => { const l = e.getTotalLength(); e.style.strokeDasharray = `${l} ${l}`; e.style.strokeDashoffset = l; });
          const start = G.kind === 'vine' ? 0.1 : G.kind === 'tendril' ? 1.15 : t.stem;
          tl.to(G.els, { strokeDashoffset: 0, duration: G.kind === 'vine' ? 1.8 : 1.1, stagger: 0.06, ease: G.kind === 'vine' ? 'power2.inOut' : 'power2.out' }, start);
          if (G.kind === 'stem') t.stem += 0.08;
        } else if (G.kind === 'leaf' || G.kind === 'vleaf') {
          gsap.set(G.els, { scale: 0, transformOrigin: '0% 50%' });
          const start = G.kind === 'vleaf' ? 0.25 : t.leaf;
          tl.to(G.els, { scale: 1, duration: 0.6, stagger: G.kind === 'vleaf' ? 1.6 / G.els.length : 0.035, ease: 'back.out(1.8)' }, start);
          if (G.kind === 'leaf') t.leaf += 0.1;
        } else if (G.kind === 'bloom') {
          gsap.set(G.els, { scale: 0, rotation: -50, transformOrigin: '50% 50%' });
          tl.to(G.els, { scale: 1, rotation: 0, duration: 0.8, stagger: 0.09, ease: 'back.out(2.2)' }, Math.max(1.15, t.bloom)); t.bloom += 0.1;
        }
      });
      ScrollTrigger.create({ trigger: '#pain', start: 'top 55%', once: true, onEnter: () => tl.play() });
      // покачивание только пока блок на экране
      new IntersectionObserver(([en]) => host.classList.toggle('is-paused', !en.isIntersecting)).observe(host);
    }
  }
})();
