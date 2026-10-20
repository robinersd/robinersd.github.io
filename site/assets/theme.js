// Circular reveal inspired by kbjacalan.vercel.app, using native view transitions.
export function enableRobinerTheme() {
  const root = document.documentElement;
  const button = document.querySelector('#theme-toggle');
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const lifecycle = new AbortController();
  let transition = null;
  let busy = false;
  let fallbackTimer;
  let origin;
  const saved = () => {
    try {
      return localStorage.getItem('theme');
    } catch {
      return null;
    }
  };
  let desired = saved() === 'light' ? 'light' : 'dark';

  function apply(theme, fade = false) {
    clearTimeout(fallbackTimer);
    root.classList.toggle('theme-changing', fade);
    root.dataset.theme = theme;
    button.setAttribute('aria-checked', String(theme === 'dark'));
    button.title = `Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`;
    document.dispatchEvent(new Event('robiner-theme-change'));
    if (fade) fallbackTimer = setTimeout(() => root.classList.remove('theme-changing'), 300);
  }

  function reveal() {
    if (busy || root.dataset.theme === desired) return;
    const next = desired;
    if (!document.startViewTransition || reduced.matches || document.hidden) {
      apply(next, !reduced.matches && !document.hidden);
      return;
    }
    const rect = button.getBoundingClientRect();
    const x = Math.max(0, Math.min(innerWidth, origin?.x ?? rect.left + rect.width / 2));
    const y = Math.max(0, Math.min(innerHeight, origin?.y ?? rect.top + rect.height / 2));
    const radius = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
    root.style.setProperty('--robiner-reveal-x', `${x}px`);
    root.style.setProperty('--robiner-reveal-y', `${y}px`);
    root.style.setProperty('--robiner-reveal-radius', `${radius}px`);
    root.classList.add('theme-reveal-active');
    busy = true;
    try {
      transition = document.startViewTransition(() => apply(next));
      // A skipped/unsupported snapshot must never leave the theme switch locked.
      transition.ready.catch(() => {});
      transition.finished
        .catch(() => {})
        .finally(() => {
          busy = false;
          transition = null;
          root.classList.remove('theme-reveal-active');
          if (root.dataset.theme !== desired) reveal();
        });
    } catch {
      busy = false;
      transition = null;
      root.classList.remove('theme-reveal-active');
      apply(next, !reduced.matches);
    }
  }

  apply(desired);
  button.addEventListener(
    'click',
    (event) => {
      desired = desired === 'dark' ? 'light' : 'dark';
      origin =
        event.detail > 0 && Number.isFinite(event.clientX) && Number.isFinite(event.clientY)
          ? { x: event.clientX, y: event.clientY }
          : null;
      try {
        localStorage.setItem('theme', desired);
      } catch {
        /* Session-only theme. */
      }
      if (busy) {
        try {
          transition?.skipTransition();
        } catch {}
      } else {
        reveal();
      }
    },
    { signal: lifecycle.signal },
  );
  reduced.addEventListener(
    'change',
    () => {
      if (reduced.matches) transition?.skipTransition();
    },
    { signal: lifecycle.signal },
  );
  return () => {
    lifecycle.abort();
    clearTimeout(fallbackTimer);
    desired = root.dataset.theme;
    transition?.skipTransition();
    root.classList.remove('theme-changing', 'theme-reveal-active');
  };
}
