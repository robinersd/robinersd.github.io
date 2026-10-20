import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import { chatIntro, chatFarewell, resumeClue } from '../site/assets/data.js';
import { isResumeActivation, isResumeActivationQuestion } from '../site/assets/resume-command.js';
import { getPortfolioAnswer, portfolioUnavailableReply } from '../site/assets/portfolio-answers.js';
import { isCasualChat } from '../site/assets/chat-intent.js';

class Element extends EventTarget {
  constructor(tag = 'div') {
    super();
    this.tag = tag;
    this.children = [];
    this.dataset = {};
    this.styles = new Map();
    this.value = '';
    this.hidden = false;
    this.rawText = '';
    this.isConnected = true;
    this.style = {
      setProperty: (key, value) => this.styles.set(key, value),
      removeProperty: (key) => this.styles.delete(key),
    };
    this.classList = { add() {}, toggle() {} };
  }
  async emit(type, props = {}) {
    const event = Object.assign(new Event(type, { cancelable: true }), props);
    this.dispatchEvent(event);
    await new Promise((resolve) => setImmediate(resolve));
  }
  setAttribute() {}
  focus() {}
  append(...children) {
    this.children.push(...children);
  }
  appendChild(child) {
    this.append(child);
  }
  replaceChildren(...children) {
    this.children = children;
    this.rawText = '';
  }
  set textContent(value) {
    this.rawText = value;
    this.children = [];
  }
  get textContent() {
    return this.rawText + this.children.map((child) => child.textContent).join('');
  }
  querySelector(selector) {
    return this.nodes?.get(selector) || null;
  }
  querySelectorAll() {
    return [];
  }
  closest() {
    return this.parent;
  }
  getBoundingClientRect() {
    return { left: this.left || 0, width: 54, height: 58 };
  }
}
function animationClock() {
  let id = 0;
  const tasks = new Map();
  return {
    tasks,
    requestAnimationFrame: (callback) => {
      tasks.set(++id, callback);
      return id;
    },
    cancelAnimationFrame: (key) => tasks.delete(key),
    advance(time) {
      const pending = [...tasks.values()];
      tasks.clear();
      pending.forEach((callback) => callback(time));
    },
  };
}
async function load(file, environment, exports) {
  const source = (await fs.readFile(new URL(`../site/assets/${file}`, import.meta.url), 'utf8'))
    .replace(/^import[\s\S]*?;\s*/gm, '')
    .replaceAll('export function', 'function');
  const context = vm.createContext(environment);
  vm.runInContext(source + `\nglobalThis.api = { ${exports} };`, context);
  return context.api;
}

test('dock magnifies near the pointer, resets on touch release and cleans up', async () => {
  const dock = new Element();
  const items = [new Element(), new Element(), new Element()];
  items.forEach((item, index) => {
    item.left = index * 64;
  });
  dock.querySelectorAll = () => items;
  const doc = new Element();
  doc.querySelector = () => dock;
  const win = new Element();
  const reduced = new Element();
  reduced.matches = false;
  const api = await load(
    'social-dock.js',
    { document: doc, window: win, matchMedia: () => reduced, AbortController },
    'enableSocialDock',
  );
  const stop = api.enableSocialDock();
  await dock.emit('pointermove', { pointerType: 'mouse', clientX: 27 });
  assert.ok(
    Number(items[0].styles.get('--dock-scale')) > Number(items[1].styles.get('--dock-scale')),
  );
  await dock.emit('pointerleave');
  assert.equal(items[0].styles.size, 0);
  await items[1].emit('pointerdown', { pointerType: 'touch' });
  assert.ok(Number(items[1].styles.get('--dock-scale')) > 1);
  await doc.emit('pointerup');
  assert.equal(items[1].styles.size, 0);
  stop();
  await dock.emit('pointermove', { pointerType: 'mouse', clientX: 27 });
  assert.equal(items[0].styles.size, 0);
});

test('encrypted name restores the exact name and stops when hidden/reduced', async () => {
  const heading = new Element();
  const segments = [new Element(), new Element()];
  segments[0].dataset.encryptedText = 'Robiner B. Dahap ';
  segments[1].dataset.encryptedText = 'Jr.';
  segments.forEach((segment) => {
    segment.textContent = segment.dataset.encryptedText;
  });
  heading.querySelectorAll = () => segments;
  const doc = new Element();
  doc.hidden = false;
  doc.querySelector = () => heading;
  doc.createElement = () => new Element();
  const reduced = new Element();
  reduced.matches = false;
  const clock = animationClock();
  const api = await load(
    'encrypted-name.js',
    { document: doc, matchMedia: () => reduced, AbortController, ...clock },
    'enableEncryptedName',
  );
  const stop = api.enableEncryptedName();
  clock.advance(0);
  assert.notEqual(segments.map((segment) => segment.textContent).join(''), 'Robiner B. Dahap Jr.');
  clock.advance(1500);
  assert.equal(segments.map((segment) => segment.textContent).join(''), 'Robiner B. Dahap Jr.');
  assert.equal(clock.tasks.size, 0);
  await heading.emit('pointerenter', { pointerType: 'mouse' });
  doc.hidden = true;
  await doc.emit('visibilitychange');
  assert.equal(clock.tasks.size, 0);
  assert.equal(segments[0].textContent, 'Robiner B. Dahap ');
  doc.hidden = false;
  reduced.matches = true;
  await reduced.emit('change');
  await heading.emit('pointerenter', { pointerType: 'mouse' });
  assert.equal(clock.tasks.size, 0);
  stop();
});

test('phone name waits until visible, supports touch and click, then cleans up', async () => {
  const heading = new Element();
  const segment = new Element();
  segment.dataset.encryptedText = 'Robiner Dahap';
  segment.textContent = segment.dataset.encryptedText;
  heading.querySelectorAll = () => [segment];
  const doc = new Element();
  doc.hidden = false;
  doc.querySelector = () => heading;
  doc.createElement = () => new Element();
  const reduced = new Element();
  reduced.matches = false;
  const clock = animationClock();
  let visibilityCallback;
  let disconnected = false;
  class VisibilityObserver {
    constructor(callback) {
      visibilityCallback = callback;
    }
    observe(element) {
      assert.equal(element, heading);
    }
    disconnect() {
      disconnected = true;
    }
  }
  const api = await load(
    'encrypted-name.js',
    {
      document: doc,
      matchMedia: (query) => (query === '(hover: none)' ? { matches: true } : reduced),
      AbortController,
      IntersectionObserver: VisibilityObserver,
      ...clock,
    },
    'enableEncryptedName',
  );
  const stop = api.enableEncryptedName();
  assert.equal(clock.tasks.size, 0);
  visibilityCallback([{ isIntersecting: false }]);
  assert.equal(clock.tasks.size, 0);
  visibilityCallback([{ isIntersecting: true }]);
  clock.advance(0);
  clock.advance(50);
  assert.notEqual(segment.textContent, 'Robiner Dahap');
  clock.advance(1500);
  assert.equal(segment.textContent, 'Robiner Dahap');
  await heading.emit('pointerup', { pointerType: 'touch' });
  assert.equal(clock.tasks.size, 1);
  clock.advance(1600);
  clock.advance(3000);
  assert.equal(segment.textContent, 'Robiner Dahap');
  await heading.emit('click');
  assert.equal(clock.tasks.size, 1);
  stop();
  assert.equal(clock.tasks.size, 0);
  assert.ok(disconnected);
  await heading.emit('pointerup', { pointerType: 'touch' });
  assert.equal(clock.tasks.size, 0);
});

test('stars are bounded on phones and stop after visibility/navigation changes', async () => {
  const canvas = new Element('canvas');
  let dots = 0;
  const context = {
    setTransform() {},
    clearRect() {
      dots = 0;
    },
    beginPath() {},
    arc() {
      dots++;
    },
    fill() {},
    moveTo() {},
    lineTo() {},
    stroke() {},
    createLinearGradient() {
      return { addColorStop() {} };
    },
  };
  canvas.getContext = () => context;
  const doc = new Element();
  doc.hidden = false;
  doc.documentElement = { dataset: { theme: 'dark' } };
  doc.querySelector = () => canvas;
  const win = new Element();
  Object.assign(win, { innerWidth: 390, innerHeight: 844, devicePixelRatio: 3 });
  const reduced = new Element();
  reduced.matches = false;
  const clock = animationClock();
  const api = await load(
    'home-stars.js',
    {
      document: doc,
      window: win,
      matchMedia: () => reduced,
      AbortController,
      performance: { now: () => 0 },
      ...clock,
    },
    'enableHomeStars',
  );
  const stop = api.enableHomeStars();
  assert.equal(canvas.width, 585);
  assert.ok(dots >= 35 && dots <= 85);
  assert.equal(clock.tasks.size, 1);
  clock.advance(1600);
  doc.hidden = true;
  await doc.emit('visibilitychange');
  assert.equal(clock.tasks.size, 0);
  doc.hidden = false;
  await doc.emit('visibilitychange');
  assert.equal(clock.tasks.size, 1);
  reduced.matches = true;
  await reduced.emit('change');
  assert.equal(clock.tasks.size, 0);
  stop();
  reduced.matches = false;
  await reduced.emit('change');
  assert.equal(clock.tasks.size, 0);
});

test('sidebar stars render and clean up on navigation or visibility changes', async () => {
  const canvas = new Element();
  let dots = 0;
  const context = {
    setTransform() {},
    clearRect() {
      dots = 0;
    },
    beginPath() {},
    arc() {
      dots++;
    },
    fill() {},
    moveTo() {},
    lineTo() {},
    stroke() {},
    createLinearGradient() {
      return { addColorStop() {} };
    },
  };
  canvas.getContext = () => context;
  canvas.closest = () => ({ clientWidth: 220, clientHeight: 900 });
  const doc = new Element();
  doc.hidden = false;
  doc.documentElement = { dataset: { theme: 'dark' } };
  doc.querySelector = (selector) => (selector === '[data-sidebar-stars]' ? canvas : null);
  const win = new Element();
  Object.assign(win, { innerWidth: 1200, innerHeight: 900, devicePixelRatio: 1 });
  const reduced = new Element();
  reduced.matches = false;
  const clock = animationClock();
  const api = await load(
    'home-stars.js',
    {
      document: doc,
      window: win,
      matchMedia: () => reduced,
      AbortController,
      performance: { now: () => 0 },
      ...clock,
    },
    'enableSidebarStars, renderSidebarStars',
  );
  assert.equal(
    api.renderSidebarStars(),
    '<div class="sidebar-stars" aria-hidden="true"><canvas data-sidebar-stars></canvas></div>',
  );
  const stop = api.enableSidebarStars();
  assert.equal(canvas.width, 220);
  assert.ok(dots >= 15 && dots <= 50);
  assert.equal(clock.tasks.size, 1);
  stop();
  assert.equal(clock.tasks.size, 0);
});

test('custom intro/follow-up never sends a clue without a resume activation question', async () => {
  const nodes = new Map();
  for (const selector of [
    '#robiner-chat-launcher',
    '#robiner-chat-panel',
    'form',
    '#robiner-chat-input',
    '.chat-send',
    '.chat-log',
    '.chat-reset',
    '.chat-status',
    '.chat-emoji-toggle',
    '.chat-emoji-picker',
    '.chat-assistant',
    '.chat-close',
  ])
    nodes.set(selector, new Element());
  const panel = nodes.get('#robiner-chat-panel');
  panel.nodes = nodes;
  nodes.forEach((node) => {
    node.nodes = nodes;
  });
  const log = nodes.get('.chat-log');
  nodes.get('.chat-assistant').textContent = 'Hello';
  log.append(nodes.get('.chat-assistant'));
  panel.parent = new Element();
  const doc = new Element();
  doc.querySelector = (selector) => nodes.get(selector);
  doc.createElement = () => new Element();
  doc.documentElement = { style: { setProperty() {} } };
  const media = {
    ready: true,
    canFinish: false,
    hasAttachments: false,
    snapshot: () => [],
    clear() {},
    setBusy() {},
    stop() {},
  };
  const pauses = [];
  let holdThinking = false;
  const heldReplies = [];
  let activations = 0;
  const requests = [];
  const api = await load(
    'chat.js',
    {
      document: doc,
      window: Object.assign(new Element(), { innerHeight: 844 }),
      matchMedia: () => ({ matches: false }),
      enableChatAttachments: () => media,
      createVoicePlayer: () => new Element(),
      chatIntro,
      chatFarewell,
      getPortfolioAnswer,
      portfolioUnavailableReply,
      isCasualChat,
      resumeClue,
      isResumeActivation,
      isResumeActivationQuestion,
      activateResume: () => activations++,
      AbortController,
      clearTimeout() {},
      setTimeout(callback, delay) {
        pauses.push(delay);
        if (delay === 3000) {
          if (holdThinking && panel.dataset.chatPhase === 'answer-thinking')
            heldReplies.push(callback);
          else callback();
        }
        return 1;
      },
      async requestChatReply(messages, attachments) {
        requests.push({ messages, attachments });
        return { reply: 'Project answer' };
      },
    },
    'enableRobinerChat',
  );
  api.enableRobinerChat();
  nodes.get('#robiner-chat-input').value = 'Hello';
  await nodes.get('form').emit('submit');
  assert.deepEqual(
    log.children.map((item) => item.textContent),
    ['Hello', 'Hello', ...chatIntro],
  );
  assert.deepEqual(pauses, [3000, 3000, 3000]);
  assert.equal(log.textContent.includes(resumeClue), false);
  nodes.get('#robiner-chat-input').value = 'Hindi naman';
  await nodes.get('form').emit('submit');
  assert.equal(log.children.at(-1).textContent, chatFarewell);
  assert.equal(requests.length, 0);
  nodes.get('#robiner-chat-input').value = 'Explain a coding concept';
  await nodes.get('form').emit('submit');
  assert.equal(log.children.at(-1).textContent, 'Project answer');
  assert.equal(requests.length, 1);
  await nodes.get('.chat-reset').emit('click');
  nodes.get('#robiner-chat-input').value = 'Explain a coding concept';
  await nodes.get('form').emit('submit');
  assert.equal(log.children.at(-1).textContent, 'Project answer');
  assert.equal(requests.length, 2, 'Any non-casual question goes to AI immediately on a new chat');
  assert.equal(log.textContent.includes(chatIntro[0]), false);
  await nodes.get('.chat-reset').emit('click');
  nodes.get('#robiner-chat-input').value = 'Hi';
  await nodes.get('form').emit('submit');
  nodes.get('#robiner-chat-input').value = 'What are Robiner’s skills?';
  await nodes.get('form').emit('submit');
  assert.match(log.children.at(-1).textContent, /TypeScript/);
  assert.equal(
    log.textContent.includes(chatFarewell),
    false,
    'A real question after a greeting never receives the scripted farewell',
  );
  nodes.get('#robiner-chat-input').value = 'Tell me about AlagaTrack';
  await nodes.get('form').emit('submit');
  assert.match(log.children.at(-1).textContent, /Community Health Worker/);
  assert.equal(requests.length, 2);
  assert.equal(JSON.stringify(requests[0]).includes(chatFarewell), false);
  nodes.get('#robiner-chat-input').value = 'paano i-activate ang resume?';
  await nodes.get('form').emit('submit');
  assert.equal(log.children.at(-1).textContent, resumeClue);
  assert.equal(requests.length, 2);
  assert.equal(activations, 0);
  nodes.get('#robiner-chat-input').value = 'activate the resume';
  await nodes.get('form').emit('submit');
  assert.equal(activations, 1);
  assert.equal(log.children.at(-1).children.at(-1).href, '/resume');
  await nodes.get('.chat-reset').emit('click');
  nodes.get('#robiner-chat-input').value = 'Hi again';
  await nodes.get('form').emit('submit');
  assert.equal(log.children.at(-1).textContent, chatIntro[2]);
  assert.equal(log.textContent.includes(resumeClue), false);
  await nodes.get('.chat-reset').emit('click');
  nodes.get('#robiner-chat-input').value = 'How do I activate the resume?';
  await nodes.get('form').emit('submit');
  assert.equal(log.children.at(-1).textContent, resumeClue);
  assert.equal(activations, 1, 'help alone does not activate anything');
  await nodes.get('.chat-reset').emit('click');
  holdThinking = true;
  const pausesBeforeSkills = pauses.length;
  nodes.get('#robiner-chat-input').value = 'What are Robiner’s skills?';
  await nodes.get('form').emit('submit');
  assert.equal(nodes.get('.chat-status').textContent, 'Thinking…');
  assert.equal(nodes.get('.chat-send').disabled, true);
  assert.equal(panel.dataset.chatPhase, 'answer-thinking');
  assert.equal(
    log.children.at(-1).textContent,
    'What are Robiner’s skills?',
    'The answer is withheld until the 3-second timer finishes',
  );
  assert.deepEqual(pauses.slice(pausesBeforeSkills), [3000]);
  heldReplies.shift()();
  await new Promise((resolve) => setImmediate(resolve));
  holdThinking = false;
  assert.match(log.children.at(-1).textContent, /TypeScript/);
  assert.match(log.children.at(-1).textContent, /React/);
  assert.equal(requests.length, 2, 'Known resume answers need no API, even as the first question');
  assert.equal(log.textContent.includes(chatFarewell), false);
  nodes.get('#robiner-chat-input').value = 'Tell me about AlagaTrack';
  await nodes.get('form').emit('submit');
  assert.match(log.children.at(-1).textContent, /Community Health Worker/);
  assert.match(log.children.at(-1).textContent, /Aug 2025/);
  assert.equal(requests.length, 2);
  nodes.get('#robiner-chat-input').value = 'single ka ba?';
  await nodes.get('form').emit('submit');
  assert.equal(
    log.children.at(-1).textContent,
    chatIntro[2],
    'Casual chat can start after professional questions',
  );
  nodes.get('#robiner-chat-input').value = 'What education does Robiner have?';
  await nodes.get('form').emit('submit');
  assert.match(log.children.at(-1).textContent, /ICCT Colleges/);
  assert.equal(log.textContent.includes(chatFarewell), false);
  await nodes.get('.chat-reset').emit('click');
  nodes.get('#robiner-chat-input').value = 'taga saan';
  await nodes.get('form').emit('submit');
  assert.equal(log.children.at(-1).textContent, chatIntro[2]);
});
