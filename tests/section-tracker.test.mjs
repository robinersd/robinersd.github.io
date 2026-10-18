import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';

class Element {
  children = [];
  listeners = new Map();
  attrs = new Map();
  dataset = {};
  props = new Map();
  classes = new Set();
  classList = {
    add: (name) => this.classes.add(name),
    remove: (name) => this.classes.delete(name),
    toggle: (name, value) => (value ? this.classes.add(name) : this.classes.delete(name)),
  };
  style = { setProperty: (name, value) => this.props.set(name, value) };
  addEventListener(type, callback) {
    const list = this.listeners.get(type) || [];
    list.push(callback);
    this.listeners.set(type, list);
  }
  removeEventListener(type, callback) {
    this.listeners.set(
      type,
      (this.listeners.get(type) || []).filter((item) => item !== callback),
    );
  }
  emit(type, props = {}) {
    const event = {
      type,
      target: this,
      button: 0,
      preventDefault() {
        this.defaultPrevented = true;
      },
      ...props,
    };
    for (const callback of this.listeners.get(type) || []) callback(event);
    return event;
  }
  setAttribute(name, value) {
    this.attrs.set(name, String(value));
  }
  removeAttribute(name) {
    this.attrs.delete(name);
  }
  append(...children) {
    children.forEach((child) => {
      child.parent = this;
      this.children.push(child);
    });
  }
  replaceChildren(...children) {
    this.children = [];
    this.append(...children);
  }
  contains(target) {
    return target === this || this.children.some((child) => child.contains(target));
  }
  closest() {
    return this.dataset.sectionTarget ? this : this.parent?.closest();
  }
  remove() {
    this.parent.children = this.parent.children.filter((item) => item !== this);
  }
  focus(options) {
    this.focusOptions = options;
    this.focusCount = (this.focusCount || 0) + 1;
  }
}

async function setup({ home = true, reduced = false, desktop = false, animated = false } = {}) {
  const doc = new Element();
  const win = new Element();
  const root = new Element();
  const main = new Element();
  const header = new Element();
  const siteNav = new Element();
  const panel = new Element();
  const toggle = new Element();
  const nav = new Element();
  panel.append(nav);
  const animations = [];
  panel.getBoundingClientRect = () => ({ left: desktop ? 980 : 100 });
  win.innerWidth = desktop ? 1280 : 390;
  if (animated)
    panel.animate = (keyframes, options) => {
      let finish;
      let reject;
      const playback = {
        keyframes,
        options,
        cancelled: false,
        finished: new Promise((resolve, fail) => {
          finish = resolve;
          reject = fail;
        }),
        finish: () => finish(),
        cancel() {
          this.cancelled = true;
          reject(new Error('cancelled'));
        },
      };
      animations.push(playback);
      return playback;
    };
  header.getBoundingClientRect = () => ({ bottom: 112 });
  siteNav.getBoundingClientRect = () => ({ bottom: 72 });
  win.innerHeight = 800;
  win.scrollY = 0;
  win.scrolls = [];
  win.scrollTo = (options) => {
    win.scrolls.push(options);
    win.scrollY = options.top;
  };
  win.location = { pathname: home ? '/' : '/projects' };
  const media = Object.assign(new Element(), { matches: desktop });
  win.matchMedia = (query) => (query.includes('min-width') ? media : { matches: reduced });
  root.scrollHeight = 4500;
  const names = [
    'Intro',
    'About',
    'Projects',
    'Skills',
    'Education',
    'Recognition',
    'Gallery',
    'Contact',
  ];
  const sections = names.map((name, index) => {
    const section = new Element();
    section.id = name.toLowerCase();
    section.dataset.scrollSection = name;
    section.top = index * 600;
    section.getBoundingClientRect = () => ({ top: section.top - win.scrollY });
    return section;
  });
  main.querySelector = () => (home ? sections[0] : null);
  main.querySelectorAll = () => sections;
  doc.querySelector = (selector) =>
    ({
      '#main': main,
      header,
      '.site-nav': siteNav,
      '#portfolio-sidebar': panel,
      '#sidebar-toggle': toggle,
      '#sidebar-section-links': nav,
    })[selector];
  doc.createElement = () => new Element();
  doc.body = new Element();
  doc.documentElement = root;
  const frames = new Map();
  let sequence = 0;
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
  const source = (
    await fs.readFile(new URL('../site/assets/section-tracker.js', import.meta.url), 'utf8')
  ).replace('export function', 'function');
  const context = vm.createContext({
    document: doc,
    window: win,
    ResizeObserver: Observer,
    requestAnimationFrame: (callback) => {
      frames.set(++sequence, callback);
      return sequence;
    },
    cancelAnimationFrame: (id) => frames.delete(id),
  });
  vm.runInContext(source + '\nglobalThis.enable = enableSectionTracker;', context);
  const stop = context.enable();
  const tracker = panel;
  const flush = () => {
    const pending = [...frames.values()];
    frames.clear();
    pending.forEach((fn) => fn());
  };
  return {
    doc,
    win,
    root,
    sections,
    tracker,
    toggle,
    nav,
    stop,
    frames,
    observers,
    media,
    animations,
    restart: () => context.enable(),
    flush,
    active: () =>
      nav.children.find((link) => link.attrs.has('aria-current'))?.children[0]?.textContent,
  };
}

test('the current section follows scrolling both ways, preserves focus and batches scroll events', async () => {
  const h = await setup();
  assert.equal(h.active(), 'Intro');
  h.win.scrollY = 1700;
  for (let count = 0; count < 15; count++) h.win.emit('scroll');
  assert.equal(h.frames.size, 1);
  h.flush();
  assert.equal(h.active(), 'Skills');
  assert.equal(h.nav.children[3].attrs.get('aria-current'), 'location');
  h.win.scrollY = 1050;
  h.win.emit('scroll');
  h.flush();
  assert.equal(h.active(), 'Projects');
  assert.equal(
    h.sections.some((section) => section.focusCount),
    false,
  );
  assert.equal(h.win.scrolls.length, 0, 'Reading the page must not trigger its own scrolling');
  h.win.scrollY = 3700;
  h.win.emit('scroll');
  h.flush();
  assert.equal(
    h.active(),
    'Contact',
    'Short final sections still become current at the page bottom',
  );
});

test('section shortcuts clear the sticky header, keep the menu open and honor reduced motion', async () => {
  for (const reduced of [false, true]) {
    const h = await setup({ reduced });
    assert.equal(h.toggle.attrs.get('aria-expanded'), 'false');
    h.toggle.emit('click');
    assert.equal(h.toggle.attrs.get('aria-expanded'), 'true');
    const link = h.nav.children[3];
    const event = h.nav.emit('click', { target: link });
    assert.equal(event.defaultPrevented, true);
    assert.equal(h.toggle.attrs.get('aria-expanded'), 'true');
    assert.equal(h.win.scrolls[0].top, 1668);
    assert.equal(h.win.scrolls[0].behavior, reduced ? 'auto' : 'smooth');
    assert.equal(h.sections[3].focusOptions.preventScroll, true);
    h.win.emit('scroll');
    h.flush();
    assert.equal(h.active(), 'Skills');
    const modified = h.nav.emit('click', { target: h.nav.children[0], ctrlKey: true });
    assert.equal(modified.defaultPrevented, undefined, 'Modified native links remain available');
  }
});

test('phone menu starts closed without flashing, opens explicitly, and closes on Escape', async () => {
  const h = await setup({ animated: true });
  assert.equal(h.tracker.props.get('--sidebar-top'), '124px');
  assert.equal(h.tracker.hidden, true);
  assert.equal(h.tracker.inert, true);
  assert.equal(h.toggle.attrs.get('aria-expanded'), 'false');
  assert.equal(
    h.animations.length,
    0,
    'A closed phone menu must not animate across the page on load',
  );
  h.toggle.emit('click');
  h.animations.at(-1).finish();
  await Promise.resolve();
  assert.equal(h.tracker.hidden, false);
  h.doc.emit('click', { target: h.nav.children[0] });
  assert.equal(h.toggle.attrs.get('aria-expanded'), 'true');
  h.doc.emit('click');
  assert.equal(h.toggle.attrs.get('aria-expanded'), 'true');
  h.doc.emit('keydown', { key: 'Escape' });
  assert.equal(h.toggle.attrs.get('aria-expanded'), 'false');
  assert.equal(h.toggle.focusCount, 1);
  h.win.scrollY = 1700;
  h.observers[0].callback();
  h.flush();
  assert.equal(h.active(), 'Skills');
  h.sections[3].top += 500;
  h.observers[0].callback();
  h.flush();
  assert.equal(h.active(), 'Projects', 'Image/layout changes can move the active section boundary');
  h.doc.hidden = true;
  h.win.emit('scroll');
  assert.equal(h.frames.size, 0);
});

test('route cleanup removes pending work and listeners; persistent menu remains useful on subpages', async () => {
  const h = await setup();
  h.win.emit('scroll');
  h.stop();
  assert.equal(h.frames.size, 0);
  assert.equal(h.doc.body.children.length, 0);
  assert.equal(h.nav.children.length, 0);
  assert.equal(h.observers[0].disconnected, true);
  h.win.emit('scroll');
  h.win.emit('resize');
  h.observers[0].callback();
  assert.equal(h.frames.size, 0);
  const subpage = await setup({ home: false });
  assert.equal(subpage.nav.children.length, 8);
  assert.equal(subpage.nav.children[3].href, '/#skills');
  assert.equal(subpage.active(), 'Projects');
  const event = subpage.nav.emit('click', { target: subpage.nav.children[3] });
  assert.equal(
    event.defaultPrevented,
    undefined,
    'Home-section links keep their native navigation on subpages',
  );
  subpage.stop();
});

test('desktop menu starts open, stays open while reading and navigating, and closes explicitly', async () => {
  const h = await setup({ desktop: true });
  assert.equal(h.toggle.attrs.get('aria-expanded'), 'true');
  assert.equal(h.tracker.hidden, false);
  assert.equal(h.root.classes.has('sidebar-open'), true);
  h.doc.emit('click');
  assert.equal(
    h.toggle.attrs.get('aria-expanded'),
    'true',
    'Reading content must not close the desktop sidebar',
  );
  h.nav.emit('click', { target: h.nav.children[3] });
  assert.equal(h.toggle.attrs.get('aria-expanded'), 'true');
  h.toggle.emit('click');
  assert.equal(h.tracker.hidden, true);
  assert.equal(h.toggle.attrs.get('aria-label'), 'Open page menu');
  h.win.emit('scroll');
  h.flush();
  assert.equal(h.tracker.hidden, true, 'Scrolling must respect the visitor closing the menu');
  h.toggle.emit('click');
  assert.equal(h.tracker.hidden, false);
  h.media.matches = false;
  h.media.emit('change');
  assert.equal(h.tracker.hidden, false, 'Changing viewport cannot override the visitor choice');
  assert.equal(h.tracker.classes.has('is-mobile-open'), true);
  h.doc.emit('click', { target: h.toggle });
  assert.equal(h.tracker.hidden, false, 'The opening click cannot immediately close its own menu');
  h.stop();
});

test('a visitor closing the menu stays respected across route initialization and viewport changes', async () => {
  const h = await setup({ desktop: true });
  h.toggle.emit('click');
  assert.equal(h.tracker.hidden, true);
  h.stop();
  const stopAgain = h.restart();
  assert.equal(h.tracker.hidden, true);
  h.media.matches = true;
  h.media.emit('change');
  assert.equal(h.tracker.hidden, true);
  stopAgain();
});

test('menu slides fully in from the right, closes with a slide, and survives rapid toggles', async () => {
  const h = await setup({ desktop: true, animated: true });
  assert.equal(h.tracker.hidden, false);
  assert.equal(h.animations[0].keyframes[0].transform, 'translateX(312px)');
  assert.equal(h.animations[0].keyframes[1].transform, 'translateX(0)');
  h.animations[0].finish();
  await Promise.resolve();
  h.toggle.emit('click');
  assert.equal(h.tracker.inert, true, 'Closing panel cannot retain keyboard focus');
  assert.equal(h.tracker.hidden, false, 'Panel remains painted until its exit animation finishes');
  const closing = h.animations.at(-1);
  h.toggle.emit('click');
  assert.equal(closing.cancelled, true);
  closing.finish();
  await Promise.resolve();
  assert.equal(h.tracker.inert, false);
  assert.equal(h.tracker.hidden, false, 'A cancelled close cannot hide the reopened menu');
  h.animations.at(-1).finish();
  await Promise.resolve();
  h.toggle.emit('click');
  h.animations.at(-1).finish();
  await Promise.resolve();
  assert.equal(h.tracker.hidden, true);
  h.stop();
  const reduced = await setup({ desktop: true, reduced: true, animated: true });
  assert.equal(reduced.animations.length, 0);
  reduced.toggle.emit('click');
  assert.equal(reduced.tracker.hidden, true);
  reduced.stop();
});
