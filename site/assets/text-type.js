// Native equivalent of the supplied TextType settings for this vanilla JS site.
export function enableTextType() {
  const node = document.querySelector('[data-text-type]');
  if (!node) return () => {};
  const output = node.querySelector('[data-text-type-output]');
  const caret = node.querySelector('.text-type__caret');
  const cursor = node.querySelector('.text-type__cursor');
  const chars = Array.from(node.dataset.textType);
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let count = 0;
  let deleting = false;
  let visible = true;
  let stopped = false;
  let timer;

  function placeCursor() {
    cursor.style.transform = `translate(${caret.offsetLeft}px, ${caret.offsetTop}px)`;
  }
  function paint() {
    output.textContent = chars.slice(0, count).join('');
    cursor.hidden = motion.matches;
    placeCursor();
  }
  function schedule() {
    clearTimeout(timer);
    if (stopped || document.hidden || !visible || motion.matches) return;
    timer = setTimeout(step, !deleting && count === chars.length ? 1500 : deleting ? 50 : 75);
  }
  function step() {
    if (!deleting && count === chars.length) deleting = true;
    count += deleting ? -1 : 1;
    if (count === 0) deleting = false;
    paint();
    schedule();
  }
  function updateMotion() {
    if (motion.matches) {
      count = chars.length;
      deleting = false;
    }
    paint();
    schedule();
  }
  let visibility;
  if (typeof IntersectionObserver !== 'undefined') {
    visibility = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      node.classList.toggle('text-type--paused', !visible);
      schedule();
    });
    visibility.observe(node);
  }
  const resize = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(placeCursor) : null;
  resize?.observe(node);
  function onVisibility() {
    node.classList.toggle('text-type--paused', document.hidden || !visible);
    schedule();
  }
  motion.addEventListener('change', updateMotion);
  document.addEventListener('visibilitychange', onVisibility);
  window.addEventListener('resize', placeCursor, { passive: true });
  updateMotion();
  return () => {
    stopped = true;
    clearTimeout(timer);
    visibility?.disconnect();
    resize?.disconnect();
    motion.removeEventListener('change', updateMotion);
    document.removeEventListener('visibilitychange', onVisibility);
    window.removeEventListener('resize', placeCursor);
    output.textContent = chars.join('');
    cursor.hidden = true;
  };
}
