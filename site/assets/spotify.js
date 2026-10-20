import { enableRobinerSpotifyPosition } from './spotify-position.js?v=mobile-wave-62';

// One persistent Spotify iframe. Minimizing changes presentation, never its DOM parent.
let spotifyApiPromise;
function loadSpotifyApi() {
  if (spotifyApiPromise) return spotifyApiPromise;
  if (window.robinerSpotifyApiReady) {
    spotifyApiPromise = window.robinerSpotifyApiReady.catch((error) => {
      spotifyApiPromise = undefined;
      throw error;
    });
    return spotifyApiPromise;
  }
  spotifyApiPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://open.spotify.com/embed/iframe-api/v1';
    script.async = true;
    let timer;
    const fail = () => {
      clearTimeout(timer);
      script.remove();
      window.onSpotifyIframeApiReady = undefined;
      reject(new Error('Spotify controls could not load'));
    };
    window.onSpotifyIframeApiReady = (api) => {
      clearTimeout(timer);
      resolve(api);
    };
    script.addEventListener('error', fail, { once: true });
    timer = setTimeout(fail, 12000);
    document.head.append(script);
  }).catch((error) => {
    spotifyApiPromise = undefined;
    throw error;
  });
  return spotifyApiPromise;
}

export function enableRobinerSpotify(playlists, defaultMusic = playlists[0]) {
  const musicQueue = Array.isArray(defaultMusic) ? defaultMusic : [defaultMusic];
  const defaultTrack = musicQueue[0];
  const supersededTracks = new Set();
  const dialog = document.querySelector('#robiner-spotify-dialog');
  if (!dialog) return;
  const choices = dialog.querySelector('.spotify-choices');
  const player = dialog.querySelector('.spotify-player');
  const mount = dialog.querySelector('.spotify-embed');
  const title = dialog.querySelector('#spotify-selected-title');
  const external = dialog.querySelector('.spotify-external');
  const mini = dialog.querySelector('.spotify-mini');
  const toggle = mini.querySelector('.spotify-wave-toggle');
  const modalClose = dialog.querySelector('.spotify-close');
  const help = dialog.querySelector('.spotify-play-help');
  const position = enableRobinerSpotifyPosition(dialog);
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let initialAutoplayPending = true;
  let opener,
    selected,
    controller,
    closing = false,
    closeTimer,
    playAttemptTimer,
    generation = 0;
  let picking = true,
    ready = false,
    paused = true,
    buffering = false,
    fallback = false,
    hasPlayed = false,
    playRequested = true,
    needsNativePlay = false,
    automaticRequest = true,
    useQueue = true,
    queueIndex = 0,
    finished = false,
    pauseRequested = false,
    lastPosition = 0,
    lastDuration = 0;

  function reflectPlayback() {
    mini.classList.toggle('is-playing', ready && !paused && !buffering);
    mini.dataset.paused = String(paused);
    // The wave stays interactive while the default music prepares.
    toggle.disabled = false;
    toggle.setAttribute('aria-busy', String(playRequested && !ready && !fallback));
    toggle.setAttribute(
      'aria-label',
      fallback || needsNativePlay
        ? 'Open Spotify playback controls'
        : playRequested && !ready && !automaticRequest
          ? 'Cancel Spotify playback request'
          : paused
            ? 'Play Spotify music'
            : 'Pause Spotify music',
    );
    toggle.title = `${selected?.title || 'Spotify'} · ${paused ? 'Tap to play' : 'Tap to pause'} · Drag to move`;
    toggle.dataset.paused = String(paused);
  }
  function updateViews() {
    choices.hidden = !picking;
    // Keep the iframe rendered even when browsing the playlist picker.
    player.hidden = !selected;
    player.classList.toggle('is-spotify-parked', picking && !!selected);
    mount.inert = picking;
    modalClose.setAttribute(
      'aria-label',
      hasPlayed ? 'Minimize Spotify player' : 'Close Spotify playlists',
    );
  }
  function releasePage() {
    document.documentElement.classList.remove('spotify-open');
    document
      .querySelectorAll('[data-spotify-open]')
      .forEach((button) => button.setAttribute('aria-expanded', 'false'));
    if (opener?.isConnected) opener.focus({ preventScroll: true });
  }
  function cancelClosing() {
    clearTimeout(closeTimer);
    closing = false;
    dialog.classList.remove('is-spotify-closing');
  }
  function minimize() {
    cancelClosing();
    // Native close/show removes modal focus trapping without removing/reloading audio.
    if (dialog.open) dialog.close();
    dialog.classList.add('is-spotify-mini');
    mount.inert = true;
    dialog.removeAttribute('aria-labelledby');
    dialog.setAttribute('aria-label', 'Spotify playback');
    dialog.show();
    dialog.scrollTop = 0;
    position.show();
    releasePage();
  }
  function finishClose() {
    cancelClosing();
    minimize();
  }
  function requestClose() {
    if (!dialog.open || closing || dialog.classList.contains('is-spotify-mini')) return;
    if (reducedMotion.matches) {
      finishClose();
      return;
    }
    closing = true;
    dialog.classList.add('is-spotify-closing');
    closeTimer = setTimeout(finishClose, 220);
  }
  function expand(showChoices = false) {
    position.hide();
    cancelClosing();
    if (dialog.open) dialog.close();
    dialog.classList.remove('is-spotify-mini');
    dialog.removeAttribute('aria-label');
    dialog.setAttribute('aria-labelledby', 'spotify-dialog-title');
    picking = showChoices || !selected;
    updateViews();
    dialog.showModal();
    dialog.scrollTop = 0;
    dialog.focus({ preventScroll: true });
    document.documentElement.classList.add('spotify-open');
    document
      .querySelectorAll('[data-spotify-open]')
      .forEach((button) => button.setAttribute('aria-expanded', 'true'));
  }
  function stopMusic() {
    initialAutoplayPending = false;
    position.hide();
    generation++;
    cancelClosing();
    try {
      controller?.pause();
      controller?.destroy();
    } catch {
      /* Removing the iframe below still stops audio. */
    }
    controller = undefined;
    selected = undefined;
    ready = false;
    paused = true;
    buffering = false;
    fallback = false;
    hasPlayed = false;
    playRequested = false;
    automaticRequest = false;
    useQueue = true;
    queueIndex = 0;
    finished = false;
    pauseRequested = false;
    lastPosition = lastDuration = 0;
    supersededTracks.clear();
    needsNativePlay = false;
    clearTimeout(playAttemptTimer);
    mount.replaceChildren();
    picking = true;
    updateViews();
    reflectPlayback();
    minimize();
  }
  function prepareFrame(frame, entity) {
    if (!frame) return;
    frame.title = `Spotify ${entity.type || 'playlist'}: ${entity.title}`;
    frame.allow = 'autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture';
    frame.allowFullscreen = true;
    frame.referrerPolicy = 'strict-origin-when-cross-origin';
  }
  function selectPlaylist(index) {
    initialAutoplayPending = false;
    useQueue = false;
    automaticRequest = false;
    return selectEntity(playlists[index]);
  }

  async function selectEntity(entity, background = false) {
    if (closing) return;
    if (!entity || !/^[A-Za-z0-9]{22}$/.test(entity.id)) return;
    const type = entity.type || 'playlist';
    if (!['track', 'playlist'].includes(type)) return;
    const uri = `spotify:${type}:${entity.id}`;
    if (!background) playRequested = false;
    picking = false;
    if (selected?.id === entity.id && selected.type === type) {
      updateViews();
      return;
    }
    if (selected?.type === 'track') supersededTracks.add(`spotify:track:${selected.id}`);
    supersededTracks.delete(uri);
    selected = { ...entity, type };
    title.textContent = entity.title;
    external.href = `https://open.spotify.com/${type}/${entity.id}`;
    ready = false;
    paused = true;
    buffering = false;
    fallback = false;
    hasPlayed = false;
    finished = false;
    pauseRequested = false;
    lastPosition = lastDuration = 0;
    needsNativePlay = false;
    clearTimeout(playAttemptTimer);
    help.textContent =
      'Press Play to listen. Tap the floating wave to pause or resume; drag it to move.';
    updateViews();
    reflectPlayback();
    if (!background) dialog.querySelector('.spotify-back').focus();
    const stamp = ++generation;
    if (controller) {
      // loadEntity reuses the same iframe and stops the previous selection.
      controller.pause();
      controller.loadEntity(uri);
      ready = true;
      reflectPlayback();
      prepareFrame(mount.querySelector('iframe'), selected);
      fulfillPlayRequest();
      return;
    }
    mount.replaceChildren();
    try {
      const api = await loadSpotifyApi();
      if (stamp !== generation || !selected) return;
      const placeholder = document.createElement('div');
      mount.append(placeholder);
      api.createController(placeholder, { width: '100%', height: 352, uri }, (created) => {
        if (stamp !== generation || !selected) {
          created.destroy();
          return;
        }
        controller = created;
        prepareFrame(mount.querySelector('iframe'), selected);
        ready = false;
        reflectPlayback();
        created.addListener('ready', () => {
          if (controller !== created) return;
          ready = true;
          reflectPlayback();
          fulfillPlayRequest();
        });
        created.addListener('playback_update', (event) => {
          if (controller !== created || !selected) return;
          const data = event.data || {};
          if (supersededTracks.has(data.playingURI)) return;
          const wasPaused = paused;
          paused = data.isPaused !== false;
          buffering = !!data.isBuffering;
          if (!paused) {
            initialAutoplayPending = false;
            if (wasPaused) pauseRequested = false;
            clearTimeout(playAttemptTimer);
            needsNativePlay = false;
          }
          reflectPlayback();
          if (!paused && !buffering) showWaveAfterPlayback();
          advanceQueueAtEnd(data);
        });
        created.addListener('playback_started', (event) => {
          if (controller !== created || !selected) return;
          if (supersededTracks.has(event?.data?.playingURI)) return;
          paused = false;
          initialAutoplayPending = false;
          buffering = false;
          pauseRequested = false;
          clearTimeout(playAttemptTimer);
          needsNativePlay = false;
          reflectPlayback();
          showWaveAfterPlayback();
        });
      });
    } catch {
      if (stamp !== generation || !selected) return;
      // Blocked external API: keep a working official embed and expose its native controls.
      mount.replaceChildren();
      const frame = document.createElement('iframe');
      frame.src = `https://open.spotify.com/embed/${type}/${entity.id}`;
      prepareFrame(frame, selected);
      mount.append(frame);
      fallback = true;
      help.textContent =
        'Use the Spotify player controls to play or pause. Minimize to keep listening.';
      reflectPlayback();
      const openControls = playRequested && !automaticRequest;
      playRequested = false;
      automaticRequest = false;
      if (openControls) expand();
    }
  }

  function fulfillPlayRequest() {
    if (!playRequested || !ready || !controller) return;
    const automatic = automaticRequest;
    playRequested = false;
    automaticRequest = false;
    requestPlayback(automatic);
    reflectPlayback();
  }

  function requestPlayback(automatic = false) {
    if (!automatic) initialAutoplayPending = false;
    pauseRequested = false;
    // PLAY initializes newly selected music; RESUME continues music that
    // has already started. Send this synchronously from a ready wave tap.
    if (hasPlayed && !finished) controller.resume();
    else controller.play();
    clearTimeout(playAttemptTimer);
    // Some browser/Spotify sessions require a tap inside the official embed.
    // Keep a usable recovery path rather than pretending sound has started.
    playAttemptTimer = setTimeout(() => {
      if (!paused || !controller || !selected) return;
      needsNativePlay = !automatic;
      help.textContent = automatic
        ? 'Tap the wave to start music on this browser.'
        : 'Press Play in the Spotify player to enable sound on this browser.';
      reflectPlayback();
    }, 6000);
  }

  function advanceQueueAtEnd(data) {
    const previousPosition = lastPosition;
    const previousDuration = lastDuration;
    const position = Number(data.position);
    const duration = Number(data.duration);
    if (!Number.isFinite(position) || !Number.isFinite(duration) || duration <= 0) return;
    lastPosition = position;
    lastDuration = duration;
    if (!useQueue || finished || !hasPlayed || pauseRequested || buffering) return;
    const atEnd = position >= duration || (paused && duration - position <= 100);
    const resetAtEnd =
      paused &&
      position === 0 &&
      previousDuration === duration &&
      previousPosition >= duration - 500;
    if (!atEnd && !resetAtEnd) return;
    finished = true;
    const next = musicQueue[queueIndex + 1];
    if (!next) return; // Stop after the requested three tracks.
    queueIndex++;
    playRequested = true;
    automaticRequest = false;
    selectEntity(next, true);
  }

  function showWaveAfterPlayback() {
    // Only the first confirmed playback shrinks the player; later track changes
    // must not dismiss a playlist chooser the visitor has deliberately reopened.
    if (hasPlayed) return;
    hasPlayed = true;
    updateViews();
    if (!picking && !dialog.classList.contains('is-spotify-mini')) minimize();
    else if (!dialog.open) minimize();
  }

  document.addEventListener('click', (event) => {
    const button = event.target.closest?.('[data-spotify-open]');
    if (!button || (dialog.open && !dialog.classList.contains('is-spotify-mini'))) return;
    initialAutoplayPending = false;
    opener = button;
    expand();
  });
  function retryInitialAutoplay(event) {
    if (!event.isTrusted || !initialAutoplayPending) return;
    if (event.type === 'mousedown' && event.button !== 0) return;
    if (
      event.type === 'keydown' &&
      (!['Enter', ' '].includes(event.key) ||
        event.repeat ||
        event.ctrlKey ||
        event.metaKey ||
        event.altKey)
    )
      return;
    // Explicit Spotify controls own their gestures. Never undo a pause, stop,
    // playlist choice, or an intentional visit to the native player controls.
    if (event.target.closest?.('#robiner-spotify-dialog, [data-spotify-open]')) return;
    if (
      !selected ||
      !paused ||
      hasPlayed ||
      fallback ||
      !dialog.classList.contains('is-spotify-mini')
    )
      return;
    // An early page tap cannot unlock an iframe that has not loaded yet.
    // Preserve the retry for the next real click/tap after readiness.
    if (!ready || !controller) return;
    initialAutoplayPending = false;
    playRequested = true;
    automaticRequest = false;
    // Send PLAY during the gesture on phones and desktops. If Spotify still
    // blocks it, the wave exposes the official player's native Play control.
    fulfillPlayRequest();
    reflectPlayback();
  }
  document.addEventListener('click', retryInitialAutoplay);
  document.addEventListener('keydown', retryInitialAutoplay);
  // A genuine left-button press also covers a desktop drag that never emits
  // click. It does not intercept dragging or react to hover/mouse movement.
  document.addEventListener('mousedown', retryInitialAutoplay, { capture: true, passive: true });
  dialog.querySelectorAll('[data-spotify-playlist]').forEach((button) => {
    button.addEventListener('click', () => selectPlaylist(Number(button.dataset.spotifyPlaylist)));
  });
  modalClose.addEventListener('click', requestClose);
  dialog.querySelector('.spotify-back').addEventListener('click', () => {
    if (closing) return;
    picking = true;
    updateViews();
    dialog.querySelector('[data-spotify-playlist]').focus();
  });
  dialog.querySelector('.spotify-stop').addEventListener('click', stopMusic);
  toggle.addEventListener('click', () => {
    initialAutoplayPending = false;
    if (fallback || needsNativePlay) {
      expand();
      return;
    }
    if (!ready || !controller) {
      // The first wave tap requests playback even if startup autoplay was
      // already queued. A second explicit tap can cancel that manual request.
      playRequested = automaticRequest || !playRequested;
      automaticRequest = false;
      if (!selected) selectEntity(defaultTrack, true);
      reflectPlayback();
      return;
    }
    if (useQueue && finished) {
      queueIndex = 0;
      playRequested = true;
      automaticRequest = false;
      selectEntity(defaultTrack, true);
      return;
    }
    // Audio status follows Spotify events. The wave remains decorative motion
    // while paused, as requested; its accessible label describes real playback.
    if (paused) requestPlayback();
    else {
      pauseRequested = true;
      controller.pause();
    }
  });
  dialog.addEventListener('animationend', (event) => {
    if (closing && event.target === dialog && event.animationName === 'robiner-spotify-out')
      finishClose();
  });
  dialog.addEventListener('cancel', (event) => {
    event.preventDefault();
    requestClose();
  });
  dialog.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && dialog.classList.contains('is-spotify-mini')) {
      // Non-modal Escape leaves background music alone; X explicitly stops it.
      event.preventDefault();
      document.querySelector('#main')?.focus({ preventScroll: true });
    }
  });
  dialog.addEventListener('close', () => {
    if (dialog.open) return; // close/show queues a close event during modal <-> mini transitions.
    cancelClosing();
    minimize();
  });
  dialog.addEventListener('click', (event) => {
    if (event.target !== dialog || dialog.classList.contains('is-spotify-mini')) return;
    const bounds = dialog.getBoundingClientRect();
    if (
      event.clientX < bounds.left ||
      event.clientX > bounds.right ||
      event.clientY < bounds.top ||
      event.clientY > bounds.bottom
    )
      requestClose();
  });
  reducedMotion.addEventListener('change', () => {
    if (reducedMotion.matches && closing) finishClose();
  });
  // Attempt playback once Spotify is ready. If the browser blocks audible
  // autoplay, the first ready page click/tap can retry; the wave also plays directly.
  reflectPlayback();
  minimize();
  selectEntity(defaultTrack, true);
}
