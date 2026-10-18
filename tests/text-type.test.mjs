import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';

async function setup({ reduced = false } = {}) {
  const timers = new Map();
  let nextId = 0;
  const events = () => ({
    listeners: new Map(),
    addEventListener(type, fn) {
      this.listeners.set(type, fn);
    },
    removeEventListener(type) {
      this.listeners.delete(type);
    },
  });
  const motion = { ...events(), matches: reduced };
  const win = { ...events(), matchMedia: () => motion };
  const output = { textContent: '' };
  const caret = { offsetLeft: 24, offsetTop: 18 };
  const cursor = { style: {}, hidden: true };
  const sentence = 'On the left side, tap the Spotify wave to stop the music.';
  const node = {
    dataset: { textType: sentence },
    classList: { toggle() {} },
    querySelector: (selector) =>
      selector.includes('output') ? output : selector.includes('caret') ? caret : cursor,
  };
  const doc = { ...events(), hidden: false, querySelector: () => node };
  const observers = [];
  class Observer {
    constructor(callback) {
      this.callback = callback;
      observers.push(this);
    }
    observe() {}
    disconnect() {
      this.disconnected = true;
    }
  }
  const source = await fs.readFile(new URL('../site/assets/text-type.js', import.meta.url), 'utf8');
  const context = vm.createContext({
    document: doc,
    window: win,
    IntersectionObserver: Observer,
    ResizeObserver: Observer,
    setTimeout: (fn, delay) => {
      const id = ++nextId;
      timers.set(id, { fn, delay });
      return id;
    },
    clearTimeout: (id) => timers.delete(id),
  });
  vm.runInContext(
    source.replace('export function', 'function') + '\nglobalThis.enable = enableTextType;',
    context,
  );
  const stop = context.enable();
  return {
    timers,
    output,
    cursor,
    sentence,
    motion,
    doc,
    win,
    observers,
    stop,
    tick() {
      const [id, timer] = timers.entries().next().value;
      timers.delete(id);
      timer.fn();
      return timer.delay;
    },
  };
}

test('instruction types at 75ms, pauses 1500ms, backspaces at 50ms and restarts', async () => {
  const h = await setup();
  assert.equal(h.output.textContent, '');
  for (let n = 1; n <= h.sentence.length; n++) {
    assert.equal(h.tick(), 75);
    assert.equal(h.output.textContent, h.sentence.slice(0, n));
  }
  assert.equal(h.tick(), 1500);
  assert.equal(h.output.textContent, h.sentence.slice(0, -1));
  for (let n = h.sentence.length - 2; n >= 0; n--) {
    assert.equal(h.tick(), 50);
    assert.equal(h.output.textContent, h.sentence.slice(0, n));
  }
  assert.equal(h.tick(), 75);
  assert.equal(h.output.textContent, 'O');
  assert.equal(h.cursor.style.transform, 'translate(24px, 18px)');
  h.stop();
  assert.equal(h.timers.size, 0);
  assert.equal(h.output.textContent, h.sentence);
  assert.equal(h.cursor.hidden, true);
  assert.equal(h.doc.listeners.size + h.win.listeners.size + h.motion.listeners.size, 0);
  assert.equal(
    h.observers.every((observer) => observer.disconnected),
    true,
  );
});

test('typing pauses in hidden/offscreen views and respects reduced motion changes', async () => {
  const h = await setup();
  h.observers[0].callback([{ isIntersecting: false }]);
  assert.equal(h.timers.size, 0);
  h.observers[0].callback([{ isIntersecting: true }]);
  assert.equal(h.timers.size, 1);
  h.doc.hidden = true;
  h.doc.listeners.get('visibilitychange')();
  assert.equal(h.timers.size, 0);
  h.doc.hidden = false;
  h.doc.listeners.get('visibilitychange')();
  assert.equal(h.tick(), 75);
  h.motion.matches = true;
  h.motion.listeners.get('change')();
  assert.equal(h.output.textContent, h.sentence);
  assert.equal(h.timers.size, 0);
  assert.equal(h.cursor.hidden, true);
  h.stop();
  const reduced = await setup({ reduced: true });
  assert.equal(reduced.output.textContent, reduced.sentence);
  assert.equal(reduced.timers.size, 0);
  reduced.stop();
});
