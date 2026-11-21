/* =========================================================
   Что поесть — interactions v3
   GSAP + ScrollTrigger. Сцены на position: sticky,
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
  const desktop = matchMedia(DESK);
  const isDesk = () => desktop.matches;
  const INK = '#1D1B14', PAPER = '#FFFDF6';

  typograph(document.body);

  if (!window.gsap || !window.ScrollTrigger) { root.classList.remove('js'); root.classList.add('no-loader'); return; }
  try {
    root.classList.add('js');
    gsap.registerPlugin(ScrollTrigger);
    ScrollTrigger.config({ ignoreMobileResize: true });
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

  function initRibbons() {
    const section = $('[data-ribbons]');
    if (!section || !window.IntersectionObserver) return;
    const video = $('video', section);
    const motion = matchMedia('(prefers-reduced-motion: reduce)');
    let visible = false;

    function syncPlayback() {
      if (!visible || document.hidden || motion.matches || navigator.connection?.saveData) {
        video.pause();
        return;
      }
      if (!video.hasAttribute('src')) video.src = video.dataset.src;
      if (video.paused) video.play().catch(() => {});
    }

    new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting && entry.intersectionRatio >= .08;
      syncPlayback();
    }, { threshold: .08 }).observe(section);
    video.addEventListener('playing', () => video.classList.add('is-playing'), { once: true });
    video.addEventListener('error', () => video.classList.remove('is-playing'));
    document.addEventListener('visibilitychange', syncPlayback);
    if (motion.addEventListener) motion.addEventListener('change', syncPlayback);
  }

  function init() {
    let locks = 0;
    const lock = () => { if (++locks === 1) document.body.classList.add('is-locked'); };
    const unlock = () => { if (locks > 0 && --locks === 0) document.body.classList.remove('is-locked'); };

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

    const heroStage = $('[data-hero-sticky]');
    const viewport = window.visualViewport;
    const H = { W: 0, H: 0, cardW: 0, cardH: 0, cy: 0, dist: 1, ctaY: 0, dockH: 60 };
    const floatDir = [[-1, -0.6, -14], [-1, 0.6, 12], [1, -0.6, 12], [1, 0.6, -12]];
    const floatSpeed = [1.25, 1.55, 1.1, 1.45];
    const mobileFloats = [0, 3];
    let dockGap = 0;
    let dockInset = 0;
    let dockPosition = '';
    let lastHeroProgress = -1;
    let heroFrame = 0;
    let videoInView = false;

    function syncVideo() {
      if (!introDone || !videoInView || document.hidden || reduce || navigator.connection?.saveData) {
        video.pause();
        return;
      }
      if (!video.getAttribute('src')) video.src = isDesk() ? 'assets/video/hero-wide.mp4' : 'assets/video/hero-640.mp4';
      if (video.paused) video.play().catch(() => {});
    }

    video.addEventListener('playing', () => video.classList.add('is-playing'));
    new IntersectionObserver(([entry]) => {
      videoInView = entry.isIntersecting;
      syncVideo();
    }, { threshold: 0.05 }).observe(media);
    document.addEventListener('visibilitychange', syncVideo);

    function measureHero() {
      H.W = heroStage.clientWidth;
      H.H = heroStage.clientHeight;
      if (isDesk()) {
        H.cardH = Math.min(H.H * 0.46, (H.W * 0.56) / 1.9);
        H.cardW = H.cardH * 1.9;
        H.cy = H.H * 0.51;
        H.dist = H.H * 1.55;
      } else {
        H.cardW = H.W * 0.82;
        H.cardH = Math.min(H.H * 0.52, H.cardW * 1.25);
        H.cy = H.H * 0.53;
        H.dist = H.H * 1.15;
      }
      H.dockH = dock.offsetHeight;
      H.ctaY = ctaSlot.offsetTop;
      dockInset = parseFloat(getComputedStyle(dock).bottom) - dockGap;
      lastHeroProgress = -1;
    }

    function positionDock() {
      const layoutHeight = root.clientHeight;
      // Fixed positioning follows the layout viewport. Browser bars can leave a
      // shorter visual viewport without changing the stable hero scene size.
      const nextGap = viewport && viewport.scale === 1
        ? Math.max(0, layoutHeight - viewport.height - viewport.offsetTop) : 0;
      if (Math.abs(nextGap - dockGap) > 0.5) {
        dockGap = nextGap;
        dock.style.setProperty('--dock-viewport-gap', `${dockGap}px`);
      }

      let offset = 0;
      if (heroP < 0.76) {
        const yDock = layoutHeight - H.dockH - dockInset - dockGap;
        const yCta = Math.min(H.ctaY, yDock);
        if (reduce) {
          offset = scrollY < 24 ? yCta - yDock : 0;
        } else {
          const yCard = H.cy - H.dockH / 2;
          const toCard = easeIO(clamp(heroP / 0.42));
          const toBottom = easeIO(clamp((heroP - 0.5) / 0.26));
          const y = heroP < 0.5 ? lerp(yCta, yCard, toCard) : lerp(yCard, yDock, toBottom);
          offset = Math.min(0, y - yDock);
        }
      }
      const value = `${offset.toFixed(1)}px`;
      if (value !== dockPosition) {
        dockPosition = value;
        dock.style.setProperty('--dock-shift', value);
      }
    }

    function renderHero() {
      heroFrame = 0;
      const P = heroP;
      if (introDone) positionDock();
      if (!reduce && P !== lastHeroProgress) {
        lastHeroProgress = P;
        const { W, H: height, cardW, cardH, cy } = H;
        const shape = easeIO(clamp(P / 0.42));
        const exit = easeIO(clamp((P - 0.5) / 0.46));
        const side = lerp(0, (W - cardW) / 2, shape).toFixed(1);
        media.style.clipPath = P === 0 ? '' : `inset(${lerp(0, cy - cardH / 2, shape).toFixed(1)}px ${side}px ${lerp(0, height - cy - cardH / 2, shape).toFixed(1)}px round ${lerp(0, 28, shape).toFixed(1)}px)`;
        media.style.transform = `translate3d(0, ${(-exit * (cy + cardH / 2 + 40)).toFixed(1)}px, 0)`;
        media.style.visibility = exit >= 1 ? 'hidden' : 'visible';
        shade.style.opacity = lerp(1, 0.35, shape).toFixed(3);

        const fade = clamp(P / 0.18);
        content.style.opacity = (1 - fade).toFixed(3);
        content.style.transform = `translate3d(0, ${(-30 * fade).toFixed(1)}px, 0)`;
        content.style.visibility = fade >= 1 ? 'hidden' : 'visible';

        floats.forEach((el, i) => {
          if (!isDesk() && !mobileFloats.includes(i)) return;
          const appear = easeOut(clamp((P - 0.1 - i * 0.045) / 0.3));
          const [dx, dy, rot] = floatDir[i];
          const x = (1 - appear) * dx * W * 0.32;
          const y = (1 - appear) * dy * height * 0.25 - exit * height * floatSpeed[i];
          el.style.opacity = appear.toFixed(3);
          el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) rotate(${((1 - appear) * rot).toFixed(2)}deg)`;
        });
      }
    }
    const queueHero = () => { if (!heroFrame) heroFrame = requestAnimationFrame(renderHero); };

    measureHero();
    if (reduce) window.addEventListener('scroll', queueHero, { passive: true });
    else ScrollTrigger.create({
      trigger: hero, start: 'top top', end: () => '+=' + Math.round(H.dist),
      onUpdate: (self) => { heroP = self.progress; queueHero(); },
      onRefresh: (self) => { measureHero(); heroP = self.progress; queueHero(); },
    });

    new ResizeObserver(() => { measureHero(); queueHero(); }).observe(heroStage);
    document.fonts?.ready.then(() => { measureHero(); queueHero(); });
    // Both events matter when the mobile browser changes chrome and offset in
    // separate frames. They only update the dock, never the scroll timeline.
    viewport?.addEventListener('resize', queueHero, { passive: true });
    viewport?.addEventListener('scroll', queueHero, { passive: true });
    window.addEventListener('resize', queueHero, { passive: true });

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
        .fromTo(accessInner.children, { y: 12, opacity: 0 }, { y: 0, opacity: 1, duration: 0.35, stagger: 0.03, ease: 'power2.out', clearProps: 'transform,opacity' }, 0.2);
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
          dock.focus({ preventScroll: true });
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
      gsap.fromTo(menuKids(), { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.35, stagger: 0.03, ease: 'power2.out', delay: 0.08, clearProps: 'transform,opacity' });
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
    const goTo = (target) => {
      const top = target === hero ? 0 : target.getBoundingClientRect().top + scrollY;
      window.scrollTo({ top, behavior: reduce ? 'instant' : 'smooth' });
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

    /* ---------- Заставка ---------- */
    const loader = $('[data-loader]');
    if (reduce || root.classList.contains('no-loader')) {
      loader.remove();
      requestAnimationFrame(heroIntro);
    } else {
      lock();
      gsap.delayedCall(0.53, () => {
        gsap.set(loader, { pointerEvents: 'none' });
        unlock();
        gsap.to(loader, { opacity: 0, duration: 0.28, ease: 'power2.out', onComplete: () => loader.remove() });
        heroIntro();
      });
    }

    function heroIntro() {
      measureHero();
      introDone = true;
      renderHero();
      syncVideo();
      dock.classList.add('is-ready');
      setupScroll();
      ScrollTrigger.refresh();
      if (!reduce && heroP < 0.06) {
        gsap.fromTo('[data-intro]', { opacity: 0.72, y: 12 }, {
          opacity: 1, y: 0, duration: 0.46, stagger: 0.06, ease: 'power2.out', clearProps: 'transform,opacity',
        });
      }
    }

    /* ---------- Калорийность и фото рациона ---------- */
    const switcher = $('.kcal__switch');
    const options = $$('button', switcher);
    const frame = $('[data-kcal-frame]');
    const caption = $('[data-kcal-caption]');
    let activeOption = options.find((button) => button.getAttribute('aria-selected') === 'true');
    let requestedOption = activeOption;
    let request = 0;
    let activePhoto = $('img', frame);
    const photos = new Map([[activeOption.dataset.k, activePhoto]]);
    const movePill = () => {
      switcher.style.setProperty('--pill-x', activeOption.offsetLeft + 'px');
      switcher.style.setProperty('--pill-w', activeOption.offsetWidth + 'px');
    };
    new ResizeObserver(movePill).observe(switcher);
    movePill();

    async function selectRation(button) {
      if (button === requestedOption) return;
      requestedOption = button;
      const currentRequest = ++request;
      if (button === activeOption) {
        frame.removeAttribute('aria-busy');
        return;
      }

      const kcal = button.dataset.k;
      let photo = photos.get(kcal);
      if (!photo) {
        photo = new Image(900, 1125);
        photo.alt = `Рацион на ${kcal} ккал в контейнерах`;
        photo.src = `assets/img/ration-${kcal}.webp`;
        photos.set(kcal, photo);
      }

      frame.setAttribute('aria-busy', 'true');
      try {
        await photo.decode();
      } catch {
        photos.delete(kcal);
        if (currentRequest === request) {
          requestedOption = activeOption;
          frame.removeAttribute('aria-busy');
        }
        return;
      }
      if (currentRequest !== request) return;
      gsap.killTweensOf(activePhoto);
      activePhoto.replaceWith(photo);
      activePhoto = photo;
      activeOption = button;
      options.forEach((option) => {
        const selected = option === button;
        option.classList.toggle('on', selected);
        option.setAttribute('aria-selected', String(selected));
        option.tabIndex = selected ? 0 : -1;
      });
      frame.setAttribute('aria-labelledby', button.id);
      caption.textContent = `${kcal} ккал в день`;
      frame.removeAttribute('aria-busy');
      movePill();
      if (!reduce) gsap.fromTo(photo, { opacity: 0.72 }, { opacity: 1, duration: 0.28, clearProps: 'opacity' });
    }

    options.forEach((button) => button.addEventListener('click', () => selectRation(button)));
    switcher.addEventListener('keydown', (event) => {
      const index = options.indexOf(event.target);
      if (index < 0) return;
      const next = { ArrowLeft: (index + options.length - 1) % options.length, ArrowRight: (index + 1) % options.length, Home: 0, End: options.length - 1 }[event.key];
      if (next === undefined) return;
      event.preventDefault();
      options[next].focus();
      selectRation(options[next]);
    });

    /* ---------- RIBBONS ---------- */
    initRibbons();

    /* ---------- Фото рядом со списком ---------- */
    const insidePreview = $('[data-inside-preview]');
    const insideItems = $$('[data-menu-list] li');
    const pointer = matchMedia('(hover: hover) and (min-width: 768px)');
    let previewRequest = 0;
    insideItems.forEach((item) => item.addEventListener('pointerenter', async () => {
      if (!pointer.matches) return;
      const currentRequest = ++previewRequest;
      const active = $('img', insidePreview);
      if (active.getAttribute('src') === item.dataset.img) return;
      const photo = new Image(720, 1280);
      photo.alt = '';
      photo.src = item.dataset.img;
      try { await photo.decode(); } catch { return; }
      if (currentRequest !== previewRequest) return;
      active.replaceWith(photo);
      if (!reduce) gsap.fromTo(photo, { opacity: 0.7 }, { opacity: 1, duration: 0.22 });
    }));

    /* ---------- Края горизонтальных списков ---------- */
    const mobile = matchMedia(MOB);
    $$('[data-card-rail]').forEach((rail) => {
      const track = $('[data-rail-track]', rail);
      const update = () => {
        const overflow = track.scrollWidth - track.clientWidth;
        rail.classList.toggle('has-prev', mobile.matches && track.scrollLeft > 2);
        rail.classList.toggle('has-next', mobile.matches && overflow - track.scrollLeft > 2);
        track.tabIndex = mobile.matches && overflow > 2 ? 0 : -1;
      };
      track.addEventListener('scroll', update, { passive: true });
      new ResizeObserver(update).observe(track);
      mobile.addEventListener('change', update);
      update();
    });

    /* ---------- PRICING: вкладки на телефоне ---------- */
    const tabs = $$('[data-plan-tab]');
    const plans = $$('[data-plan]');
    tabs.forEach((b) => b.addEventListener('click', () => {
      const i = +b.dataset.planTab;
      tabs.forEach((x) => { x.classList.toggle('on', x === b); x.setAttribute('aria-selected', String(x === b)); });
      plans.forEach((p, k) => p.classList.toggle('is-active', k === i));
      if (!reduce) gsap.fromTo(plans[i], { opacity: 0.8, y: 8 }, { opacity: 1, y: 0, duration: 0.28, ease: 'power2.out', clearProps: 'opacity,transform' });
    }));

    /* =====================================================
       Скролл-сцены (все на scrub/toggle → работают в обе стороны)
       ===================================================== */
    function setupScroll() {
      let lastNavScroll = scrollY;
      const updateNav = () => {
        const y = scrollY;
        if (Math.abs(y - lastNavScroll) < 7 && y > 80) return;
        nav.classList.toggle('is-hidden', !menuOpen && y > 140 && y > lastNavScroll && !nav.contains(document.activeElement));
        lastNavScroll = y;
      };
      window.addEventListener('scroll', updateNav, { passive: true });
      if (reduce) return;

      const mm = gsap.matchMedia();
      const reveal = (elements, trigger, start = 'top 85%') => {
        if (!elements.length) return;
        gsap.fromTo(elements, { opacity: 0.72, y: 14 }, {
          opacity: 1, y: 0, duration: 0.44, stagger: 0.05, ease: 'power2.out',
          scrollTrigger: { trigger, start, once: true },
        });
      };
      // A covered section stays legible until most of it has left the screen.
      const layer = (target, next) => {
        gsap.fromTo(target, { scale: 1, opacity: 1 }, {
          scale: 0.975, opacity: 0.94, ease: 'none',
          scrollTrigger: { trigger: next, start: 'top 42%', end: 'top top', scrub: true },
        });
      };

      layer('[data-statement]', '#pain');
      reveal($$('[data-reveal]', $('#pain')), '#pain');
      layer('.mission__sticky', '#how');

      const stepsSec = $('[data-steps]');
      const stepsStage = $('.steps__sticky', stepsSec);
      const steps = $$('[data-step]', stepsSec);
      const images = $$('[data-step-img]', stepsSec);
      const bars = $$('[data-step-bar]', stepsSec);
      const number = $('[data-step-num]', stepsSec);
      let currentStep = 0;
      let stepSize = 1;
      function showStep(index) {
        if (index === currentStep) return;
        const direction = index > currentStep ? 1 : -1;
        currentStep = index;
        gsap.killTweensOf([...steps, ...images, number]);
        gsap.set([...steps, ...images], { clearProps: 'transform,opacity' });
        steps.forEach((step, i) => step.classList.toggle('is-active', i === index));
        images.forEach((photo, i) => photo.classList.toggle('is-active', i === index));
        gsap.fromTo(steps[index], { opacity: 0.72, y: direction * 10 }, {
          opacity: 1, y: 0, duration: 0.27, ease: 'power2.out', clearProps: 'opacity,transform',
        });
        gsap.fromTo(images[index], { opacity: 0.7 }, { opacity: 1, duration: 0.28, clearProps: 'opacity' });
        number.textContent = String(index + 1).padStart(2, '0');
        gsap.fromTo(number, { yPercent: direction * 45 }, { yPercent: 0, duration: 0.27, ease: 'power2.out' });
      }
      function updateSteps(self) {
        const progress = clamp((self.scroll() - self.start) / stepSize);
        bars.forEach((bar, i) => bar.style.setProperty('--p', clamp(progress * steps.length - i).toFixed(3)));
        showStep(clamp(Math.floor(progress * steps.length), 0, steps.length - 1));
      }
      ScrollTrigger.create({
        trigger: stepsSec, start: 'top top', end: () => {
          stepSize = Math.max(1, stepsSec.offsetHeight - 2 * stepsStage.offsetHeight);
          return '+=' + stepSize;
        },
        onRefresh: updateSteps,
        onUpdate: updateSteps,
      });
      layer('.steps__sticky', '#why');

      mm.add(DESK, () => {
        const panels = $$('[data-why-panel]');
        panels.slice(1).forEach((panel, i) => layer($('.why__box', panels[i]), panel));
      });
      reveal($$('[data-reveal]', $('#why')), '#why');
      reveal($$('[data-reveal]', $('#kcal')), '#kcal');
      reveal($$('[data-reveal]', $('#inside')), '#inside');
      reveal($$('[data-reveal]', $('#about')), '#about');
      layer('.about__sticky', '#reviews');

      /* REVIEWS: карточки проходят поверх закреплённого заголовка */
      mm.add(DESK, () => {
        $$('.rv__item').forEach((item) => {
          const card = $('.rv__card', item);
          gsap.timeline({ scrollTrigger: { trigger: item, start: 'top 100%', end: 'bottom top', scrub: true } })
            .fromTo(card, { opacity: .45, y: 38 }, { opacity: 1, y: 0, duration: .18, ease: 'power2.out' })
            .to(card, { duration: .68 })
            .to(card, { opacity: .5, y: -24, duration: .14, ease: 'power2.in' });
        });
      });

      reveal($$('[data-reveal]', $('#pricing')), '#pricing');
      reveal($$('[data-reveal]', $('#faq')), '#faq');
      layer('.faq__sticky', '.final');
      reveal($$('[data-reveal]', $('.final')), '.final');
    }

  }
})();
