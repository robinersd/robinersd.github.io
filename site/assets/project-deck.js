// Three desktop columns, with the existing spotlight deck on smaller screens.
export function enableRobinerProjectDeck() {
  const lifecycle = new AbortController();
  const options = { signal: lifecycle.signal };
  const restore = [];
  const desktop = window.matchMedia('(min-width: 900px)');

  document.querySelectorAll('[data-project-deck]').forEach((shell) => {
    const grid = shell.querySelector('.project-grid');
    const cards = [...grid.querySelectorAll('.project-card')];
    if (cards.length !== 3) return;
    const names = cards.map((card) => card.querySelector('h3').textContent);
    const isSiteLink = cards.map((card) => Boolean(card.getAttribute('href')));
    const cardLabels = cards.map((card) => card.getAttribute('aria-label'));

    const linkTabs = new Map(
      cards.flatMap((card) =>
        [...card.querySelectorAll('a')].map((link) => [link, link.getAttribute('tabindex')]),
      ),
    );
    const slots = ['center', 'left', 'right'];
    let selected = 0;
    let lastTap = null;
    let gesture = null;
    let blockClickUntil = 0;

    function paint() {
      grid.classList.remove(desktop.matches ? 'project-deck' : 'project-desktop');
      grid.classList.add(desktop.matches ? 'project-desktop' : 'project-deck');
      cards.forEach((card, index) => {
        if (desktop.matches) {
          card.removeAttribute('data-deck-slot');
          card.removeAttribute('tabindex');
          if (!isSiteLink[index]) card.removeAttribute('aria-label');
          card.classList.remove('is-deck-pressed');
        } else {
          card.tabIndex = 0;
          card.dataset.deckSlot = slots[index];
          if (!isSiteLink[index])
            card.setAttribute(
              'aria-label',
              `${names[index]}${index === selected ? ', selected project' : ', select to bring forward'}`,
            );
        }
        card.querySelectorAll('a').forEach((link) => {
          if (!desktop.matches && index !== selected) link.setAttribute('tabindex', '-1');
          else if (linkTabs.get(link) === null) link.removeAttribute('tabindex');
          else link.setAttribute('tabindex', linkTabs.get(link));
        });
      });
    }
    function select(index, focus = false) {
      if (index !== selected) {
        lastTap = null;
        [slots[selected], slots[index]] = [slots[index], slots[selected]];
        selected = index;
        paint();
      }
      if (focus) cards[selected].focus({ preventScroll: true });
    }

    cards.forEach((card, index) => {
      card.tabIndex = 0;
      if (!isSiteLink[index]) card.setAttribute('role', 'group');
      card.setAttribute('aria-roledescription', 'project card');
      card.addEventListener(
        'click',
        (event) => {
          if (desktop.matches) return;
          // Keyboard-generated clicks retain native link activation.
          if (event.detail === 0 && isSiteLink[index]) return;
          if (performance.now() < blockClickUntil) {
            event.preventDefault();
            return;
          }
          if (
            event.button !== 0 ||
            event.metaKey ||
            event.ctrlKey ||
            event.shiftKey ||
            event.altKey
          )
            return;
          const now = performance.now();
          if (
            isSiteLink[index] &&
            index === selected &&
            lastTap?.index === index &&
            now - lastTap.time <= 450
          ) {
            lastTap = null;
            return;
          }
          event.preventDefault();
          select(index);
          lastTap = isSiteLink[index] ? { index, time: now } : null;
        },
        options,
      );
      card.addEventListener(
        'keydown',
        (event) => {
          if (desktop.matches || isSiteLink[index]) return;
          if (event.target !== card || !['Enter', ' '].includes(event.key)) return;
          event.preventDefault();
          select(index);
        },
        options,
      );
      card.addEventListener(
        'pointerdown',
        (event) => {
          if (event.button === 0 && (desktop.matches || event.pointerType !== 'mouse'))
            card.classList.add('is-deck-pressed');
        },
        { ...options, passive: true },
      );
    });
    function rotate(direction) {
      const next =
        direction === 'left'
          ? { center: 'left', left: 'right', right: 'center' }
          : { center: 'right', right: 'left', left: 'center' };
      slots.forEach((slot, index) => {
        slots[index] = next[slot];
      });
      selected = slots.indexOf('center');
      lastTap = null;
      paint();
    }
    function cancelGesture() {
      if (gesture) blockClickUntil = performance.now() + 500;
      gesture = null;
      lastTap = null;
    }
    grid.addEventListener(
      'pointerdown',
      (event) => {
        if (desktop.matches || event.pointerType !== 'touch') return;
        if (event.isPrimary === false) {
          cancelGesture();
          return;
        }
        blockClickUntil = 0;
        gesture = { id: event.pointerId, x: event.clientX, y: event.clientY, horizontal: false };
      },
      { ...options, passive: true },
    );
    grid.addEventListener(
      'pointermove',
      (event) => {
        if (!gesture || event.pointerId !== gesture.id) return;
        const dx = event.clientX - gesture.x;
        const dy = event.clientY - gesture.y;
        if (!gesture.horizontal && Math.abs(dy) > 12 && Math.abs(dy) > Math.abs(dx)) {
          cancelGesture();
          return;
        }
        if (Math.abs(dx) > 12 && Math.abs(dx) > Math.abs(dy) * 1.25) {
          gesture.horizontal = true;
          lastTap = null;
          if (event.cancelable) event.preventDefault();
          if (!grid.hasPointerCapture?.(event.pointerId)) grid.setPointerCapture?.(event.pointerId);
        }
      },
      options,
    );
    document.addEventListener(
      'pointerup',
      (event) => {
        if (!gesture || event.pointerId !== gesture.id) return;
        const dx = event.clientX - gesture.x;
        const dy = event.clientY - gesture.y;
        const moved = Math.max(Math.abs(dx), Math.abs(dy)) > 12;
        gesture = null;
        if (moved) {
          blockClickUntil = performance.now() + 500;
          lastTap = null;
        }
        if (!desktop.matches && Math.abs(dx) >= 44 && Math.abs(dx) > Math.abs(dy) * 1.25)
          rotate(dx < 0 ? 'left' : 'right');
      },
      { ...options, passive: true },
    );
    document.addEventListener('pointercancel', cancelGesture, { ...options, passive: true });
    shell.addEventListener(
      'keydown',
      (event) => {
        if (desktop.matches) return;
        if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
        lastTap = null;
        event.preventDefault();
        const index =
          event.key === 'Home'
            ? 0
            : event.key === 'End'
              ? cards.length - 1
              : (selected + (event.key === 'ArrowRight' ? 1 : -1) + cards.length) % cards.length;
        select(index, true);
      },
      options,
    );
    function release() {
      cards.forEach((card) => card.classList.remove('is-deck-pressed'));
    }
    document.addEventListener('pointerup', release, { ...options, passive: true });
    document.addEventListener('pointercancel', release, { ...options, passive: true });
    window.addEventListener('scroll', release, { ...options, passive: true });
    window.addEventListener('scroll', cancelGesture, { ...options, passive: true });
    window.addEventListener('blur', release, options);
    window.addEventListener('blur', cancelGesture, options);
    paint();
    desktop.addEventListener(
      'change',
      () => {
        cancelGesture();
        blockClickUntil = 0;
        paint();
      },
      options,
    );
    restore.push(() => {
      grid.classList.remove('project-deck');
      grid.classList.remove('project-desktop');
      cards.forEach((card, index) => {
        card.removeAttribute('data-deck-slot');
        card.removeAttribute('tabindex');
        card.removeAttribute('role');
        card.removeAttribute('aria-roledescription');
        if (cardLabels[index] === null) card.removeAttribute('aria-label');
        else card.setAttribute('aria-label', cardLabels[index]);
        card.classList.remove('is-deck-pressed');
      });
      linkTabs.forEach((value, link) =>
        value === null ? link.removeAttribute('tabindex') : link.setAttribute('tabindex', value),
      );
    });
  });
  return () => {
    lifecycle.abort();
    restore.forEach((cleanup) => cleanup());
  };
}
