// Persistent header menu; only the section links refresh on SPA navigation.
export function enableSectionTracker() {
  const main = document.querySelector('#main');
  const panel = document.querySelector('#portfolio-sidebar');
  const toggle = document.querySelector('#sidebar-toggle');
  const nav = document.querySelector('#sidebar-section-links');
  if (!main || !panel || !toggle || !nav) return () => {};
  const root = document.documentElement;
  const header = document.querySelector('header');
  const desktop = window.matchMedia('(min-width: 1024px)');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const sections = [...main.querySelectorAll('[data-scroll-section]')];
  const home = Boolean(main.querySelector('#intro[data-scroll-section]'));
  const base = window.location.pathname.startsWith('/myportfolio') ? '/myportfolio' : '';
  const labels = [
    ['intro', 'Intro'],
    ['about', 'About'],
    ['projects', 'Projects'],
    ['skills', 'Skills'],
    ['education', 'Education'],
    ['recognition', 'Recognition'],
    ['gallery', 'Gallery'],
    ['contact', 'Contact'],
  ];
  nav.replaceChildren();
  const links = labels.map(([id, label]) => {
    const link = document.createElement('a');
    link.href = `${home ? '' : base + '/'}#${id}`;
    link.dataset.sectionTarget = id;
    const text = document.createElement('span');
    text.textContent = label;
    link.append(text);
    nav.append(link);
    return link;
  });
  let frame = 0;
  let active = '';
  let stopped = false;
  let animation;
  const firstOpen = !toggle.dataset.sidebarState;
  let expanded = toggle.dataset.sidebarState
    ? toggle.dataset.sidebarState === 'open'
    : desktop.matches;
  const removeListeners = [];
  function listen(target, type, callback, options) {
    target.addEventListener(type, callback, options);
    removeListeners.push(() => target.removeEventListener(type, callback, options));
  }
  function setExpanded(value, animate = true) {
    animation?.cancel();
    animation = null;
    expanded = value;
    toggle.dataset.sidebarState = value ? 'open' : 'closed';
    toggle.setAttribute('aria-expanded', String(value));
    toggle.setAttribute('aria-label', value ? 'Close page menu' : 'Open page menu');
    panel.inert = !value;
    panel.classList.toggle('is-mobile-open', value && !desktop.matches);
    root.classList.toggle('sidebar-open', value);
    if (!animate || reducedMotion.matches || typeof panel.animate !== 'function') {
      panel.hidden = !value;
      return;
    }
    panel.hidden = false;
    // Slide through gutter so the entire panel smoothly slides from/to the left.
    const rect = panel.getBoundingClientRect();
    const distance = rect.right > 0 ? rect.right + 16 : window.innerWidth - rect.left + 12;
    const outside = { transform: `translateX(-${distance}px)`, opacity: 0 };
    const inside = { transform: 'translateX(0)', opacity: 1 };
    const running = panel.animate(value ? [outside, inside] : [inside, outside], {
      duration: 300,
      easing: 'cubic-bezier(.22,1,.36,1)',
      fill: 'both',
    });
    animation = running;
    running.finished
      .then(() => {
        if (stopped || animation !== running) return;
        panel.hidden = !expanded;
        animation = null;
        running.cancel();
      })
      .catch(() => {});
  }
  function update() {
    frame = 0;
    if (stopped || document.hidden) return;
    const headerBottom = header?.getBoundingClientRect().bottom || 72;
    panel.style.setProperty('--sidebar-top', `${Math.round(headerBottom + 12)}px`);
    let next = '';
    if (home && sections.length) {
      const readingLine = Math.min(
        window.innerHeight - 1,
        Math.max(headerBottom + 24, window.innerHeight * 0.32),
      );
      next = sections[0].id;
      for (const section of sections) {
        if (section.getBoundingClientRect().top <= readingLine) next = section.id;
      }
      if (window.scrollY + window.innerHeight >= root.scrollHeight - 4) next = sections.at(-1).id;
    } else {
      const route = window.location.pathname.replace(/\/$/, '').split('/').pop();
      next =
        { 'tech-stack': 'skills', highlights: 'recognition', certifications: 'recognition' }[
          route
        ] || route;
    }
    if (active === next) return;
    active = next;
    links.forEach((link) => {
      if (link.dataset.sectionTarget === active)
        link.setAttribute('aria-current', home ? 'location' : 'page');
      else link.removeAttribute('aria-current');
    });
    const phoneLabel = document.querySelector('[data-current-section]');
    if (phoneLabel && active) {
      const prettyName = active.charAt(0).toUpperCase() + active.slice(1);
      phoneLabel.textContent = prettyName;
    }
    const scrollContainer = panel.querySelector?.('.sidebar-scroll-content') || document.querySelector?.('.sidebar-scroll-content');
    if (scrollContainer && typeof scrollContainer.scrollTo === 'function') {
      if (active === 'intro') {
        scrollContainer.scrollTo({ top: 0, behavior: 'smooth' });
      } else {
        const activeLink = links.find((link) => link.dataset.sectionTarget === active);
        if (activeLink && typeof activeLink.offsetTop === 'number') {
          const linkTop = activeLink.offsetTop;
          const containerHeight = scrollContainer.clientHeight || 400;
          if (linkTop < (scrollContainer.scrollTop || 0) || linkTop > (scrollContainer.scrollTop || 0) + containerHeight - 60) {
            scrollContainer.scrollTo({ top: Math.max(0, linkTop - 40), behavior: 'smooth' });
          }
        }
      }
    }
  }
  function schedule() {
    if (!stopped && !document.hidden && !frame) frame = requestAnimationFrame(update);
  }
  setExpanded(expanded, firstOpen && expanded);
  listen(toggle, 'click', () => setExpanded(!expanded));
  const phoneClose = document.querySelector('#sidebar-phone-close');
  if (phoneClose) listen(phoneClose, 'click', () => setExpanded(false));
  listen(window, 'scroll', schedule, { passive: true });
  listen(window, 'resize', schedule, { passive: true });
  listen(document, 'visibilitychange', schedule);
  listen(desktop, 'change', () => {
    panel.classList.toggle('is-mobile-open', expanded && !desktop.matches);
    schedule();
  });
  listen(document, 'keydown', (event) => {
    if (
      event.key !== 'Escape' ||
      !expanded ||
      document.querySelector('dialog[open]:not(.is-spotify-mini)')
    )
      return;
    event.preventDefault();
    setExpanded(false);
    toggle.focus({ preventScroll: true });
  });
  listen(nav, 'click', (event) => {
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    )
      return;
    const link = event.target.closest?.('[data-section-target]');
    const section = sections.find((item) => item.id === link?.dataset.sectionTarget);
    if (!section || !home) return;
    event.preventDefault();
    const offset = (header?.getBoundingClientRect().bottom || 0) + 20;
    window.scrollTo({
      top: Math.max(0, window.scrollY + section.getBoundingClientRect().top - offset),
      behavior: reducedMotion.matches ? 'auto' : 'smooth',
    });
    section.setAttribute('tabindex', '-1');
    section.focus({ preventScroll: true });
  });
  const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(schedule) : null;
  observer?.observe(main);
  if (header) observer?.observe(header);
  update();
  return () => {
    stopped = true;
    animation?.cancel();
    panel.hidden = !expanded;
    if (frame) cancelAnimationFrame(frame);
    observer?.disconnect();
    removeListeners.forEach((remove) => remove());
    nav.replaceChildren();
  };
}
