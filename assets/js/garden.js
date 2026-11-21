(() => {
  const garden = document.querySelector('[data-mission-garden]');
  if (!garden || !('IntersectionObserver' in window)) return;

  const observer = new IntersectionObserver(([entry]) => {
    garden.classList.toggle('is-visible', entry.isIntersecting);
  }, { threshold: 0.15 });

  observer.observe(garden);
})();
