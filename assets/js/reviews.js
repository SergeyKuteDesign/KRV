(() => {
  const rail = document.querySelector('[data-reviews-rail]');
  const track = rail.querySelector('[data-reviews-track]');
  const cards = [...track.children];
  const controls = document.querySelector('[data-reviews-controls]');
  const previous = controls.querySelector('[data-reviews-prev]');
  const next = controls.querySelector('[data-reviews-next]');
  const position = controls.querySelector('[data-reviews-position]');
  const mobile = window.matchMedia('(max-width: 767px)');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let step = 0;
  let last = 0;
  let current = 0;

  const updateControls = () => {
    const left = track.scrollLeft;
    const index = step > 0 ? Math.max(0, Math.min(cards.length - 1, Math.round(left / step))) : 0;
    rail.classList.toggle('has-prev', left > 1);
    rail.classList.toggle('has-next', last - left > 1);
    previous.disabled = left <= 1;
    next.disabled = last - left <= 1;
    if (index !== current) {
      current = index;
      position.textContent = `${current + 1} из ${cards.length}`;
    }
  };
  const measureRail = () => {
    controls.hidden = !mobile.matches;
    track.tabIndex = mobile.matches ? 0 : -1;
    step = mobile.matches ? cards[1].offsetLeft - cards[0].offsetLeft : 0;
    last = track.scrollWidth - track.clientWidth;
    updateControls();
  };
  const move = (direction) => {
    const index = Math.max(0, Math.min(cards.length - 1, current + direction));
    track.scrollTo({ left: step * index, behavior: reduceMotion.matches ? 'instant' : 'smooth' });
  };

  previous.addEventListener('click', () => move(-1));
  next.addEventListener('click', () => move(1));
  track.addEventListener('scroll', updateControls, { passive: true });
  track.addEventListener('keydown', (event) => {
    if (!mobile.matches || (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight')) return;
    event.preventDefault();
    move(event.key === 'ArrowLeft' ? -1 : 1);
  });
  mobile.addEventListener('change', measureRail);
  new ResizeObserver(measureRail).observe(track);
  measureRail();

  const sheet = document.querySelector('[data-reviews-sheet]');
  if (typeof sheet.showModal !== 'function') return;
  const open = document.querySelector('[data-reviews-open]');
  const close = sheet.querySelector('[data-reviews-close]');

  open.addEventListener('click', () => sheet.showModal());
  close.addEventListener('click', () => sheet.close());
  sheet.addEventListener('click', (event) => {
    if (event.target === sheet) sheet.close();
  });
  open.hidden = false;
})();
