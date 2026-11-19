import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import { spotifyQueue } from '../site/assets/data.js';

class Element {
  constructor() {
    this.listeners = new Map();
    this.nodes = new Map();
    this.attrs = new Map();
    this.styles = new Map();
    this.children = [];
    this.dataset = {};
    const classes = new Set();
    this.classList = {
      add: (name) => classes.add(name),
      remove: (name) => classes.delete(name),
      contains: (name) => classes.has(name),
      toggle: (name, force) => (force ? classes.add(name) : classes.delete(name)),
    };
    this.style = { setProperty: (name, value) => this.styles.set(name, value) };
    this.offsetWidth = 52;
    this.offsetHeight = 44;
    this.isConnected = true;
  }
  addEventListener(type, callback, options) {
    const listeners = this.listeners.get(type) || [];
    listeners.push({ callback, capture: options === true });
    this.listeners.set(type, listeners);
  }
  async emit(type, props = {}) {
    let stopped = false;
    const event = {
      target: this,
      detail: 1,
      preventDefault() {
        this.defaultPrevented = true;
      },
      stopImmediatePropagation() {
        stopped = true;
      },
      ...props,
    };
    const listeners = [...(this.listeners.get(type) || [])].sort((a, b) => b.capture - a.capture);
    for (const { callback } of listeners) {
      await callback(event);
      if (stopped) break;
    }
    return event;
  }
  querySelector(selector) {
    return this.nodes.get(selector) || null;
  }
  querySelectorAll() {
    return [];
  }
  setAttribute(name, value) {
    this.attrs.set(name, value);
  }
  removeAttribute(name) {
    this.attrs.delete(name);
  }
  focus() {}
  append(child) {
    this.children.push(child);
  }
  replaceChildren(...children) {
    this.children = children;
  }
  remove() {}
  show() {
    this.open = true;
    this.modal = false;
  }
  showModal() {
    this.open = true;
    this.modal = true;
  }
  close() {
    this.open = false; /* Native close events are queued, not synchronous. */
  }
  getBoundingClientRect() {
    const docked = this.classList.contains('is-spotify-edge-docked');
    const left = docked ? 10 : parseFloat(this.styles.get('--spotify-mini-x')) || 0;
    const top = docked
      ? (this.viewport.visualViewport?.height || this.viewport.innerHeight) - 44 - 22
      : parseFloat(this.styles.get('--spotify-mini-y')) || 0;
    return { left, top, right: left + 52, bottom: top + 44, width: 52, height: 44 };
  }
  setPointerCapture(id) {
    this.capture = id;
  }
  hasPointerCapture(id) {
    return this.capture === id;
  }
  releasePointerCapture() {
    this.capture = undefined;
  }
}

async function load(file, env, exportName) {
  const source = (await fs.readFile(new URL(`../site/assets/${file}`, import.meta.url), 'utf8'))
    .replace(/^import[^;]+;\s*/gm, '')
    .replaceAll('export function', 'function');
  const context = vm.createContext(env);
  vm.runInContext(source + `\nglobalThis.result = ${exportName};`, context);
  return context.result;
}

test('music attempts autoplay, handles blocked playback and advances the requested queue in order', async () => {
  const doc = new Element();
  const win = new Element();
  const dialog = new Element();
  const mini = new Element();
  const toggle = new Element();
  mini.nodes.set('.spotify-wave-toggle', toggle);
  const selectors = [
    '.spotify-choices',
    '.spotify-player',
    '.spotify-embed',
    '#spotify-selected-title',
    '.spotify-external',
    '.spotify-close',
    '.spotify-play-help',
    '.spotify-back',
    '.spotify-stop',
    '[data-spotify-playlist]',
  ];
  selectors.forEach((selector) => dialog.nodes.set(selector, new Element()));
  dialog.nodes.set('.spotify-mini', mini);
  const playlists = [new Element(), new Element()];
  playlists.forEach((button, index) => {
    button.dataset.spotifyPlaylist = String(index);
  });
  dialog.querySelectorAll = () => playlists;
  doc.querySelector = () => dialog;
  doc.querySelectorAll = () => [];
  doc.documentElement = new Element();
  doc.createElement = () => new Element();
  doc.head = new Element();
  let duplicateBootstraps = 0;
  doc.head.append = () => {
    duplicateBootstraps++;
    win.onSpotifyIframeApiReady(api);
  };
  win.matchMedia = () => Object.assign(new Element(), { matches: true });
  const events = new Map();
  const entities = [];
  const timers = new Map();
  let timerId = 0;
  let creates = 0,
    plays = 0,
    pauses = 0,
    resumes = 0,
    destroys = 0,
    shown = 0;
  const controller = {
    addListener: (name, fn) => events.set(name, fn),
    pause: () => pauses++,
    play: () => plays++,
    resume: () => resumes++,
    destroy: () => destroys++,
    loadEntity: (uri) => entities.push(uri),
  };
  const frame = new Element();
  dialog.querySelector('.spotify-embed').nodes.set('iframe', frame);
  const api = {
    createController: (_mount, _options, callback) => {
      creates++;
      entities.push(_options.uri);
      callback(controller);
    },
  };
  win.robinerSpotifyApiReady = Promise.resolve(api);
  const enable = await load(
    'spotify.js',
    {
      document: doc,
      window: win,
      setTimeout: (callback, delay) => {
        timers.set(++timerId, { callback, delay });
        return timerId;
      },
      clearTimeout: (id) => timers.delete(id),
      enableRobinerSpotifyPosition: () => ({ show: () => shown++, hide() {} }),
    },
    'enableRobinerSpotify',
  );
  enable(
    [
      { id: 'a'.repeat(22), title: 'My playlist' },
      { id: 'b'.repeat(22), title: 'Other playlist' },
    ],
    spotifyQueue,
  );
  const open = () => doc.emit('click', { target: { closest: () => new Element() } });
  assert.equal(dialog.open, true, 'Wave is visible on first page load');
  assert.equal(dialog.modal, false);
  assert.equal(shown, 1);
  assert.equal(resumes, 0, 'Playback waits for the Spotify controller');
  assert.equal(plays, 0);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(creates, 1);
  assert.equal(
    duplicateBootstraps,
    0,
    'The player reuses the early API request without another bootstrap',
  );
  assert.equal(entities[0], 'spotify:track:3QF5RsWzK1lCvf2o2cY65P');
  assert.equal(
    dialog.querySelector('.spotify-external').href,
    'https://open.spotify.com/track/3QF5RsWzK1lCvf2o2cY65P',
  );
  assert.equal(frame.title, 'Spotify track: Dear Reader — Taylor Swift');
  events.get('ready')();
  assert.equal(plays, 0, 'The initial ready event does not autoplay without a tap');
  events.get('ready')();
  assert.equal(plays, 0, 'Repeated ready events cannot start automatic playback');
  assert.equal(resumes, 0, 'RESUME is only used after playback has actually started');
  assert.equal(dialog.modal, false);
  assert.equal(toggle.attrs.get('aria-label'), 'Play Spotify music');
  await toggle.emit('click');
  assert.equal(plays, 1, 'A real wave tap starts default music directly');
  const manualBlocked = [...timers.values()].find((timer) => timer.delay === 6000);
  manualBlocked.callback();
  assert.equal(toggle.attrs.get('aria-label'), 'Open Spotify playback controls');
  await toggle.emit('click');
  assert.equal(dialog.modal, true, 'Browser-restricted playback has usable native controls');
  events.get('playback_started')();
  assert.equal(dialog.modal, false);
  assert.equal(mini.classList.contains('is-playing'), true);
  await toggle.emit('click');
  assert.equal(pauses, 1);
  events.get('playback_update')({ data: { isPaused: true } });
  assert.equal(mini.classList.contains('is-playing'), false);
  assert.equal(toggle.attrs.get('aria-label'), 'Play Spotify music');
  await toggle.emit('click');
  assert.equal(resumes, 1, 'A paused playlist resumes without restarting');
  events.get('playback_update')({ data: { isPaused: false, isBuffering: false } });
  assert.equal(mini.classList.contains('is-playing'), true);
  const update = (id, position, duration, isPaused = false, isBuffering = false) =>
    events.get('playback_update')({
      data: { playingURI: `spotify:track:${id}`, position, duration, isPaused, isBuffering },
    });
  const dear = spotifyQueue[0].id,
    drinking = spotifyQueue[1].id,
    thirteen = spotifyQueue[2].id;
  update(dear, 224950, 225000);
  await toggle.emit('click');
  update(dear, 224950, 225000, true);
  assert.equal(entities.length, 1, 'Manually pausing near the end must not skip the song');
  await toggle.emit('click');
  update(dear, 225000, 225000, false, true);
  assert.equal(entities.length, 1, 'Buffering must not count as completion');
  update(dear, 225000, 225000, true);
  assert.equal(entities[1], `spotify:track:${drinking}`);
  assert.equal(plays, 2, 'I Quit Drinking starts after Dear Reader');
  update(dear, 225000, 225000, true);
  assert.equal(entities.length, 2, 'Duplicate completion events must not skip the next track');
  events.get('playback_started')({ data: { playingURI: `spotify:track:${drinking}` } });
  update(drinking, 170800, 171000);
  update(drinking, 0, 171000, true);
  assert.equal(entities[2], `spotify:track:${thirteen}`, 'An end-position reset advances to 13');
  assert.equal(plays, 3);
  events.get('playback_started')({ data: { playingURI: `spotify:track:${thirteen}` } });
  update(thirteen, 234000, 234000, true);
  update(thirteen, 234000, 234000, true);
  assert.equal(entities.length, 3, 'The queue stops after 13 without an automatic loop');
  await open();
  events.get('playback_started')();
  assert.equal(dialog.modal, true, 'Later tracks must not dismiss a deliberately reopened player');
  await playlists[1].emit('click');
  assert.equal(creates, 1, 'Changing playlists reuses the controller');
  assert.equal(entities[3], `spotify:playlist:${'b'.repeat(22)}`);
  await dialog.querySelector('.spotify-close').emit('click');
  assert.equal(dialog.open, true, 'Wave remains visible even for an unplayed playlist');
  assert.equal(dialog.modal, false);
  await open();
  events.get('playback_update')({ data: { isPaused: false, isBuffering: false } });
  assert.equal(dialog.modal, false);
  await dialog.querySelector('.spotify-stop').emit('click');
  await dialog.emit('close');
  assert.equal(dialog.open, true, 'Stopping music retains the idle wave');
  assert.equal(dialog.modal, false);
  assert.equal(destroys, 1);
  await toggle.emit('click');
  await new Promise((resolve) => setImmediate(resolve));
  events.get('ready')();
  assert.equal(creates, 2, 'Wave can start again after stopping');
  assert.equal(plays, 4, 'A fresh controller starts with PLAY again');
  assert.equal(resumes, 2);
  assert.equal(
    entities[4],
    'spotify:track:3QF5RsWzK1lCvf2o2cY65P',
    'Stopping and restarting restores Dear Reader',
  );
});

test('wave drag clamps to desktop/phone bounds and never becomes a playback click', async () => {
  for (const phone of [false, true]) {
    const doc = new Element(),
      win = new Element(),
      dialog = new Element();
    const mini = new Element(),
      toggle = new Element();
    dialog.nodes.set('.spotify-mini', mini);
    mini.nodes.set('.spotify-wave-toggle', toggle);
    toggle.closest = (selector) => (selector === '.spotify-wave-toggle' ? toggle : null);
    doc.documentElement = new Element();
    doc.documentElement.clientWidth = phone ? 360 : 1280;
    doc.querySelector = () => null;
    win.innerWidth = doc.documentElement.clientWidth;
    win.innerHeight = phone ? 720 : 900;
    dialog.viewport = win;
    const raf = new Map();
    let id = 0;
    const enable = await load(
      'spotify-position.js',
      {
        document: doc,
        window: win,
        requestAnimationFrame: (fn) => {
          raf.set(++id, fn);
          return id;
        },
        cancelAnimationFrame: (key) => raf.delete(key),
        getComputedStyle: () => ({ pointerEvents: 'auto' }),
      },
      'enableRobinerSpotifyPosition',
    );
    const position = enable(dialog);
    position.show();
    assert.equal(dialog.getBoundingClientRect().left, phone ? 10 : 16);
    const start = { ...dialog.getBoundingClientRect() };
    if (phone) {
      const touch = (x, y) => [{ identifier: 7, clientX: x, clientY: y }];
      await mini.emit('touchstart', {
        target: toggle,
        changedTouches: touch(start.left, start.top),
      });
      const move = await mini.emit('touchmove', {
        cancelable: true,
        changedTouches: touch(9999, 9999),
      });
      assert.equal(move.defaultPrevented, true);
      await mini.emit('touchend', { changedTouches: touch(9999, 9999) });
    } else {
      await mini.emit('pointerdown', {
        target: toggle,
        pointerType: 'mouse',
        button: 0,
        pointerId: 7,
        clientX: start.left,
        clientY: start.top,
      });
      await mini.emit('pointermove', { pointerId: 7, clientX: 9999, clientY: 9999 });
      await mini.emit('pointerup', { pointerId: 7 });
    }
    assert.equal(dialog.getBoundingClientRect().right, win.innerWidth - (phone ? 10 : 16));
    assert.equal(dialog.getBoundingClientRect().bottom, win.innerHeight - (phone ? 10 : 16));
    assert.equal(
      (await mini.emit('click')).defaultPrevented,
      true,
      'Drag release must not toggle music',
    );
    await toggle.emit('keydown', { key: 'Home' });
    assert.equal(dialog.getBoundingClientRect().left, start.left);
    await toggle.emit('keydown', { key: 'ArrowRight' });
    assert.equal(dialog.getBoundingClientRect().left, start.left + 16);
    win.innerWidth = doc.documentElement.clientWidth = 280;
    win.innerHeight = 180;
    await win.emit('resize');
    const tasks = [...raf.values()];
    raf.clear();
    tasks.forEach((fn) => fn());
    assert.ok(dialog.getBoundingClientRect().right <= 270);
    assert.ok(dialog.getBoundingClientRect().bottom <= 170);
    position.hide();
    assert.equal(doc.documentElement.classList.contains('spotify-mini-active'), false);
  }
});

test('phone wave stays at the viewport edge while sections and browser chrome scroll', async () => {
  const doc = new Element(),
    win = new Element(),
    dialog = new Element();
  const mini = new Element(),
    toggle = new Element(),
    main = new Element();
  dialog.nodes.set('.spotify-mini', mini);
  mini.nodes.set('.spotify-wave-toggle', toggle);
  win.innerWidth = 360;
  win.innerHeight = 720;
  win.visualViewport = Object.assign(new Element(), {
    width: 360,
    height: 720,
    offsetTop: 0,
    offsetLeft: 0,
  });
  dialog.viewport = win;
  doc.documentElement = Object.assign(new Element(), { clientWidth: 360 });
  doc.querySelector = (selector) => (selector === '#main' ? main : null);
  let scans = 0,
    controlTop = 0;
  const control = new Element();
  control.getBoundingClientRect = () => ({
    left: 0,
    right: 360,
    top: controlTop,
    bottom: controlTop + 500,
    width: 360,
    height: 500,
  });
  main.querySelectorAll = () => {
    scans++;
    return [control];
  };
  const raf = new Map();
  let id = 0;
  const flush = () => {
    const tasks = [...raf.values()];
    raf.clear();
    tasks.forEach((fn) => fn());
  };
  let routeChanged;
  const enable = await load(
    'spotify-position.js',
    {
      document: doc,
      window: win,
      requestAnimationFrame: (fn) => {
        raf.set(++id, fn);
        return id;
      },
      cancelAnimationFrame: (key) => raf.delete(key),
      getComputedStyle: () => ({ pointerEvents: 'auto' }),
      MutationObserver: class {
        constructor(callback) {
          routeChanged = callback;
        }
        observe() {}
      },
    },
    'enableRobinerSpotifyPosition',
  );
  enable(dialog).show();
  const initial = dialog.getBoundingClientRect();
  for (const top of [620, 500, 300, 0, -500, 300, 620]) {
    controlTop = top;
    await win.emit('scroll');
    assert.equal(raf.size, 0, 'Page scrolling must not schedule mobile position rewrites');
    await win.visualViewport.emit('scroll');
    flush();
    assert.equal(dialog.getBoundingClientRect().top, initial.top);
    assert.equal(dialog.getBoundingClientRect().left, 10);
  }
  win.visualViewport.height = 660;
  await win.visualViewport.emit('resize');
  flush();
  assert.equal(
    dialog.getBoundingClientRect().bottom,
    638,
    'Native bottom anchoring follows the visible viewport',
  );
  routeChanged();
  flush();
  assert.equal(dialog.classList.contains('is-spotify-edge-docked'), true);
  assert.equal(
    dialog.styles.has('--spotify-mini-y'),
    false,
    'Mobile docking does not write content-dependent pixel coordinates',
  );
  assert.equal(
    scans,
    0,
    'Projects, skills, certificate and email controls must not push the mobile wave away',
  );
});

test('floating wave has no artwork/box and explicitly contrasts with both themes', async () => {
  const css = await fs.readFile(new URL('../site/assets/styles.css', import.meta.url), 'utf8');
  const html = await fs.readFile(new URL('../site/assets/portfolio.js', import.meta.url), 'utf8');
  assert.doesNotMatch(html, /spotify-mini-cover|spotify-mini-artwork|spotify-mini-progress/);
  assert.match(css, /\.is-spotify-mini\[open\][\s\S]*?color: #000;/);
  assert.match(
    css,
    /:root\[data-theme='dark'\] #robiner-spotify-dialog\.is-spotify-mini\[open\] \{\s*color: #fff;/,
  );
  assert.match(css, /\.is-spotify-mini\[open\][\s\S]*?background: transparent;/);
  assert.match(css, /prefers-reduced-motion: reduce[\s\S]*?spotify-wave > span/);
  assert.doesNotMatch(css, /\.spotify-mini\.is-playing \.spotify-wave/);
  assert.match(css, /\.spotify-wave > span \{\s*animation: robiner-spotify-wave/);
});
