// Gallery owns audio only while visible. Spotify confirms silence before video sound.
export function enableGalleryVideo(spotify) {
  const root = document.querySelector('[data-pixel-gallery]');
  const video = root?.querySelector('[data-gallery-video]');
  if (!video) return () => {};
  const sound = root.querySelector('[data-gallery-sound]');
  const copies = [...(root.querySelectorAll?.('[data-gallery-video-copy]') || [])];
  const status = root.querySelector('[data-gallery-video-status]');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const lifecycle = new AbortController();
  const listen = (node, name, fn, options = {}) => node.addEventListener(name, fn, { ...options, signal: lifecycle.signal });
  let alive = true, inView = false, active = false, held = false, quiet = false;
  let wantedSound = true, userPaused = false, userStarted = false, failed = false, blocked = false;
  let revision = 0;
  let holdRevision = 0;
  const sidebar = document.querySelector('#portfolio-sidebar');
  function fitGalleryEdges() {
    const viewport = document.documentElement?.clientWidth || window.innerWidth;
    if (!viewport) return;
    const contentLeft = root.parentElement?.getBoundingClientRect().left ?? 0;
    const sidebarRight = viewport >= 700 ? (sidebar?.getBoundingClientRect?.().right || 0) : 0;
    const left = Math.max(0, Math.min(viewport - 1, sidebarRight));
    root.style.setProperty('--gallery-width', `${viewport - left}px`);
    root.style.setProperty('--gallery-shift', `${left - contentLeft}px`);
  }
  fitGalleryEdges();
  listen(window, 'resize', fitGalleryEdges, { passive: true });
  const layoutObserver = typeof ResizeObserver === 'function' ? new ResizeObserver(fitGalleryEdges) : null;
  if (root.parentElement) layoutObserver?.observe(root.parentElement);
  if (sidebar) layoutObserver?.observe(sidebar);
  video.muted = true;
  function syncCopies(force = false) {
    for (const copy of copies) {
      copy.muted = true;
      if (!active || video.paused || userPaused || reduced.matches) { copy.pause(); continue; }
      const time = Number(video.currentTime) || 0;
      if (copy.readyState >= 1 && (force || Math.abs(copy.currentTime - time) > 0.08)) {
        try { copy.currentTime = time; } catch { /* Retry after metadata arrives. */ }
      }
      if (copy.paused) Promise.resolve(copy.play()).then(() => {
        if (!alive || !active || video.paused || userPaused || reduced.matches) copy.pause();
      }).catch(() => {});
    }
  }
  function reflect() {
    const audible = active && !video.paused && !video.muted;
    sound.setAttribute('aria-label', audible ? 'Mute gallery video' : 'Enable gallery video sound');
    sound.setAttribute('aria-pressed', String(audible));
    sound.setAttribute('data-muted', String(!audible));
    sound.setAttribute('title', audible ? 'Mute sound' : 'Enable sound');
    root.dataset.videoPlaying = String(active && !video.paused && !userPaused);
    sound.disabled = failed;
    status.textContent = failed ? 'Gallery video could not load.' : blocked ? 'Tap the speaker to enable audio on this browser.' : '';
  }
  function stopVideo() {
    revision++;
    video.muted = true;
    video.pause();
    copies.forEach(copy => copy.pause());
    reflect();
  }
  async function playVideo() {
    if (!alive || !active || userPaused || failed) return;
    const stamp = ++revision;
    video.muted = !(wantedSound && quiet);
    try {
      await video.play();
      if (!alive || !active || document.hidden) { video.muted = true; video.pause(); return; }
      if (stamp !== revision) return;
      blocked = wantedSound && !quiet;
      syncCopies();
      reflect();
    } catch {
      if (!alive || !active || stamp !== revision) return;
      // Audible autoplay can be blocked even after scrolling. Keep a muted loop.
      blocked = wantedSound;
      video.muted = true;
      try { await video.play(); } catch { /* Explicit Play remains available. */ }
      if (!alive || !active || document.hidden) { video.muted = true; video.pause(); }
      if (stamp === revision) reflect();
      syncCopies();
    }
  }
  function holdMusic() {
    held = true;
    const ticket = ++holdRevision;
    const silence = spotify?.suspendForGallery?.() ?? Promise.resolve(true);
    quiet = spotify?.galleryIsSilent?.() ?? true;
    const alreadyQuiet = quiet;
    Promise.resolve(silence).then(silent => {
      if (!alive || !active || !held || ticket !== holdRevision) return;
      quiet = silent;
      if (silent && !alreadyQuiet && wantedSound && !userPaused) playVideo();
    });
  }
  function releaseMusic(resume = true) {
    if (!held) return;
    held = false;
    holdRevision++;
    quiet = false;
    spotify?.releaseGallery?.(resume);
  }
  function update() {
    if (!alive) return;
    const shouldPlay = inView && !document.hidden && !failed && (!reduced.matches || userStarted);
    if (shouldPlay === active) return;
    active = shouldPlay;
    if (active) {
      holdMusic();
      playVideo();
    } else {
      stopVideo();
      // Hidden tabs keep Spotify suspended; returning settles the audio owner.
      if (!document.hidden) releaseMusic();
    }
    if (!active && !document.hidden && !inView) releaseMusic();
  }
  const unsubscribeSilence = spotify?.onGallerySilence?.(silent => {
    quiet = silent;
    if (!silent) video.muted = true;
    reflect();
  });
  const unsubscribeTakeover = spotify?.onGalleryTakeover?.(() => {
    wantedSound = false;
    held = false;
    holdRevision++;
    quiet = false;
    video.muted = true;
    reflect();
  });
  listen(sound, 'click', () => {
    if (!video.muted && !video.paused) {
      wantedSound = false;
      video.muted = true;
      reflect();
      return;
    }
    wantedSound = true;
    userPaused = false;
    userStarted = true;
    blocked = false;
    if (!active) update();
    else { if (!held) holdMusic(); playVideo(); }
  });
  function togglePlayback() {
    if (!alive || failed) return;
    userStarted = true;
    userPaused = !video.paused;
    if (userPaused) stopVideo();
    else { if (!active) update(); else playVideo(); }
  }
  listen(root, 'keydown', event => {
    if (event.target?.closest?.('[data-gallery-video-controls]')) return;
    if (event.key === ' ') { event.preventDefault(); togglePlayback(); }
  });
  listen(video, 'timeupdate', () => syncCopies());
  listen(video, 'seeked', () => syncCopies(true));
  copies.forEach(copy => listen(copy, 'loadedmetadata', () => syncCopies(true)));
  listen(video, 'playing', () => {
    if (!active || document.hidden || userPaused) stopVideo();
    else if (!quiet || !wantedSound) video.muted = true;
    syncCopies(true);
    reflect();
  });
  listen(video, 'pause', () => { copies.forEach(copy => copy.pause()); reflect(); });
  listen(video, 'volumechange', reflect);
  listen(video, 'error', () => {
    failed = true;
    active = false;
    stopVideo();
    releaseMusic(!document.hidden);
    reflect();
  });
  listen(document, 'visibilitychange', () => {
    update();
    if (!document.hidden && !active) releaseMusic();
  });
  listen(reduced, 'change', () => { update(); syncCopies(); });
  let observer;
  if (typeof IntersectionObserver === 'function') {
    observer = new IntersectionObserver(entries => {
      const entry = entries.find(item => item.target === root);
      if (!entry) return;
      inView = entry.isIntersecting && entry.intersectionRatio >= 0.4;
      update();
    }, { threshold: [0, 0.4, 0.6] });
    observer.observe(root);
  } else {
    const measure = () => {
      const bounds = root.getBoundingClientRect();
      const visible = Math.max(0, Math.min(bounds.bottom, window.innerHeight) - Math.max(bounds.top, 0));
      inView = visible >= Math.min(bounds.height, window.innerHeight) * 0.4;
      update();
    };
    listen(window, 'scroll', measure, { passive: true });
    listen(window, 'resize', measure, { passive: true });
    measure();
  }
  reflect();
  const cleanup = () => {
    alive = false;
    active = false;
    lifecycle.abort();
    observer?.disconnect();
    layoutObserver?.disconnect();
    unsubscribeSilence?.();
    unsubscribeTakeover?.();
    stopVideo();
    releaseMusic(!document.hidden);
  };
  cleanup.togglePlayback = togglePlayback;
  return cleanup;
}
