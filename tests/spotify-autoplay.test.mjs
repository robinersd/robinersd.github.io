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
  context.enable([{ ...track, id: 'b'.repeat(22) }], [track]);
  const flush = () => new Promise((resolve) => setImmediate(resolve));
  await flush();
  return {
    doc,
    dialog,
    wave,
    playlist,
    calls,
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

test('default Spotify music stays silent on load and unrelated page gestures', async () => {
  const h = await setup();
  h.ready();
  assert.equal(h.calls.play, 0, 'Ready event must not autoplay sound');
  h.doc.emit('click');
  h.doc.emit('mousedown', { button: 0 });
  h.doc.emit('keydown', { key: 'Enter' });
  h.doc.emit('keydown', { key: ' ' });
  assert.equal(h.calls.play, 0, 'Unrelated page clicks and keys must not start Spotify');
  assert.equal(h.dialog.modal, false, 'Wave stays minimized');
});

test('explicit wave tap starts playback, pauses cleanly, and resumes on tap', async () => {
  const h = await setup();
  h.ready();
  h.wave.emit('click');
  assert.equal(h.calls.play, 1, 'Tapping the wave starts the default track');
  h.playing();
  h.wave.emit('click');
  h.paused();
  assert.equal(h.calls.pause, 1);
  h.doc.emit('click');
  assert.equal(h.calls.resume, 0, 'Unrelated clicks never resume paused music');
  h.wave.emit('click');
  assert.equal(h.calls.resume, 1, 'Tapping the wave resumes paused music');
});

test('first wave tap while loading requests playback; a second explicit tap cancels it', async () => {
  for (const taps of [1, 2]) {
    const h = await setup({ loading: true });
    for (let tap = 0; tap < taps; tap++) h.wave.emit('click');
    await h.load();
    h.ready();
    assert.equal(h.calls.play, taps === 1 ? 1 : 0);
    h.doc.emit('click');
    assert.equal(h.calls.play, taps === 1 ? 1 : 0);
  }
});

test('a restricted manual wave play retains the official player recovery via the wave', async () => {
  const h = await setup();
  h.ready();
  h.wave.emit('click');
  for (const callback of [...h.timers.values()]) callback();
  assert.equal(h.dialog.modal, false, 'Failure does not interrupt the page with a modal');
  h.wave.emit('click');
  assert.equal(h.dialog.modal, true, 'The visitor can reach Spotify native Play if required');
});
