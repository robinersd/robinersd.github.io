// Position the persistent player without moving or recreating its audio iframe.
export function enableRobinerSpotifyPosition(dialog) {
  const mini = dialog.querySelector('.spotify-mini');
  const handle = mini.querySelector('.spotify-wave-toggle');
  let visible = false,
    saved,
    drag,
    frame = 0,
    suppressDragClick = false;
  const clamp = (value, low, high) => Math.min(Math.max(value, low), Math.max(low, high));
  const isPhone = () => document.documentElement.clientWidth <= 600;

  function bounds() {
    const viewport = window.visualViewport;
    const left = viewport?.offsetLeft || 0;
    const top = viewport?.offsetTop || 0;
    const width = Math.min(
      document.documentElement.clientWidth,
      viewport?.width || window.innerWidth,
    );
    const height = viewport?.height || window.innerHeight;
    const margin = width <= 600 ? 10 : 16;
    const playerWidth = dialog.offsetWidth;
    const playerHeight = dialog.offsetHeight;
    let minX = left + margin;
    const sidebar = document.querySelector?.('#portfolio-sidebar');
    if (sidebar && !sidebar.hidden && width >= 1024) {
      const sbRect = sidebar.getBoundingClientRect?.();
      if (sbRect && sbRect.right > left && sbRect.width > 50) {
        minX = Math.max(minX, Math.round(sbRect.right + margin));
      }
    }
    let minY = top + margin;
    const header = document.querySelector('header')?.getBoundingClientRect();
    if (header && header.bottom > top && header.top < top + height)
      minY = Math.max(minY, header.bottom + 10);
    const back = document.querySelector('.back-home')?.getBoundingClientRect();
    if (back && back.bottom > minY && back.top < top + height)
      minY = Math.max(minY, back.bottom + 10);
    const maxY = Math.max(top + margin, top + height - playerHeight - margin);
    return {
      minX,
      maxX: Math.max(minX, left + width - playerWidth - margin),
      minY: Math.min(minY, maxY),
      maxY,
      width,
      height,
      top,
      left,
      playerHeight,
    };
  }
  function write(x, y, area = bounds()) {
    dialog.classList.remove('is-spotify-edge-docked');
    x = clamp(x, area.minX, area.maxX);
    y = clamp(y, area.minY, area.maxY);
    dialog.style.setProperty('--spotify-mini-x', `${Math.round(x)}px`);
    dialog.style.setProperty('--spotify-mini-y', `${Math.round(y)}px`);
    return { x, y };
  }
  function remember(point, area) {
    saved = {
      x: area.maxX > area.minX ? (point.x - area.minX) / (area.maxX - area.minX) : 0.5,
      y: area.maxY > area.minY ? (point.y - area.minY) / (area.maxY - area.minY) : 1,
    };
  }
  function clearControls(x, y, area) {
    const main = document.querySelector('#main');
    const controls = [
      ...(main?.querySelectorAll?.('a[href], button, input, select, textarea, [role="button"]') ||
        []),
    ];
    const obstacles = controls
      .map((control) => ({ control, rect: control.getBoundingClientRect() }))
      .filter(
        ({ control, rect }) =>
          !control.disabled &&
          rect.width > 0 &&
          rect.height > 0 &&
          rect.right > x &&
          rect.left < x + dialog.offsetWidth &&
          rect.bottom > area.minY &&
          rect.top < area.top + area.height &&
          getComputedStyle(control).pointerEvents !== 'none',
      );
    let candidate = clamp(y, area.minY, area.maxY);
    for (let attempt = 0; attempt < 8; attempt++) {
      const hit = obstacles.find(
        ({ rect }) => rect.top < candidate + area.playerHeight + 6 && rect.bottom > candidate - 6,
      );
      if (!hit) return candidate;
      const above = hit.rect.top - area.playerHeight - 8;
      if (above < area.minY) break;
      candidate = above;
    }
    // Dense controls may leave no free row; keep the predictable dock and allow dragging.
    return clamp(y, area.minY, area.maxY);
  }
  function position() {
    frame = 0;
    if (!visible) return;
    // Native bottom positioning follows the mobile browser viewport without
    // chasing page buttons or rewriting pixel coordinates during scrolling.
    const docked = isPhone() && !saved && !drag?.moved;
    dialog.classList.toggle('is-spotify-edge-docked', docked);
    if (docked) return;
    const area = bounds();
    if (drag?.moved) {
      const point = write(
        drag.x + drag.latestX - drag.startX,
        drag.y + drag.latestY - drag.startY,
        area,
      );
      remember(point, area);
    } else if (saved) {
      write(
        area.minX + (area.maxX - area.minX) * saved.x,
        area.minY + (area.maxY - area.minY) * saved.y,
        area,
      );
    } else {
      // Start at the lower left edge, away from the chat launcher on the right.
      const x = area.minX;
      const y = area.maxY - 12;
      write(x, clearControls(x, y, area), area);
    }
  }
  function queue() {
    if (visible && !frame) frame = requestAnimationFrame(position);
  }
  function endDrag(event) {
    if (!drag || (event && (drag.kind !== 'pointer' || event.pointerId !== drag.id))) return;
    if (frame) {
      cancelAnimationFrame(frame);
      frame = 0;
    }
    position();
    if (drag.moved) suppressDragClick = true;
    const pointerId = drag.id;
    const kind = drag.kind;
    drag = undefined;
    mini.classList.remove('is-dragging');
    if (kind === 'pointer' && mini.hasPointerCapture(pointerId))
      mini.releasePointerCapture(pointerId);
  }
  function startDrag(x, y, id, kind) {
    if (!visible) return;
    const rect = dialog.getBoundingClientRect();
    drag = {
      id,
      kind,
      startX: x,
      startY: y,
      latestX: x,
      latestY: y,
      x: rect.left,
      y: rect.top,
      moved: false,
    };
    suppressDragClick = false;
  }
  function moveDrag(x, y) {
    if (!drag) return false;
    drag.latestX = x;
    drag.latestY = y;
    if (Math.hypot(x - drag.startX, y - drag.startY) >= 5) {
      drag.moved = true;
      mini.classList.add('is-dragging');
      queue();
    }
    return drag.moved;
  }
  mini.addEventListener('pointerdown', (event) => {
    if (
      !visible ||
      event.isPrimary === false ||
      event.pointerType === 'touch' ||
      (event.pointerType === 'mouse' && event.button !== 0)
    )
      return;
    if (!event.target.closest('.spotify-wave-toggle')) return;
    startDrag(event.clientX, event.clientY, event.pointerId, 'pointer');
  });
  mini.addEventListener('pointermove', (event) => {
    if (!drag || drag.kind !== 'pointer' || event.pointerId !== drag.id) return;
    if (!drag.moved && Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) >= 5)
      mini.setPointerCapture(event.pointerId);
    moveDrag(event.clientX, event.clientY);
  });
  // Explicit touch listeners keep the drag reliable in Android WebViews that
  // cancel pointer capture while a modeless dialog is fixed to the viewport.
  mini.addEventListener(
    'touchstart',
    (event) => {
      if (!visible || drag || !event.target.closest('.spotify-wave-toggle')) return;
      const point = event.changedTouches[0];
      if (point) startDrag(point.clientX, point.clientY, point.identifier, 'touch');
    },
    { passive: true },
  );
  mini.addEventListener(
    'touchmove',
    (event) => {
      if (!drag || drag.kind !== 'touch') return;
      const point = [...event.changedTouches].find((touch) => touch.identifier === drag.id);
      if (!point) return;
      const moved = moveDrag(point.clientX, point.clientY);
      if (moved && event.cancelable) event.preventDefault();
    },
    { passive: false },
  );
  mini.addEventListener(
    'touchend',
    (event) => {
      if (
        !drag ||
        drag.kind !== 'touch' ||
        ![...event.changedTouches].some((touch) => touch.identifier === drag.id)
      )
        return;
      endDrag();
    },
    { passive: true },
  );
  mini.addEventListener(
    'touchcancel',
    () => {
      if (drag?.kind === 'touch') endDrag();
    },
    { passive: true },
  );
  // A drag release must never pause or resume playback.
  mini.addEventListener(
    'click',
    (event) => {
      if (!suppressDragClick || event.detail === 0) return;
      suppressDragClick = false;
      event.preventDefault();
      event.stopImmediatePropagation();
    },
    true,
  );
  mini.addEventListener('pointerup', endDrag);
  mini.addEventListener('pointercancel', endDrag);
  mini.addEventListener('lostpointercapture', endDrag);
  function moveWithKeyboard(event) {
    if (!visible) return;
    if (event.key === 'Home') {
      event.preventDefault();
      saved = undefined;
      position();
      return;
    }
    const direction = {
      ArrowLeft: [-1, 0],
      ArrowRight: [1, 0],
      ArrowUp: [0, -1],
      ArrowDown: [0, 1],
    }[event.key];
    if (!direction) return;
    event.preventDefault();
    const rect = dialog.getBoundingClientRect(),
      area = bounds(),
      step = event.shiftKey ? 48 : 16;
    remember(write(rect.left + direction[0] * step, rect.top + direction[1] * step, area), area);
  }
  handle.addEventListener('keydown', moveWithKeyboard);
  const resize = () => {
    endDrag();
    queue();
  };
  window.addEventListener('resize', resize, { passive: true });
  window.addEventListener(
    'scroll',
    () => {
      if (!isPhone()) queue();
    },
    { passive: true },
  );
  window.visualViewport?.addEventListener('resize', resize, { passive: true });
  window.visualViewport?.addEventListener('scroll', queue, { passive: true });
  window.addEventListener('blur', () => endDrag());
  // A route can change at scrollY=0, so a scroll event alone is not enough.
  const main = document.querySelector('#main');
  if (main) new MutationObserver(queue).observe(main, { childList: true });

  return {
    show() {
      visible = true;
      document.documentElement.classList.add('spotify-mini-active');
      position();
    },
    hide() {
      endDrag();
      visible = false;
      if (frame) {
        cancelAnimationFrame(frame);
        frame = 0;
      }
      document.documentElement.classList.remove('spotify-mini-active');
    },
  };
}
