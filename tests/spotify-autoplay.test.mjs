import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';

class Element {
  nodes = new Map();
  listeners = new Map();
  dataset = {};
  classes = new Set();
  classList = {
    add: (name) => this.classes.add(name),
    remove: (name) => this.classes.delete(name),
    contains: (name) => this.classes.has(name),
    toggle: (name, force) => (force ? this.classes.add(name) : this.classes.delete(name)),
  };
  addEventListener(type, callback) {
    const callbacks = this.listeners.get(type) || [];
    callbacks.push(callback);
    this.listeners.set(type, callbacks);
  }
  emit(type, props = {}) {
    for (const callback of this.listeners.get(type) || []) {
      callback({ type, target: this, isTrusted: true, ...props });
    }
  }
  querySelector(selector) {
    return this.nodes.get(selector) || null;
  }
  querySelectorAll() {
    return [];
  }
  closest() {
    return null;
  }
  setAttribute() {}
  removeAttribute() {}
  append() {}
  replaceChildren() {}
  focus() {}
  show() {
    this.open = true;
    this.modal = false;
  }
  showModal() {
    this.open = true;
    this.modal = true;
  }
  close() {
    this.open = false;
  }
}

async function setup({ desktop = true, loading = false } = {}) {
  const doc = new Element();
  const dialog = new Element();
  const mini = new Element();
  const wave = new Element();
  const playlist = new Element();
  playlist.dataset.spotifyPlaylist = '0';
  mini.nodes.set('.spotify-wave-toggle', wave);
  for (const selector of [
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
  ]) {
    dialog.nodes.set(selector, new Element());
  }
  dialog.nodes.set('.spotify-mini', mini);
  dialog.querySelectorAll = () => [playlist];
  doc.nodes.set('#robiner-spotify-dialog', dialog);
  doc.documentElement = new Element();
  doc.createElement = () => new Element();
  const events = new Map();
  const calls = { play: 0, resume: 0, pause: 0 };
  const controller = {
    addListener: (type, callback) => events.set(type, callback),
    play: () => calls.play++,
    resume: () => calls.resume++,
    pause: () => calls.pause++,
    destroy() {},
    loadEntity() {},
  };
  const api = { createController: (_mount, _options, callback) => callback(controller) };
  let resolveApi;
  const pendingApi = new Promise((resolve) => {
    resolveApi = resolve;
  });
  const win = {
    matchMedia: (query) =>
      Object.assign(new Element(), {
        matches: query.includes('pointer: fine') ? desktop : true,
      }),
    robinerSpotifyApiReady: loading ? pendingApi : Promise.resolve(api),
  };
  const timers = new Map();
  let timerId = 0;
  const source = (await fs.readFile(new URL('../site/assets/spotify.js', import.meta.url), 'utf8'))
    .replace(/^import[^;]+;\s*/gm, '')
    .replace('export function', 'function');
  const context = vm.createContext({
    document: doc,
    window: win,
    enableRobinerSpotifyPosition: () => ({ show() {}, hide() {} }),
    setTimeout: (callback) => {
      timers.set(++timerId, callback);
      return timerId;
    },
    clearTimeout: (id) => timers.delete(id),
  });
  vm.runInContext(source + '\nglobalThis.enable = enableRobinerSpotify;', context);
  const track = { id: 'a'.repeat(22), title: 'Default music', type: 'track' };
  const playback = context.enable([{ ...track, id: 'b'.repeat(22) }], [track]);
  const flush = () => new Promise((resolve) => setImmediate(resolve));
  await flush();
  return {
    doc,
    dialog,
    wave,
    playlist,
    calls,
    playback,
    timers,
    ready: () => events.get('ready')(),
    playing: () => events.get('playback_started')(),
    paused: () => events.get('playback_update')({ data: { isPaused: true } }),
    load: async () => {
      resolveApi(api);
      await flush();
    },
  };
}

test('blocked desktop autoplay retries once on a trusted page click without opening the player', async () => {
  const h = await setup();
  h.ready();
  assert.equal(h.calls.play, 1);
  for (const callback of [...h.timers.values()]) callback();
  h.doc.emit('click', { isTrusted: false });
  h.doc.emit('pointermove');
  h.doc.emit('scroll');
  assert.equal(h.calls.play, 1, 'Synthetic events and scrolling cannot start playback');
  h.doc.emit('click');
  assert.equal(h.calls.play, 2);
  assert.equal(h.dialog.modal, false, 'Retry keeps the wave minimized');
  h.doc.emit('click');
  h.doc.emit('keydown', { key: 'Enter' });
  h.ready();
  assert.equal(h.calls.play, 2, 'Later gestures and readiness cannot repeat the retry');
});

test('early page gestures preserve a retry until Spotify is ready without duplicate startup plays', async () => {
  const h = await setup({ loading: true });
  h.doc.emit('click');
  h.doc.emit('click');
  assert.equal(h.calls.play, 0);
  await h.load();
  h.ready();
  h.ready();
  assert.equal(h.calls.play, 1);
  h.doc.emit('click');
  assert.equal(h.calls.play, 2, 'A fresh ready gesture still retries a blocked initial play');
  h.doc.emit('click');
  assert.equal(h.calls.play, 2);
});

test('manual wave, stop, playlist selection and opening the picker cancel startup recovery', async () => {
  for (const action of ['wave', 'stop', 'playlist', 'picker']) {
    const h = await setup();
    h.ready();
    if (action === 'wave') h.wave.emit('click');
    if (action === 'stop') h.dialog.querySelector('.spotify-stop').emit('click');
    if (action === 'playlist') h.playlist.emit('click');
    if (action === 'picker') {
      const opener = new Element();
      h.doc.emit('click', { target: { closest: () => opener } });
      h.dialog.querySelector('.spotify-close').emit('click');
    }
    const plays = h.calls.play;
    h.doc.emit('click');
    assert.equal(h.calls.play, plays, `${action} must not be followed by unwanted autoplay`);
  }
});

test('confirmed playback followed by a manual pause stays paused on unrelated desktop clicks', async () => {
  const h = await setup();
  h.ready();
  h.playing();
  h.wave.emit('click');
  h.paused();
  h.doc.emit('click');
  assert.equal(h.calls.pause, 1);
  assert.equal(h.calls.play, 1);
  assert.equal(h.calls.resume, 0);
});

test('phone taps and desktop keyboard activation retry only once', async () => {
  const phone = await setup({ desktop: false });
  phone.ready();
  phone.doc.emit('click');
  phone.doc.emit('keydown', { key: 'Enter' });
  assert.equal(phone.calls.play, 2, 'Phone page tap retries the blocked autoplay');
  phone.wave.emit('click');
  assert.equal(phone.calls.play, 3, 'Phone wave remains a direct play button');
  for (const key of ['Enter', ' ']) {
    const h = await setup();
    h.ready();
    h.doc.emit('keydown', { key: 'ArrowDown' });
    h.doc.emit('keydown', { key, repeat: true });
    h.doc.emit('keydown', { key, ctrlKey: true });
    assert.equal(h.calls.play, 1);
    h.doc.emit('keydown', { key });
    h.doc.emit('click');
    assert.equal(h.calls.play, 2);
  }
});

test('a left mouse press starts the retry before a drag; hover and other buttons do nothing', async () => {
  const h = await setup();
  h.ready();
  h.doc.emit('mousemove');
  h.doc.emit('pointermove');
  h.doc.emit('mousedown', { button: 2 });
  h.doc.emit('mousedown', { button: 0, isTrusted: false });
  assert.equal(h.calls.play, 1);
  h.doc.emit('mousedown', { button: 0 });
  assert.equal(h.calls.play, 2);
  h.doc.emit('mousemove', { buttons: 1 });
  h.doc.emit('mouseup', { button: 0 });
  h.doc.emit('click');
  assert.equal(h.calls.play, 2, 'Drag and its release do not repeat or toggle playback');
});

test('pressing or dragging explicit Spotify controls cannot trigger the page retry', async () => {
  const h = await setup();
  h.ready();
  const target = { closest: () => h.dialog };
  h.doc.emit('mousedown', { button: 0, target });
  assert.equal(h.calls.play, 1);
  h.wave.emit('click');
  const plays = h.calls.play;
  h.doc.emit('mousedown', { button: 0 });
  assert.equal(h.calls.play, plays);
});

test('first wave tap while loading requests playback; a second explicit tap can cancel it', async () => {
  for (const taps of [1, 2]) {
    const h = await setup({ loading: true });
    for (let tap = 0; tap < taps; tap++) h.wave.emit('click');
    await h.load();
    h.ready();
    assert.equal(h.calls.play, taps === 1 ? 1 : 0);
    h.doc.emit('click');
    assert.equal(
      h.calls.play,
      taps === 1 ? 1 : 0,
      'Page gestures cannot undo explicit wave intent',
    );
  }
});

test('a restricted page-initiated retry retains the official player recovery via the wave', async () => {
  const h = await setup();
  h.ready();
  h.doc.emit('click');
  for (const callback of [...h.timers.values()]) callback();
  assert.equal(h.dialog.modal, false, 'Failure does not interrupt the page with a modal');
  h.wave.emit('click');
  assert.equal(h.dialog.modal, true, 'The visitor can reach Spotify native Play if required');
});

test('gallery waits for Spotify pause acknowledgement and resumes only previously requested music', async () => {
  const h=await setup();h.ready();h.playing();
  const held=h.playback.suspendForGallery();
  assert.equal(h.calls.pause,1);
  assert.equal(h.playback.galleryIsSilent(),false);
  h.paused();assert.equal(await held,true);
  h.doc.emit('click');assert.equal(h.calls.resume,0,'page gestures cannot restart held music');
  h.playback.releaseGallery();assert.equal(h.calls.resume,1);
  h.playing();h.wave.emit('click');h.paused();
  await h.playback.suspendForGallery();h.playback.releaseGallery();
  assert.equal(h.calls.resume,1,'a manual Spotify pause stays paused after the gallery');
});

test('gallery prevents delayed Spotify initialization from autoplaying until release', async () => {
  const h=await setup({loading:true});await h.playback.suspendForGallery();
  await h.load();h.ready();assert.equal(h.calls.play,0);
  h.playback.releaseGallery();assert.equal(h.calls.play,1);
});

test('explicit music takeover notifies the gallery before resuming and stopping cancels automatic resume', async () => {
  const h=await setup();h.ready();h.playing();
  let takeover=0;h.playback.onGalleryTakeover(()=>{takeover++;assert.equal(h.calls.resume,0);});
  let held=h.playback.suspendForGallery();h.paused();await held;
  h.wave.emit('click');assert.equal(takeover,1);assert.equal(h.calls.resume,1);
  h.playing();held=h.playback.suspendForGallery();h.paused();await held;
  h.dialog.querySelector('.spotify-stop').emit('click');
  h.playback.releaseGallery();assert.equal(h.calls.resume,1);
});

test('late Spotify playback while held is immediately paused and reports unsafe audio', async () => {
  const h=await setup();h.ready();h.playing();
  const held=h.playback.suspendForGallery();h.paused();await held;
  const states=[];h.playback.onGallerySilence(value=>states.push(value));
  const pauses=h.calls.pause;h.playing();assert.equal(h.calls.pause,pauses+1);
  assert.equal(states.at(-1),false);
  h.paused();assert.equal(states.at(-1),true);
  h.playback.releaseGallery(false);assert.equal(h.calls.resume,0);
});
