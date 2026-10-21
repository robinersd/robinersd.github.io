// PixelatedImageTrail supplied by the user, scoped to the gallery and adapted for touch.
export function renderPixelGallery(photos, escape) {
  const base =
    typeof window !== 'undefined' && window.location?.pathname?.startsWith('/myportfolio')
      ? '/myportfolio'
      : '';
  return `<div class="pixel-gallery-zone" data-pixel-gallery tabindex="0" role="region" aria-label="Interactive gallery image trail. Move or swipe to explore">
    <div class="pixel-gallery-backdrop" aria-hidden="true">
      <img src="${base}/assets/images/gallery/gallery-bubble-116.png" alt="Quote: With god all things are possible. Mathew 19:26" class="pixel-gallery-quote-img" loading="eager" decoding="async" />
    </div>
    <div class="pixel-gallery-layer" aria-hidden="true"></div>
  </div>
`;
}

export function enablePixelGallery(photos, { onOpen } = {}) {
  const root = document.querySelector('[data-pixel-gallery]');
  if (!root || !photos.length) return;
  const layer = root.querySelector('.pixel-gallery-layer');
  const lifecycle = new AbortController();
  const options = { signal: lifecycle.signal };
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const ready = [];
  const entries = [];
  let alive = true;
  let next = 0;
  let selected = 0;
  let frame = 0;
  let pointer = null;
  let current = null;
  let lastSpawn = null;
  let touchStart = null;
  photos.forEach((photo, index) => {
    const image = new Image();
    image.onload = () => {
      if (alive && !ready.some((item) => item.index === index)) ready.push({ ...photo, index });
    };
    image.src = photo.image;
  });
  function remove(entry) {
    clearTimeout(entry.fade);
    clearTimeout(entry.remove);
    entry.animations.forEach((animation) => animation.cancel());
    entry.element.remove();
    const index = entries.indexOf(entry);
    if (index >= 0) entries.splice(index, 1);
  }
  function clear() {
    cancelAnimationFrame(frame);
    frame = 0;
    entries.slice().forEach(remove);
    pointer = current = lastSpawn = touchStart = null;
  }
  function spawn(position) {
    if (!ready.length || document.hidden) return;
    const bounds = root.getBoundingClientRect();
    const size = Math.min(bounds.width, bounds.height, bounds.width < 600 ? 145 : 210);
    const photo = ready[next++ % ready.length];
    selected = photo.index;
    const element = document.createElement('div');
    element.className = 'pixel-trail-image';
    element.style.width = element.style.height = `${size}px`;
    element.style.left = `${Math.max(0, Math.min(bounds.width - size, position.x - size / 2))}px`;
    element.style.top = `${Math.max(0, Math.min(bounds.height - size, position.y - size / 2))}px`;
    const entry = { element, animations: [], slices: [], fade: null, remove: null };
    for (let slice = 0; slice < 5; slice++) {
      const part = document.createElement('div');
      part.className = 'pixel-trail-slice';
      part.style.backgroundImage = `url("${photo.image}")`;
      const top = slice * 20;
      const bottom = top + 20;
      const closed = `polygon(50% ${top}%, 50% ${top}%, 50% ${bottom}%, 50% ${bottom}%)`;
      const open = `polygon(0% ${top}%, 100% ${top}%, 100% ${bottom}%, 0% ${bottom}%)`;
      part.style.clipPath = open;
      element.append(part);
      entry.slices.push({ part, closed, open, slice });
      if (!reduced.matches) {
        entry.animations.push(
          part.animate([{ clipPath: closed }, { clipPath: open }], {
            duration: 280,
            delay: Math.abs(slice - 2) * 12,
            easing: 'cubic-bezier(.16,1,.3,1)',
            fill: 'both',
          }),
        );
      }
    }
    layer.append(element);
    entries.push(entry);
    const cap = bounds.width < 600 ? 6 : 14;
    while (entries.length > (reduced.matches ? 1 : cap)) remove(entries[0]);
    if (!reduced.matches) {
      const left = parseFloat(element.style.left);
      const top = parseFloat(element.style.top);
      const targetLeft = Math.max(
        0,
        Math.min(bounds.width - size, left + ((pointer?.x ?? position.x) - position.x) * 0.45),
      );
      const targetTop = Math.max(
        0,
        Math.min(bounds.height - size, top + ((pointer?.y ?? position.y) - position.y) * 0.45),
      );
      entry.animations.push(
        element.animate(
          [
            { left: `${left}px`, top: `${top}px` },
            { left: `${targetLeft}px`, top: `${targetTop}px` },
          ],
          { duration: 1300, easing: 'cubic-bezier(.16,1,.3,1)', fill: 'forwards' },
        ),
      );
      entry.fade = setTimeout(() => {
        entry.slices.forEach(({ part, closed, open, slice }) => {
          entry.animations.push(
            part.animate([{ clipPath: open }, { clipPath: closed }], {
              duration: 620,
              delay: Math.abs(slice - 2) * 9,
              easing: 'cubic-bezier(.16,1,.3,1)',
              fill: 'forwards',
            }),
          );
        });
        entry.animations.push(
          element.animate(
            [
              { opacity: 1, transform: 'scale(1)' },
              { opacity: 0, transform: 'scale(.24)' },
            ],
            { duration: 620, easing: 'cubic-bezier(.16,1,.3,1)', fill: 'forwards' },
          ),
        );
        entry.remove = setTimeout(() => remove(entry), 640);
      }, 1500);
    }
  }
  function move() {
    frame = 0;
    if (!pointer || document.hidden) return;
    current.x += (pointer.x - current.x) * 0.32;
    current.y += (pointer.y - current.y) * 0.32;
    if (!lastSpawn || Math.hypot(current.x - lastSpawn.x, current.y - lastSpawn.y) > 32) {
      spawn(current);
      lastSpawn = { ...current };
    }
    if (Math.hypot(pointer.x - current.x, pointer.y - current.y) > 0.5)
      frame = requestAnimationFrame(move);
  }
  function update(event, immediate = false) {
    const bounds = root.getBoundingClientRect();
    pointer = {
      x: Math.max(0, Math.min(bounds.width, event.clientX - bounds.left)),
      y: Math.max(0, Math.min(bounds.height, event.clientY - bounds.top)),
    };
    if (!current || immediate) {
      current = { ...pointer };
      spawn(current);
      lastSpawn = { ...current };
    }
    if (!frame && !reduced.matches) frame = requestAnimationFrame(move);
  }
  root.addEventListener(
    'pointerenter',
    (event) => {
      if (event.pointerType === 'mouse') update(event, true);
    },
    options,
  );
  root.addEventListener(
    'pointerdown',
    (event) => {
      touchStart = { x: event.clientX, y: event.clientY };
      update(event, true);
    },
    {
      ...options,
      passive: true,
    },
  );
  root.addEventListener('pointermove', (event) => update(event), { ...options, passive: true });
  function leave() {
    cancelAnimationFrame(frame);
    frame = 0;
    pointer = current = lastSpawn = null;
  }
  root.addEventListener(
    'pointerup',
    (event) => {
      if (touchStart && Math.hypot(event.clientX - touchStart.x, event.clientY - touchStart.y) <= 8)
        onOpen?.(selected, root);
      touchStart = null;
    },
    options,
  );
  root.addEventListener('pointerleave', leave, options);
  root.addEventListener('pointercancel', leave, options);
  root.addEventListener(
    'keydown',
    (event) => {
      if (['ArrowLeft', 'ArrowRight'].includes(event.key)) {
        event.preventDefault();
        next += event.key === 'ArrowRight' ? 1 : Math.max(1, ready.length - 1);
        const bounds = root.getBoundingClientRect();
        spawn({ x: bounds.width / 2, y: bounds.height / 2 });
      } else if (event.key === 'Enter') onOpen?.(selected, root);
    },
    options,
  );
  document.addEventListener(
    'visibilitychange',
    () => {
      if (document.hidden) clear();
    },
    options,
  );
  reduced.addEventListener('change', clear, options);
  return () => {
    alive = false;
    lifecycle.abort();
    clear();
  };
}
