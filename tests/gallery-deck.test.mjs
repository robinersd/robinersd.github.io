import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import { renderPixelGallery } from '../site/assets/pixel-gallery.js';
import { projects, gallery } from '../site/assets/data.js';

class Element extends EventTarget {
  constructor() {
    super();
    this.children = [];
    this.dataset = {};
    this.style = {};
    this.hidden = false;
    this.attributes = new Map();
    this.animations = [];
    const classes = new Set();
    this.classList = {
      add: (value) => classes.add(value),
      remove: (value) => classes.delete(value),
      contains: (value) => classes.has(value),
    };
  }
  setAttribute(key, value) {
    this.attributes.set(key, value);
  }
  getAttribute(key) {
    return this.attributes.get(key) ?? null;
  }
  removeAttribute(key) {
    this.attributes.delete(key);
    if (key === 'data-deck-slot') delete this.dataset.deckSlot;
  }
  focus() {
    this.focused = true;
  }
  querySelector(selector) {
    return this.nodes?.get(selector) || null;
  }
  querySelectorAll() {
    return [];
  }
  append(child) {
    this.children.push(child);
    child.parent = this;
  }
  remove() {
    if (this.parent) this.parent.children.splice(this.parent.children.indexOf(this), 1);
  }
  contains(child) {
    return this.children.includes(child);
  }
  animate() {
    const animation = {
      canceled: false,
      cancel() {
        this.canceled = true;
      },
    };
    this.animations.push(animation);
    return animation;
  }
  getBoundingClientRect() {
    return { left: 100, top: 50, width: 390, height: 330 };
  }
  async emit(type, extras = {}) {
    const event = Object.assign(new Event(type, { cancelable: true }), extras);
    this.dispatchEvent(event);
    await new Promise((resolve) => setImmediate(resolve));
    return event;
  }
}
function clock() {
  let id = 0;
  const timers = new Map();
  const frames = new Map();
  return {
    timers,
    frames,
    setTimeout(callback, delay) {
      timers.set(++id, { callback, delay });
      return id;
    },
    clearTimeout(key) {
      timers.delete(key);
    },
    requestAnimationFrame(callback) {
      frames.set(++id, callback);
      return id;
    },
    cancelAnimationFrame(key) {
      frames.delete(key);
    },
    frame() {
      const pending = [...frames.values()];
      frames.clear();
      pending.forEach((callback) => callback(0));
    },
  };
}
async function load(file, context, exported) {
  const source = (
    await fs.readFile(new URL(`../site/assets/${file}`, import.meta.url), 'utf8')
  ).replaceAll('export function', 'function');
  const sandbox = vm.createContext(context);
  vm.runInContext(source + `\nglobalThis.api = { ${exported} };`, sandbox);
  return sandbox.api;
}

test('phone deck retains rotation and keyboard selection; desktop shows every card and link', async () => {
  const shell = new Element(),
    grid = new Element(),
    doc = new Element();
  const cards = projects.map(() => new Element());
  const links = projects.map(() => new Element());
  shell.nodes = new Map([['.project-grid', grid]]);
  grid.querySelectorAll = () => cards;
  cards.forEach((card, index) => {
    card.nodes = new Map([['h3', { textContent: projects[index].name }]]);
    card.querySelectorAll = () => [links[index]];
  });
  doc.querySelectorAll = () => [shell];
  const desktop = new Element();
  desktop.matches = false;
  const win = new Element();
  win.matchMedia = () => desktop;
  const api = await load(
    'project-deck.js',
    { document: doc, window: win, AbortController, performance },
    'enableRobinerProjectDeck',
  );
  const stop = api.enableRobinerProjectDeck();
  assert.equal(cards[0].dataset.deckSlot, 'center');
  await cards[1].emit('click', { button: 0 });
  assert.equal(cards[1].dataset.deckSlot, 'center');
  assert.equal(links[0].getAttribute('tabindex'), '-1');
  await shell.emit('keydown', { key: 'ArrowRight' });
  assert.equal(cards[2].dataset.deckSlot, 'center');
  assert.equal(cards[2].focused, true);
  await cards[2].emit('pointerdown', { button: 0, pointerType: 'touch' });
  assert.equal(cards[2].classList.contains('is-deck-pressed'), true);
  desktop.matches = true;
  await desktop.emit('change');
  assert.equal(grid.classList.contains('project-deck'), false);
  assert.equal(grid.classList.contains('project-desktop'), true);
  cards.forEach((card) => assert.equal(card.dataset.deckSlot, undefined));
  links.forEach((link) => assert.equal(link.getAttribute('tabindex'), null));
  assert.equal(cards[2].classList.contains('is-deck-pressed'), false);
  for (const card of cards) {
    await card.emit('pointerdown', { button: 0, pointerType: 'mouse' });
    assert.equal(
      card.classList.contains('is-deck-pressed'),
      true,
      'Every desktop card supports press feedback',
    );
    await doc.emit('pointerup');
    assert.equal(
      card.classList.contains('is-deck-pressed'),
      false,
      'Press feedback resets on release',
    );
    const click = await card.emit('click', { button: 0 });
    assert.equal(click.defaultPrevented, false, 'Desktop card presses never block project links');
  }
  await cards[1].emit('pointerdown', { button: 0, pointerType: 'mouse' });
  await win.emit('blur');
  assert.equal(cards[1].classList.contains('is-deck-pressed'), false);
  await shell.emit('keydown', { key: 'Home' });
  desktop.matches = false;
  await desktop.emit('change');
  assert.equal(
    cards[2].dataset.deckSlot,
    'center',
    'Desktop interaction must not change the phone selection',
  );
  assert.equal(grid.classList.contains('project-desktop'), false);
  assert.equal(links[0].getAttribute('tabindex'), '-1');
  await doc.emit('pointerup');
  stop();
  assert.equal(grid.classList.contains('project-deck'), false);
  assert.equal(cards[2].getAttribute('role'), null);
  assert.equal(links[0].getAttribute('tabindex'), null);
  desktop.matches = true;
  await desktop.emit('change');
  assert.equal(
    grid.classList.contains('project-desktop'),
    false,
    'Route cleanup removes the media listener',
  );
});

test('web project cards open with one desktop/tablet click or two phone taps and retain keyboard links', async () => {
  for (const width of [390, 699, 700, 744, 768, 820, 1280]) {
    const isDesktop = width >= 700;
    const shell = new Element(),
      grid = new Element(),
      doc = new Element();
    const cards = projects.map((project) => {
      const card = new Element();
      card.nodes = new Map([['h3', { textContent: project.name }]]);
      if (project.url) {
        card.setAttribute('href', project.url);
        card.setAttribute('aria-label', `${project.name} website`);
      }
      return card;
    });
    shell.nodes = new Map([['.project-grid', grid]]);
    grid.querySelectorAll = () => cards;
    doc.querySelectorAll = () => [shell];
    const desktop = Object.assign(new Element(), { matches: isDesktop });
    const win = new Element();
    win.matchMedia = (query) => {
      desktop.matches = width >= Number(query.match(/min-width:\s*(\d+)/)[1]);
      return desktop;
    };
    const api = await load(
      'project-deck.js',
      { document: doc, window: win, AbortController, performance },
      'enableRobinerProjectDeck',
    );
    const stop = api.enableRobinerProjectDeck();
    for (let index = 0; index < 2; index++) {
      const click = await cards[index].emit('click', { button: 0 });
      assert.equal(
        click.defaultPrevented,
        !isDesktop,
        'Phone first tap selects; desktop opens immediately',
      );
      if (!isDesktop) {
        assert.equal(cards[index].dataset.deckSlot, 'center');
        const second = await cards[index].emit('click', { button: 0 });
        assert.equal(
          second.defaultPrevented,
          false,
          'Second phone tap keeps native target-blank navigation',
        );
      }
      const enter = await cards[index].emit('keydown', { key: 'Enter' });
      assert.equal(enter.defaultPrevented, false, 'Native keyboard navigation is preserved');
      const keyboardClick = await cards[index].emit('click', { button: 0, detail: 0 });
      assert.equal(
        keyboardClick.defaultPrevented,
        false,
        'Enter must not require a second activation',
      );
      assert.equal(cards[index].getAttribute('href'), projects[index].url);
      assert.equal(
        cards[index].getAttribute('role'),
        null,
        'A native link must retain link semantics',
      );
    }
    const hardwareClick = await cards[2].emit('click', { button: 0 });
    assert.equal(hardwareClick.defaultPrevented, !isDesktop);
    assert.equal(cards[2].getAttribute('href'), null);
    stop();
    assert.equal(cards[0].getAttribute('aria-label'), `${projects[0].name} website`);
  }
});

async function swipeDeck(isDesktop = false) {
  const shell = new Element(),
    grid = new Element(),
    doc = new Element(),
    win = new Element();
  const cards = projects.map((project) => {
    const card = new Element();
    card.nodes = new Map([['h3', { textContent: project.name }]]);
    if (project.url) card.setAttribute('href', project.url);
    return card;
  });
  shell.nodes = new Map([['.project-grid', grid]]);
  grid.querySelectorAll = () => cards;
  doc.querySelectorAll = () => [shell];
  const desktop = Object.assign(new Element(), { matches: isDesktop });
  win.matchMedia = () => desktop;
  let now = 1000;
  const api = await load(
    'project-deck.js',
    {
      document: doc,
      window: win,
      AbortController,
      performance: { now: () => now },
    },
    'enableRobinerProjectDeck',
  );
  const stop = api.enableRobinerProjectDeck();
  const pointer = { pointerId: 1, pointerType: 'touch', isPrimary: true, button: 0 };
  return {
    cards,
    grid,
    doc,
    win,
    desktop,
    stop,
    pointer,
    advance: (ms) => {
      now += ms;
    },
    async swipe(dx, dy = 0, pointerType = 'touch') {
      const event = { ...pointer, pointerType };
      await grid.emit('pointerdown', { ...event, clientX: 150, clientY: 100 });
      const move = await grid.emit('pointermove', {
        ...event,
        clientX: 150 + dx,
        clientY: 100 + dy,
      });
      await doc.emit('pointerup', { ...event, clientX: 150 + dx, clientY: 100 + dy });
      return move;
    },
  };
}

test('phone swipes cycle all three cards in either direction and suppress the resulting link click', async () => {
  const h = await swipeDeck();
  assert.equal((await h.swipe(-80)).defaultPrevented, true);
  assert.equal(h.cards[2].dataset.deckSlot, 'center', 'Left swipe brings the right card forward');
  assert.equal((await h.cards[2].emit('click', { button: 0 })).defaultPrevented, true);
  await h.swipe(-80);
  assert.equal(h.cards[1].dataset.deckSlot, 'center');
  await h.swipe(-80);
  assert.equal(
    h.cards[0].dataset.deckSlot,
    'center',
    'Repeated swipes cycle rather than alternate two cards',
  );
  await h.swipe(80);
  assert.equal(h.cards[1].dataset.deckSlot, 'center');
  await h.grid.emit('pointerdown', { ...h.pointer, clientX: 100, clientY: 100 });
  await h.doc.emit('pointerup', { ...h.pointer, clientX: 100, clientY: 100 });
  assert.equal((await h.cards[1].emit('click', { button: 0 })).defaultPrevented, true);
  h.advance(200);
  assert.equal((await h.cards[1].emit('click', { button: 0 })).defaultPrevented, false);
  const previous = h.cards.map((card) => card.dataset.deckSlot);
  h.stop();
  await h.swipe(-80);
  assert.equal(
    h.cards.every((card) => card.dataset.deckSlot === undefined),
    true,
  );
  assert.equal(previous.filter((slot) => slot === 'center').length, 1);
});

test('scrolling, short drags, multi-touch and desktop drags never rotate or activate a project', async () => {
  const h = await swipeDeck();
  assert.equal((await h.swipe(8, 90)).defaultPrevented, false, 'Vertical scrolling remains native');
  assert.equal(h.cards[0].dataset.deckSlot, 'center');
  await h.swipe(-25);
  assert.equal(h.cards[0].dataset.deckSlot, 'center', 'Short drags do not swap');
  await h.swipe(-80, 0, 'mouse');
  assert.equal(h.cards[0].dataset.deckSlot, 'center', 'Mouse drags do not enable phone swipes');
  await h.grid.emit('pointerdown', { ...h.pointer, clientX: 150, clientY: 100 });
  await h.grid.emit('pointerdown', {
    ...h.pointer,
    pointerId: 2,
    isPrimary: false,
    clientX: 150,
    clientY: 100,
  });
  await h.doc.emit('pointerup', { ...h.pointer, clientX: 50, clientY: 100 });
  assert.equal(h.cards[0].dataset.deckSlot, 'center');
  await h.doc.emit('pointercancel', h.pointer);
  assert.equal((await h.cards[0].emit('click', { button: 0 })).defaultPrevented, true);
  h.stop();
  const desktop = await swipeDeck(true);
  assert.equal((await desktop.swipe(-80)).defaultPrevented, false);
  assert.equal((await desktop.cards[0].emit('click', { button: 0 })).defaultPrevented, false);
  desktop.stop();
});

test('phone double taps expire and never combine taps on different cards', async () => {
  const h = await swipeDeck();
  assert.equal((await h.cards[0].emit('click', { button: 0 })).defaultPrevented, true);
  h.advance(500);
  assert.equal((await h.cards[0].emit('click', { button: 0 })).defaultPrevented, true);
  h.advance(100);
  assert.equal((await h.cards[1].emit('click', { button: 0 })).defaultPrevented, true);
  assert.equal(h.cards[1].dataset.deckSlot, 'center');
  h.advance(100);
  assert.equal((await h.cards[1].emit('click', { button: 0 })).defaultPrevented, false);
  h.stop();
});

test('gallery removes thumbnails while retaining its bounded region', () => {
  const trail = renderPixelGallery(gallery, String);
  assert.match(trail, /data-pixel-gallery/);
  assert.doesNotMatch(trail, /data-gallery-photo|pixel-gallery-choices/);
  assert.match(trail, /gallery-video-track/);
  assert.match(trail, /gallery-video-viewport/);
  assert.equal((trail.match(/<video /g) || []).length, 4);
  assert.match(trail, /data-gallery-video-copy muted/);
  assert.doesNotMatch(trail, /data-gallery-motion|Pause video|Mute sound/);
});

test('hover photos reach the gallery canvas below the shorter video strip', async () => {
  const root = new Element(), layer = new Element(), doc = new Element(), reduced = new Element();
  root.getBoundingClientRect = () => ({ left: 0, top: 0, width: 900, height: 560 });
  root.nodes = new Map([['.pixel-gallery-layer', layer]]);
  doc.querySelector = () => root;
  doc.createElement = () => new Element();
  doc.hidden = false;
  reduced.matches = false;
  class LoadedImage { set src(value) { this.onload(); } }
  const api = await load('pixel-gallery.js', {
    document: doc, matchMedia: () => reduced, AbortController, Image: LoadedImage,
    performance: { now: () => 1000 }, ...clock(),
  }, 'enablePixelGallery');
  const stop = api.enablePixelGallery([{ image: '/photo.jpg' }]);
  await root.emit('pointerenter', { pointerType: 'mouse', clientX: 450, clientY: 550 });
  assert.equal(layer.children.length, 1);
  const photo = layer.children[0];
  assert.equal(parseFloat(photo.style.top) + parseFloat(photo.style.height), 560,
    'Photo extends to the gallery bottom, beyond the centered 300px video ending at 430px');
  stop();
  assert.equal(layer.children.length, 0);
});

test('gallery double taps toggle video without opening a photo, while a single tap still opens it', async () => {
  const root=new Element(), layer=new Element(), doc=new Element(), reduced=new Element();
  root.nodes=new Map([['.pixel-gallery-layer',layer]]);doc.querySelector=()=>root;
  doc.createElement=()=>new Element();doc.hidden=false;reduced.matches=false;
  const timers=clock();let now=1000,toggles=0;const opens=[];
  class LoadedImage{set src(value){this.onload();}}
  const api=await load('pixel-gallery.js',{document:doc,matchMedia:()=>reduced,AbortController,Image:LoadedImage,performance:{now:()=>now},...timers},'enablePixelGallery');
  const stop=api.enablePixelGallery([{image:'/one.jpg'}],{onOpen:index=>opens.push(index),onDoubleTap:()=>toggles++});
  const tap=async(x=200,y=150)=>{await root.emit('pointerdown',{clientX:x,clientY:y,pointerType:'touch'});await root.emit('pointerup',{clientX:x,clientY:y,pointerType:'touch'});};
  await tap();assert.equal(opens.length,0);
  now+=160;await tap();assert.equal(toggles,1);assert.equal(opens.length,0);
  assert.equal([...timers.timers.values()].filter(timer=>timer.delay===320).length,0);
  now+=500;await tap();const [key,pending]=[...timers.timers.entries()].find(([,timer])=>timer.delay===320);timers.timers.delete(key);pending.callback();assert.equal(opens.length,1);
  root.closest=()=>({});now+=500;await tap();assert.equal(toggles,1,'speaker control taps never toggle or open a photo');
  stop();assert.equal(timers.timers.size,0);
});

test('phone trail remains inside its gallery, bounds active images and supports viewing', async () => {
  const root = new Element();
  const layer = new Element();
  root.nodes = new Map([['.pixel-gallery-layer', layer]]);
  const choices = [new Element(), new Element()];
  choices.forEach((button, index) => {
    button.dataset.galleryPhoto = String(index);
  });
  const doc = new Element();
  doc.hidden = false;
  doc.querySelector = () => root;
  doc.querySelectorAll = () => choices;
  doc.createElement = () => new Element();
  const reduced = new Element();
  reduced.matches = false;
  const timers = clock();
  const opens = [];
  class LoadedImage {
    set src(value) {
      this.onload();
    }
  }
  const api = await load(
    'pixel-gallery.js',
    {
      document: doc,
      matchMedia: () => reduced,
      AbortController,
      Image: LoadedImage,
      ...timers,
    },
    'enablePixelGallery',
  );
  const stop = api.enablePixelGallery([{ image: '/one.jpg' }, { image: '/two.jpg' }], {
    onOpen: (index) => opens.push(index),
  });
  for (let index = 0; index < 12; index++) {
    await root.emit('pointerdown', { pointerType: 'touch', clientX: 490, clientY: 380 });
  }
  assert.equal(layer.children.length, 6);
  layer.children.forEach((image) => {
    assert.ok(parseFloat(image.style.left) >= 0);
    assert.ok(parseFloat(image.style.top) >= 0);
    assert.ok(parseFloat(image.style.left) + parseFloat(image.style.width) <= 390);
    assert.ok(parseFloat(image.style.top) + parseFloat(image.style.height) <= 330);
    assert.equal(image.children.length, 5);
  });
  await root.emit('pointerdown', { pointerType: 'touch', clientX: 230, clientY: 220 });
  await root.emit('pointerup', { pointerType: 'touch', clientX: 230, clientY: 220 });
  assert.equal(opens.length, 1);
  await root.emit('pointerdown', { pointerType: 'touch', clientX: 230, clientY: 220 });
  await root.emit('pointerup', { pointerType: 'touch', clientX: 270, clientY: 220 });
  assert.equal(opens.length, 1, 'swiping must not open the viewer');
  await root.emit('pointerleave');
  assert.equal(timers.frames.size, 0);
  doc.hidden = true;
  await doc.emit('visibilitychange');
  assert.equal(layer.children.length, 0);
  assert.equal(timers.timers.size, 0);
  stop();
  assert.equal(timers.frames.size, 0);
});
