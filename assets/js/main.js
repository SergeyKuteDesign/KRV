/* =========================================================
   Что поесть — interactions v3
   GSAP + ScrollTrigger + Lenis. Сцены на position: sticky,
   все эффекты привязаны к прогрессу скролла → работают в обе стороны.
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
        if (!p || p.closest('script, style, textarea, svg, code, pre')) return NodeFilter.FILTER_REJECT;
        return /\S/.test(n.nodeValue) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
      },
    });
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach((n) => {
      const t = n.nodeValue.replace(reAfter, '$1$2 ').replace(reAfter, '$1$2 ')
        .replace(reParticle, ' $1').replace(reDash, ' $1').replace(reNum, '$1 ');
      if (t !== n.nodeValue) n.nodeValue = t;
    });
    $$('h1, h2, h3', scope).forEach((h) => {
      const texts = [];
      const w = document.createTreeWalker(h, NodeFilter.SHOW_TEXT);
      while (w.nextNode()) if (/\S/.test(w.currentNode.nodeValue)) texts.push(w.currentNode);
      const last = texts[texts.length - 1];
      if (!last) return;
      const v = last.nodeValue.replace(/\s+$/, '');
      const i = v.lastIndexOf(' ');
      const tail = v.slice(i + 1);
      // клеим только короткое последнее слово, чтобы строка могла переноситься
      if (i > 0 && tail.length <= 9 && !tail.includes(' ')) last.nodeValue = v.slice(0, i) + ' ' + tail + last.nodeValue.slice(v.length);
    });
  }

  function init() {
    /* ---------- smooth scroll ---------- */
    let lenis = null;
    if (!reduce && window.Lenis) {
      lenis = new Lenis({ lerp: 0.11, smoothWheel: true });
      lenis.on('scroll', ScrollTrigger.update);
      gsap.ticker.add((t) => lenis.raf(t * 1000));
      gsap.ticker.lagSmoothing(0);
    }
    let locks = 0;
    const lock = () => { if (++locks === 1) { if (lenis) lenis.stop(); document.body.classList.add('is-locked'); } };
    const unlock = () => { if (locks > 0 && --locks === 0) { if (lenis) lenis.start(); document.body.classList.remove('is-locked'); } };

    const nav = $('[data-nav]');
    const burger = $('[data-menu-open]');
    const menu = $('[data-menu]');
    const scrim = $('[data-scrim]');
    const dock = $('[data-dock]');
    const access = $('[data-access]');
    const accessInner = $('[data-access-inner]');
    const hero = $('[data-hero]');
    const media = $('[data-hero-media]');
    const video = $('[data-hero-video]');
    const shade = $('[data-hero-shade]');
    const content = $('[data-hero-content]');
    const ctaSlot = $('[data-cta-slot]');
    const floats = $$('[data-float]');
    let menuOpen = false, accessOpen = false, heroP = 0, introDone = false;

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
       HERO-сцена: видео → карточка → текст позади
       ===================================================== */
    const safeProbe = document.createElement('div');
    safeProbe.style.cssText = 'position:fixed;left:0;bottom:0;width:0;height:env(safe-area-inset-bottom);visibility:hidden;pointer-events:none';
    document.body.appendChild(safeProbe);
    const H = { W: 0, H: 0, cardW: 0, cardH: 0, cy: 0, dist: 1, ctaY: 0, dockH: 60, safe: 0 };
    const floatDir = [[-1, -0.6, -14], [-1, 0.6, 12], [1, -0.6, 12], [1, 0.6, -12]];
    const floatSpeed = [1.25, 1.55, 1.1, 1.45];
    const measureHero = () => {
      H.W = innerWidth; H.H = innerHeight;
      if (isDesk()) { H.cardH = Math.min(H.H * 0.46, (H.W * 0.56) / 1.9); H.cardW = H.cardH * 1.9; H.cy = H.H * 0.51; H.dist = H.H * 2.4; }
      else { H.cardW = H.W * 0.84; H.cardH = Math.min(H.H * 0.54, H.cardW * 1.3); H.cy = H.H * 0.5; H.dist = H.H * 1.8; }
      H.dockH = dock.offsetHeight || 60;
      H.safe = safeProbe.offsetHeight;
      // слот лежит в .hero__content (inset: 0 в sticky-кадре) → offsetTop = позиция на экране, без учёта анимаций
      H.ctaY = ctaSlot.offsetTop;
    };

    const dockAt = (y) => { dock.style.transform = `translate3d(-50%, ${y.toFixed(1)}px, 0)`; };
    const renderHero = () => {
      const P = heroP;
      const { W, cardW, cardH, cy } = H;
      const Hh = H.H;
      const s = easeIO(clamp(P / 0.42));
      const f = easeIO(clamp((P - 0.5) / 0.46));
      // карточка
      const topIn = lerp(0, cy - cardH / 2, s), botIn = lerp(0, Hh - cy - cardH / 2, s), sideIn = lerp(0, (W - cardW) / 2, s);
      media.style.clipPath = `inset(${topIn.toFixed(1)}px ${sideIn.toFixed(1)}px ${botIn.toFixed(1)}px ${sideIn.toFixed(1)}px round ${lerp(0, 28, s).toFixed(1)}px)`;
      media.style.transform = `translate3d(0, ${(-f * (cy + cardH / 2 + 40)).toFixed(1)}px, 0)`;
      shade.style.opacity = lerp(1, 0.35, s).toFixed(3);
      // текст hero уходит
      const c = clamp(P / 0.16);
      content.style.opacity = (1 - c).toFixed(3);
      content.style.transform = `translate3d(0, ${(-50 * clamp(P / 0.24)).toFixed(1)}px, 0)`;
      content.style.visibility = c >= 1 ? 'hidden' : 'visible';
      // элементы по бокам
      floats.forEach((el, i) => {
        if (el.offsetParent === null) return;
        const e = easeOut(clamp((P - 0.1 - i * 0.045) / 0.3));
        const [dx, dy, rot] = floatDir[i];
        const x = (1 - e) * dx * W * 0.32;
        const y = (1 - e) * dy * Hh * 0.25 - f * Hh * floatSpeed[i];
        el.style.opacity = e.toFixed(3);
        el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) rotate(${((1 - e) * rot).toFixed(2)}deg)`;
      });
      // кнопка: под текстом → центр карточки → низ экрана
      if (introDone) {
        const yCta = H.ctaY, yCard = cy - H.dockH / 2, yDock = Hh - H.dockH - 16 - H.safe;
        const d = easeIO(clamp((P - 0.5) / 0.2));
        dockAt(P < 0.5 ? lerp(yCta, yCard, s) : lerp(yCard, yDock, d));
      }
    };
    measureHero(); renderHero();
    const heroST = ScrollTrigger.create({
      trigger: hero, start: 'top top', end: () => '+=' + Math.round(H.dist),
      onUpdate: (self) => { heroP = self.progress; renderHero(); },
      onRefresh: (self) => { measureHero(); heroP = self.progress; renderHero(); },
    });
    window.addEventListener('resize', () => { measureHero(); renderHero(); });
    new IntersectionObserver(([en]) => (en.isIntersecting ? playVideo() : video.pause()), { rootMargin: '0px' }).observe(media);

    /* ---------- scrim / lock helpers ---------- */
    const showScrim = () => { scrim.hidden = false; gsap.to(scrim, { opacity: 1, duration: 0.4, overwrite: true }); };
    const hideScrim = () => gsap.to(scrim, { opacity: 0, duration: 0.35, overwrite: true, onComplete: () => { if (!menuOpen && !accessOpen) scrim.hidden = true; } });
    scrim.addEventListener('click', () => { closeMenu(); closeAccess(); });

    /* =====================================================
       Виджет доступа: кнопка «раскрывается» в карточку (iOS)
       ===================================================== */
    const radii = (r) => `${r}px ${r}px ${r}px ${r}px`;
    function openAccess() {
      if (accessOpen) return;
      if (menuOpen) closeMenu();
      accessOpen = true; lock();
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
        .fromTo(accessInner.children, { y: 16, filter: 'blur(6px)' }, { y: 0, filter: 'blur(0px)', duration: 0.6, stagger: 0.04, ease: 'power3.out', clearProps: 'filter' }, 0.2);
      setTimeout(() => $('.sheet__close', access).focus({ preventScroll: true }), 400);
    }
    function closeAccess(mode) {
      if (!accessOpen) return Promise.resolve();
      accessOpen = false;
      dock.setAttribute('aria-expanded', 'false');
      return new Promise((res) => {
        const finish = () => {
          access.hidden = true;
          access.classList.remove('is-morph');
          gsap.set(access, { clearProps: 'all' });
          gsap.set(accessInner, { clearProps: 'all' });
          accessInner.style.width = '';
          dock.classList.remove('is-morph');
          hideScrim(); unlock(); res();
        };
        gsap.killTweensOf([access, accessInner]);
        if (mode === 'slide') { gsap.to(access, { y: '100%', duration: 0.4, ease: 'power3.in', onComplete: finish }); return; }
        const r1 = access.getBoundingClientRect();
        const r0 = dock.getBoundingClientRect();
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
      menuOpen = true;
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
      gsap.fromTo(menuKids(), { opacity: 0, y: 20, filter: 'blur(8px)' }, { opacity: 1, y: 0, filter: 'blur(0px)', duration: 0.7, stagger: 0.04, ease: 'power3.out', delay: 0.1, clearProps: 'filter' });
    }
    function closeMenu(mode) {
      if (!menuOpen) return Promise.resolve();
      menuOpen = false;
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
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { closeMenu(); closeAccess(); } });

    /* ---------- боттом-шиты: свайп вниз ---------- */
    function draggable(sheet, close) {
      const handle = $('[data-drag-handle]', sheet);
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

    /* ---------- якоря ---------- */
    const goTo = (t) => {
      if (t === hero) { if (lenis) lenis.scrollTo(0, { duration: 1.6 }); else window.scrollTo({ top: 0, behavior: 'smooth' }); return; }
      // для секций-слоёв докручиваем до момента, когда слой полностью наехал
      const layered = t.matches('.mission, .steps, .why, .reviews, .final');
      const y = t.getBoundingClientRect().top + (lenis ? lenis.scroll : scrollY) + (layered ? 0 : 0);
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
      Promise.all([closeMenu(), closeAccess()]).then(() => goTo(t));
    });

    /* =====================================================
       Прелоадер (≥ 2 с): надпись пишется от руки
       ===================================================== */
    const loader = $('[data-loader]');
    const lpath = $('[data-loader-path]');
    const lbar = $('[data-loader-bar]');
    lock();
    gsap.to(lpath, { strokeDashoffset: 0, duration: reduce ? 0.01 : 1.7, ease: 'power2.inOut', delay: 0.15 });
    gsap.to('.loader__hint', { opacity: 1, duration: 0.6, delay: 0.7 });
    const lp = gsap.to(lbar, { scaleX: 0.85, duration: 1.9, ease: 'power2.out' });
    const fontsReady = document.fonts ? document.fonts.ready : Promise.resolve();
    const posterReady = new Promise((res) => { const i = new Image(); i.onload = i.onerror = res; i.src = video.poster; });
    const assetsReady = Promise.race([Promise.all([fontsReady, posterReady, videoReady]), new Promise((r) => setTimeout(r, 5000))]);
    Promise.all([assetsReady, new Promise((r) => setTimeout(r, reduce ? 500 : 2200))]).then(() => {
      lp.kill();
      gsap.to(lbar, { scaleX: 1, duration: 0.35, ease: 'power2.inOut', onComplete: exitLoader });
    });
    function exitLoader() {
      gsap.timeline({ onComplete: () => loader.remove() })
        .to('.loader__inner', { y: -30, opacity: 0, duration: 0.5, ease: 'power2.in' }, 0)
        .to(loader, { clipPath: 'inset(0% 0% 100% 0%)', duration: 1, ease: 'expo.inOut' }, 0.2)
        .add(heroIntro, 0.45);
    }
    function heroIntro() {
      playVideo();
      measureHero();
      introDone = true;
      renderHero();
      gsap.timeline()
        .add(() => { unlock(); setupScroll(); ScrollTrigger.refresh(); }, 0.6)
        .fromTo(video, { scale: 1.12 }, { scale: 1, duration: 2, ease: 'expo.out', clearProps: 'transform' }, 0)
        .fromTo('[data-intro]', { opacity: 0, y: 30, filter: 'blur(12px)' }, { opacity: 1, y: 0, filter: 'blur(0px)', duration: 1.3, stagger: 0.12, ease: 'expo.out', clearProps: 'filter' }, 0.1)
        .add(() => dock.classList.add('is-ready'), 0.5);
    }

    /* ---------- KCAL ---------- */
    const sw = $('.kcal__switch');
    const swBtns = $$('button', sw);
    const frame = $('[data-kcal-frame]');
    const movePill = (b) => { sw.style.setProperty('--pill-x', b.offsetLeft + 'px'); sw.style.setProperty('--pill-w', b.offsetWidth + 'px'); };
    const curBtn = () => swBtns.find((b) => b.classList.contains('on'));
    movePill(curBtn());
    window.addEventListener('resize', () => movePill(curBtn()));
    if (document.fonts) document.fonts.ready.then(() => movePill(curBtn()));
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
        gsap.fromTo(img, { clipPath: 'inset(100% 0% 0% 0%)', scale: 1.15 }, { clipPath: 'inset(0% 0% 0% 0%)', scale: 1, duration: 1.05, ease: 'expo.inOut', onComplete: () => $$('img', frame).forEach((x) => x !== img && x.remove()) });
      };
      (img.decode ? img.decode() : Promise.resolve()).then(show, show);
    }));

    /* ---------- RIBBONS: готовые картинки, едет только transform ---------- */
    // в картинке 6 периодов волны; фраза повторяется каждые m периодов, трек = 2 копии картинки
    const ribbonTweens = $$('[data-ribbon]').map((track) => {
      const dir = +track.dataset.ribbon;
      const shift = (+track.dataset.m / 12) * 100; // % ширины трека
      return gsap.fromTo(track, { xPercent: dir > 0 ? 0 : -shift }, { xPercent: dir > 0 ? -shift : 0, duration: +track.dataset.m * 13, ease: 'none', repeat: -1, paused: true });
    });
    let ribbonsOn = false, ribbonSpeed = 1;
    new IntersectionObserver(([en]) => {
      ribbonsOn = en.isIntersecting;
      if (!reduce) ribbonTweens.forEach((t) => (ribbonsOn ? t.play() : t.pause()));
    }).observe($('[data-ribbons]'));
    if (!reduce && lenis) gsap.ticker.add(() => {
      if (!ribbonsOn) return;
      const target = 1 + Math.min(Math.abs(lenis.velocity) * 0.06, 2.5);
      ribbonSpeed += (target - ribbonSpeed) * 0.08;
      ribbonTweens.forEach((t) => t.timeScale(ribbonSpeed));
    });

    /* ---------- INSIDE: фото за курсором ---------- */
    const list = $('[data-menu-list]');
    const ci = $('[data-cursor-img]');
    if (list && ci && matchMedia('(hover: hover) and (min-width: 768px)').matches) {
      const cimg = $('img', ci);
      let mx = 0, my = 0, cx = 0, cy = 0, on = false;
      list.addEventListener('mousemove', (e) => { mx = e.clientX; my = e.clientY; if (!on) { cx = mx; cy = my; } });
      $$('li', list).forEach((li) => li.addEventListener('mouseenter', () => { if (cimg.getAttribute('src') !== li.dataset.img) cimg.src = li.dataset.img; ci.classList.add('is-on'); on = true; }));
      list.addEventListener('mouseleave', () => { ci.classList.remove('is-on'); on = false; });
      gsap.ticker.add(() => {
        if (!on && !ci.classList.contains('is-on')) return;
        cx += (mx - cx) * 0.14; cy += (my - cy) * 0.14;
        ci.style.transform = `translate3d(${cx + 34}px, ${cy - 150}px, 0) rotate(${clamp((mx - cx) * 0.12, -14, 14)}deg)`;
      });
    }

    /* ---------- PRICING: вкладки на телефоне ---------- */
    const tabs = $$('[data-plan-tab]');
    const plans = $$('[data-plan]');
    tabs.forEach((b) => b.addEventListener('click', () => {
      const i = +b.dataset.planTab;
      tabs.forEach((x) => { x.classList.toggle('on', x === b); x.setAttribute('aria-selected', String(x === b)); });
      plans.forEach((p, k) => p.classList.toggle('is-active', k === i));
      gsap.fromTo(plans[i], { opacity: 0, y: 18, filter: 'blur(8px)' }, { opacity: 1, y: 0, filter: 'blur(0px)', duration: 0.6, ease: 'expo.out', clearProps: 'filter' });
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
          gsap.fromTo(a, { height: 0 }, { height: 'auto', duration: 0.6, ease: 'expo.out', onComplete: () => { a.style.height = ''; } });
        }
      });
    });

    /* =====================================================
       Скролл-сцены (все на scrub/toggle → работают в обе стороны)
       ===================================================== */
    function setupScroll() {
      const mm = gsap.matchMedia();
      const rev = { toggleActions: 'play none none reverse' };
      const reveal = (els, trigger, start = 'top 72%') => {
        if (!els.length) return;
        gsap.fromTo(els, { opacity: 0, y: 30, filter: 'blur(10px)' }, { opacity: 1, y: 0, filter: 'blur(0px)', duration: 1.1, stagger: 0.08, ease: 'expo.out', scrollTrigger: { trigger, start, ...rev } });
      };
      // наслаивание: уходящий слой уменьшается и размывается
      const layer = (target, next) => {
        gsap.fromTo(target, { scale: 1, opacity: 1, filter: 'blur(0px)' }, {
          scale: 0.92, opacity: 0.45, filter: 'blur(8px)', ease: 'none',
          scrollTrigger: { trigger: next, start: 'top bottom', end: 'top top', scrub: true },
        });
      };

      layer('[data-statement]', '#pain');
      reveal($$('[data-reveal]', $('#pain')), '#pain', 'top 60%');
      const herbs = $('[data-herbs]');
      if (herbs) {
        const parts = drawHerbs(herbs);
        gsap.set(parts.stems, { strokeDasharray: (i, el) => el.getTotalLength(), strokeDashoffset: (i, el) => el.getTotalLength() });
        gsap.set(parts.dots, { scale: 0, transformOrigin: '50% 50%' });
        gsap.timeline({ scrollTrigger: { trigger: '#pain', start: 'top 45%', ...rev } })
          .to(parts.stems, { strokeDashoffset: 0, duration: 1.8, stagger: 0.03, ease: 'power2.out' })
          .to(parts.dots, { scale: 1, duration: 0.6, stagger: 0.008, ease: 'back.out(2)' }, 0.7);
      }
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
        steps.forEach((s, k) => { if (k !== prev && k !== i) { s.classList.remove('is-active'); gsap.set(s, { clearProps: 'all' }); } });
        gsap.to(out, { opacity: 0, y: dir > 0 ? -36 : 36, filter: 'blur(12px)', duration: 0.45, ease: 'power2.in', onComplete: () => { out.classList.remove('is-active'); gsap.set(out, { clearProps: 'all' }); } });
        inn.classList.add('is-active');
        gsap.set(inn, { opacity: 1, y: 0, filter: 'none' });
        gsap.fromTo(inn.children, { opacity: 0, y: dir > 0 ? 46 : -46, filter: 'blur(16px)' }, { opacity: 1, y: 0, filter: 'blur(0px)', duration: 1, stagger: 0.09, ease: 'expo.out', delay: 0.24, clearProps: 'filter' });
        const of = simgs[prev], nf = simgs[i];
        simgs.forEach((f, k) => { if (k !== prev && k !== i) { gsap.killTweensOf(f); gsap.set(f, { opacity: 0, zIndex: 0, clearProps: 'clipPath' }); } });
        gsap.killTweensOf([of, nf, $('img', of), $('img', nf)]);
        gsap.set(of, { zIndex: 1, opacity: 1 }); gsap.set(nf, { zIndex: 2, opacity: 1 });
        gsap.fromTo(nf, { clipPath: dir > 0 ? 'inset(100% 0% 0% 0%)' : 'inset(0% 0% 100% 0%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: 1.1, ease: 'expo.inOut' });
        gsap.fromTo($('img', nf), { scale: 1.18 }, { scale: 1, duration: 1.5, ease: 'expo.out' });
        gsap.to($('img', of), { scale: 1.06, duration: 1.1, ease: 'expo.inOut', onComplete: () => { gsap.set(of, { opacity: 0, zIndex: 0 }); gsap.set($('img', of), { scale: 1 }); } });
        num.textContent = String(i + 1).padStart(2, '0');
        gsap.fromTo(num, { yPercent: dir > 0 ? 100 : -100 }, { yPercent: 0, duration: 0.7, ease: 'expo.out' });
      };
      ScrollTrigger.create({
        trigger: stepsSec, start: 'top top', end: () => '+=' + Math.round(innerHeight * (isDesk() ? 3 : 1.6)),
        onUpdate: (self) => {
          const p = self.progress;
          bars.forEach((b, k) => b.style.setProperty('--p', clamp(p * 4 - k).toFixed(3)));
          const i = clamp(Math.floor(p * 4), 0, 3);
          if (i !== cur) showStep(i, i > cur ? 1 : -1);
        },
      });
      layer('.steps__sticky', '#why');

      /* WHY: панели наслаиваются друг на друга (десктоп) */
      mm.add(DESK, () => {
        const panels = $$('[data-why-panel]');
        panels.forEach((p, i) => {
          if (!i) return;
          gsap.fromTo($('.why__box', panels[i - 1]), { scale: 1, filter: 'blur(0px)', opacity: 1 }, {
            scale: 0.9, filter: 'blur(8px)', opacity: 0.6, ease: 'none',
            scrollTrigger: { trigger: p, start: 'top bottom', end: 'top top', scrub: true },
          });
          gsap.fromTo($$('.why__copy > *, .why__img', p), { opacity: 0, y: 50 }, { opacity: 1, y: 0, stagger: 0.06, ease: 'none', scrollTrigger: { trigger: p, start: 'top 85%', end: 'top 15%', scrub: true } });
        });
        reveal($$('[data-reveal]', $('#why')), '#why', 'top 55%');
      });
      mm.add(MOB, () => {
        reveal([...$$('[data-reveal]', $('#why')), ...$$('.why__track .why__panel')], '#why', 'top 60%');
      });

      /* KCAL / INSIDE */
      reveal($$('[data-reveal]', $('#kcal')), '#kcal');
      gsap.fromTo('.kcal__frame', { clipPath: 'inset(14% 14% 14% 14% round 26px)' }, { clipPath: 'inset(0% 0% 0% 0% round 26px)', duration: 1.4, ease: 'expo.out', scrollTrigger: { trigger: '#kcal', start: 'top 65%', ...rev } });
      gsap.fromTo('.ribbons__track', { opacity: 0 }, { opacity: 1, duration: 1, ease: 'power2.out', scrollTrigger: { trigger: '.ribbons', start: 'top 85%', ...rev } });
      reveal($$('[data-reveal]', $('#inside')), '#inside');
      reveal($$('.menu-list li'), '.menu-list', 'top 82%');

      /* ABOUT → на него наезжают отзывы */
      reveal($$('[data-reveal]', $('#about')), '#about', 'top 60%');
      gsap.fromTo('.about__photo', { clipPath: 'inset(100% 0% 0% 0% round 999px 999px 24px 24px)' }, { clipPath: 'inset(0% 0% 0% 0% round 999px 999px 24px 24px)', duration: 1.6, ease: 'expo.inOut', scrollTrigger: { trigger: '#about', start: 'top 60%', ...rev } });
      $$('[data-count]').forEach((el) => {
        const end = +el.dataset.count;
        const fmt = (v) => (el.dataset.format === 'space' ? Math.round(v).toLocaleString('ru-RU').replace(/\s/g, ' ') : Math.round(v));
        const o = { v: 0 };
        ScrollTrigger.create({ trigger: '#about', start: 'top 50%', onEnter: () => gsap.to(o, { v: end, duration: 1.8, ease: 'power3.out', onUpdate: () => (el.textContent = fmt(o.v)) }) });
      });
      layer('.about__sticky', '#reviews');

      /* REVIEWS: карточки проплывают поверх заголовка, тают у верхнего края */
      mm.add(DESK, () => {
        gsap.fromTo('.reviews__titlebox', { opacity: 0, y: 40, filter: 'blur(12px)' }, { opacity: 1, y: 0, filter: 'blur(0px)', duration: 1.2, ease: 'expo.out', scrollTrigger: { trigger: '#reviews', start: 'top 40%', ...rev } });
        $$('.rv__item').forEach((it) => {
          gsap.timeline({ scrollTrigger: { trigger: it, start: 'top bottom', end: 'bottom top', scrub: true } })
            .fromTo(it, { opacity: 0, y: 120, scale: 0.92, filter: 'blur(10px)' }, { opacity: 1, y: 0, scale: 1, filter: 'blur(0px)', duration: 0.28, ease: 'power2.out' })
            .to(it, { duration: 0.44 })
            .to(it, { opacity: 0, y: -60, scale: 0.9, filter: 'blur(8px)', duration: 0.28, ease: 'power2.in' });
        });
      });
      mm.add(MOB, () => reveal([...$$('.reviews__titlebox > *'), ...$$('.rv__item').slice(0, 3)], '#reviews', 'top 60%'));

      /* PRICING */
      reveal($$('[data-reveal]', $('#pricing')), '#pricing');
      gsap.fromTo('.pricing__bg img', { yPercent: -6 }, { yPercent: 6, ease: 'none', scrollTrigger: { trigger: '#pricing', start: 'top bottom', end: 'bottom top', scrub: true } });
      gsap.fromTo('[data-plan], .plans-tabs', { opacity: 0, y: 60, filter: 'blur(12px)' }, { opacity: 1, y: 0, filter: 'blur(0px)', duration: 1.2, stagger: 0.12, ease: 'expo.out', scrollTrigger: { trigger: '.plans', start: 'top 88%', ...rev } });

      /* FAQ → финал наезжает */
      reveal([...$$('[data-reveal]', $('#faq')), ...$$('[data-faq] details')], '#faq', 'top 60%');
      layer('.faq__sticky', '.final');
      reveal($$('[data-reveal]', $('.final')), '.final', 'top 55%');

      /* шапка прячется при скролле вниз */
      ScrollTrigger.create({ start: 0, end: 'max', onUpdate: (self) => { if (menuOpen) return; nav.classList.toggle('is-hidden', self.direction === 1 && self.scroll() > 200); } });
    }

    /* травы в блоке «Дело не в силе воли» */
    function drawHerbs(svg) {
      const NS = 'http://www.w3.org/2000/svg';
      const W = 1440, Hh = 300;
      svg.setAttribute('viewBox', `0 0 ${W} ${Hh}`);
      svg.setAttribute('preserveAspectRatio', 'xMidYMax slice');
      let seed = 11;
      const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
      const mk = (t, a) => { const e = document.createElementNS(NS, t); for (const k in a) e.setAttribute(k, a[k]); return e; };
      const stems = [], dots = [];
      [24, 70, 118, 170, 214, 262, 1180, 1226, 1270, 1318, 1366, 1414].forEach((x0, idx) => {
        const h = 110 + rnd() * 170, lean = (rnd() - 0.5) * 90;
        const x1 = x0 + lean * 0.35, y1 = Hh - h * 0.55, x2 = x0 + lean, y2 = Hh - h;
        const stem = mk('path', { d: `M${x0},${Hh + 4} Q${x1.toFixed(1)},${y1.toFixed(1)} ${x2.toFixed(1)},${y2.toFixed(1)}`, class: 'stem' });
        svg.appendChild(stem); stems.push(stem);
        const n = 3 + Math.floor(rnd() * 4);
        for (let i = 1; i <= n; i++) {
          const t = i / (n + 1.4);
          const px = (1 - t) * (1 - t) * x0 + 2 * (1 - t) * t * x1 + t * t * x2;
          const py = (1 - t) * (1 - t) * (Hh + 4) + 2 * (1 - t) * t * y1 + t * t * y2;
          const side = i % 2 ? 1 : -1;
          const ang = (-90 + side * (38 + rnd() * 26)) * Math.PI / 180;
          const L = 12 + rnd() * 14, w = 3.4 + rnd() * 2;
          const tx = px + Math.cos(ang) * L, ty = py + Math.sin(ang) * L;
          const mx = (px + tx) / 2, my = (py + ty) / 2, nx = -Math.sin(ang) * w, ny = Math.cos(ang) * w;
          const leaf = mk('path', { d: `M${px.toFixed(1)},${py.toFixed(1)} Q${(mx + nx).toFixed(1)},${(my + ny).toFixed(1)} ${tx.toFixed(1)},${ty.toFixed(1)} Q${(mx - nx).toFixed(1)},${(my - ny).toFixed(1)} ${px.toFixed(1)},${py.toFixed(1)}Z`, class: 'leaf' });
          svg.appendChild(leaf); dots.push(leaf);
        }
        if (idx % 2 === 0) {
          const k = 7 + Math.floor(rnd() * 4);
          for (let j = 0; j < k; j++) {
            const a = -Math.PI / 2 + (j - (k - 1) / 2) * 0.3;
            const r = 16 + rnd() * 12;
            const bx = x2 + Math.cos(a) * r, by = y2 + Math.sin(a) * r;
            const ray = mk('path', { d: `M${x2.toFixed(1)},${y2.toFixed(1)} L${bx.toFixed(1)},${by.toFixed(1)}`, class: 'stem' });
            svg.appendChild(ray); stems.push(ray);
            const bud = mk('circle', { cx: bx.toFixed(1), cy: by.toFixed(1), r: (2.2 + rnd() * 1.4).toFixed(1), class: 'bud' });
            svg.appendChild(bud); dots.push(bud);
          }
        }
      });
      return { stems, dots };
    }
  }
})();
