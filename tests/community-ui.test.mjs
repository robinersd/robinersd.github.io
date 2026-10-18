import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';

class Element {
  nodes = new Map();
  listeners = new Map();
  dataset = {};
  hidden = false;
  value = '';
  textContent = '';
  isConnected = true;
  classes = new Set();
  classList = {
    add: (name) => this.classes.add(name),
    remove: (name) => this.classes.delete(name),
    contains: (name) => this.classes.has(name),
  };
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
  async emit(type, props = {}) {
    const event = { type, target: this, preventDefault() {}, ...props };
    await Promise.all((this.listeners.get(type) || []).map((callback) => callback(event)));
  }
  querySelector(selector) {
    return this.nodes.get(selector) || null;
  }
  querySelectorAll(selector) {
    return this.nodes.get(selector) || [];
  }
  closest() {
    return null;
  }
  focus() {
    this.focused = true;
  }
  showModal() {
    this.open = true;
    this.opens = (this.opens || 0) + 1;
  }
  close() {
    this.open = false;
    return this.emit('close');
  }
}
const stats = { totalVisits: 20, liveVisitors: 2, ratingCount: 4, averageRating: 4.5 };
async function setup({
  values = new Map(),
  enabled = true,
  offline = false,
  constructorFailure = false,
} = {}) {
  const doc = new Element();
  const win = new Element();
  const panel = new Element();
  const footerTotal = new Element();
  const dialog = new Element();
  const form = new Element();
  const thanks = new Element();
  const starGroup = new Element();
  const main = new Element();
  const openButton = new Element();
  const skip = new Element();
  const close = new Element();
  const done = new Element();
  const calls = [];
  const submissions = [];
  const state = {
    offline,
    modalBlock: false,
    chatOpen: false,
    home: true,
    submitFailure: false,
    sidebarOpen: false,
  };
  win.scrollY = 0;
  win.innerHeight = 800;
  win.sessionStorage = {
    getItem: (key) => values.get(key),
    setItem: (key, value) => values.set(key, value),
  };
  doc.documentElement = new Element();
  doc.activeElement = openButton;
  for (const selector of [
    '[data-community-total]',
    '[data-community-live]',
    '[data-community-rating]',
    '[data-community-rating-count]',
    '[data-community-availability]',
  ])
    panel.nodes.set(selector, new Element());
  panel.nodes.set('[data-feedback-open]', openButton);
  for (const selector of ['[name="comment"]', '[name="website"]', '[type="submit"]'])
    form.nodes.set(selector, new Element());
  const radios = [1, 2, 3, 4, 5].map((number) =>
    Object.assign(new Element(), { value: String(number), checked: false }),
  );
  const labels = [1, 2, 3, 4, 5].map((number) =>
    Object.assign(new Element(), { dataset: { ratingValue: String(number) } }),
  );
  form.nodes.set('[name="rating"]', radios);
  form.nodes.set('[data-rating-value]', labels);
  form.nodes.set('.feedback-stars', starGroup);
  dialog.nodes.set('form', form);
  dialog.nodes.set('.feedback-thanks', thanks);
  dialog.nodes.set('.feedback-status', new Element());
  dialog.nodes.set('[data-feedback-close]', [skip, close, done]);
  thanks.nodes.set('button', done);
  main.querySelector = () => (state.home ? new Element() : null);
  main.getBoundingClientRect = () => ({ bottom: 4500 - win.scrollY });
  doc.querySelector = (selector) =>
    ({
      '.community-panel': panel,
      '#portfolio-feedback': dialog,
      '#main': main,
      '#intro': state.home ? new Element() : null,
      '#robiner-chat-panel': { hidden: !state.chatOpen },
      '.portfolio-sidebar.is-mobile-open': state.sidebarOpen ? new Element() : null,
    })[selector] || null;
  doc.querySelectorAll = (selector) =>
    selector === '[data-community-total]'
      ? [panel.querySelector('[data-community-total]'), footerTotal]
      : state.modalBlock
        ? [new Element()]
        : dialog.open
          ? [dialog]
          : [];
  const client = {
    async heartbeat(active, keepalive = false) {
      calls.push({ active, keepalive });
      if (state.offline) throw new Error('network');
      return { stats };
    },
    async submit(rating, comment, website) {
      submissions.push({ rating, comment, website });
      if (state.submitFailure) throw new Error('network');
      return { stats: { ...stats, ratingCount: 5, averageRating: 4.6 } };
    },
  };
  const frames = new Map();
  const timers = new Map();
  let sequence = 0;
  const source = (
    await fs.readFile(new URL('../site/assets/community.js', import.meta.url), 'utf8')
  )
    .replace(/^import[^;]+;\s*/gm, '')
    .replaceAll('export function', 'function');
  const context = vm.createContext({
    document: doc,
    window: win,
    createCommunityClient: () => {
      if (constructorFailure) throw new Error('Secure random source unavailable');
      return enabled ? client : null;
    },
    requestAnimationFrame: (callback) => {
      frames.set(++sequence, callback);
      return sequence;
    },
    cancelAnimationFrame: (id) => frames.delete(id),
    setTimeout: (callback, delay) => {
      timers.set(++sequence, { callback, delay });
      return sequence;
    },
    clearTimeout: (id) => timers.delete(id),
  });
  vm.runInContext(source + '\nglobalThis.enable = enablePortfolioCommunity;', context);
  const controller = context.enable({});
  const settle = () => new Promise((resolve) => setImmediate(resolve));
  const flush = () => {
    const callbacks = [...frames.values()];
    frames.clear();
    callbacks.forEach((callback) => callback());
  };
  await settle();
  flush();
  return {
    doc,
    win,
    panel,
    footerTotal,
    dialog,
    form,
    thanks,
    openButton,
    skip,
    close,
    done,
    radios,
    labels,
    starGroup,
    controller,
    state,
    frames,
    timers,
    calls,
    submissions,
    values,
    settle,
    flush,
    async scroll(y) {
      win.scrollY = y;
      await win.emit('scroll');
      flush();
    },
  };
}

test('automatic feedback appears only after the home-page bottom-to-top journey and once per session', async () => {
  const values = new Map();
  const h = await setup({ values });
  await h.scroll(1200);
  await h.scroll(0);
  assert.equal(h.dialog.open, undefined);
  await h.scroll(3800);
  await h.scroll(500);
  assert.equal(h.dialog.open, undefined);
  await h.scroll(100);
  assert.equal(h.dialog.open, true);
  assert.equal(h.doc.documentElement.classes.has('feedback-open'), true);
  await h.skip.emit('click');
  assert.equal(h.dialog.open, false);
  assert.equal(h.doc.documentElement.classes.has('feedback-open'), false);
  await h.scroll(3800);
  await h.scroll(0);
  assert.equal(h.dialog.opens, 1);
  h.controller.destroy();
  const reloaded = await setup({ values });
  await reloaded.scroll(3800);
  await reloaded.scroll(0);
  assert.equal(
    reloaded.dialog.open,
    undefined,
    'Reloading the same tab/session does not repeat the prompt',
  );
  await reloaded.openButton.emit('click');
  assert.equal(reloaded.dialog.open, true, 'A visitor can deliberately open feedback later');
});

test('feedback waits for existing dialogs/chat, and never interrupts non-home routes', async () => {
  const h = await setup();
  h.state.home = false;
  await h.scroll(3800);
  await h.scroll(0);
  assert.equal(h.dialog.open, undefined);
  h.state.home = true;
  h.controller.refreshRoute();
  h.flush();
  await h.scroll(3800);
  h.state.modalBlock = true;
  await h.scroll(0);
  assert.equal(h.dialog.open, undefined);
  h.state.modalBlock = false;
  h.state.chatOpen = true;
  await h.doc.emit('close');
  h.flush();
  assert.equal(h.dialog.open, undefined);
  h.state.chatOpen = false;
  await h.doc.emit('click');
  h.flush();
  assert.equal(h.dialog.open, true);
  await h.close.emit('click');
  assert.equal(h.dialog.open, false);
});

test('star selection, private comment submission and failure retry retain visitor input', async () => {
  const h = await setup();
  await h.openButton.emit('click');
  await h.form.emit('submit');
  assert.equal(h.submissions.length, 0);
  assert.equal(h.radios[0].focused, true);
  h.radios[4].checked = true;
  h.form.querySelector('[name="comment"]').value = '  Better contrast please  ';
  await h.starGroup.emit('change');
  assert.equal(
    h.labels.every((label) => label.dataset.filled === 'true'),
    true,
  );
  h.state.submitFailure = true;
  await h.form.emit('submit');
  assert.equal(h.form.hidden, false);
  assert.equal(h.form.querySelector('[name="comment"]').value, '  Better contrast please  ');
  h.state.submitFailure = false;
  await h.form.emit('submit');
  assert.deepEqual(h.submissions[1], { rating: 5, comment: 'Better contrast please', website: '' });
  assert.equal(h.form.hidden, true);
  assert.equal(h.thanks.hidden, false);
  assert.equal(h.values.get('robiner.feedback.submitted.v1'), 'true');
  assert.equal(h.panel.querySelector('[data-community-rating]').textContent, '★ 4.6 / 5');
  assert.doesNotMatch(h.panel.querySelector('[data-community-rating]').textContent, /contrast/);
  await h.form.emit('submit');
  assert.equal(h.submissions.length, 2, 'Confirmed feedback cannot submit a second rating');
});

test('presence stops polling in hidden tabs, resumes when visible and cleans up on destroy', async () => {
  const h = await setup();
  assert.equal(h.calls.length, 1);
  assert.equal([...h.timers.values()][0].delay, 25000);
  h.doc.hidden = true;
  await h.doc.emit('visibilitychange');
  await h.settle();
  assert.equal(h.timers.size, 0);
  assert.deepEqual(h.calls.at(-1), { active: false, keepalive: true });
  h.doc.hidden = false;
  await h.doc.emit('visibilitychange');
  await h.settle();
  assert.equal(h.calls.at(-1).active, true);
  h.controller.destroy();
  assert.equal(h.timers.size, 0);
  const before = h.calls.length;
  await h.doc.emit('visibilitychange');
  await h.win.emit('scroll');
  assert.equal(h.calls.length, before);
  assert.equal(h.frames.size, 0);
});

test('disconnected/unconfigured statistics show no invented numbers and do not auto-prompt', async () => {
  for (const options of [{ offline: true }, { enabled: false }]) {
    const h = await setup(options);
    assert.equal(h.panel.querySelector('[data-community-total]').textContent, '—');
    assert.equal(h.footerTotal.textContent, '—');
    await h.scroll(3800);
    await h.scroll(0);
    assert.equal(h.dialog.open, undefined);
    if (options.enabled === false) assert.equal(h.openButton.disabled, true);
  }
});

test('footer and sidebar share the same visitor count and one tracking request', async () => {
  const h = await setup();
  assert.equal(h.panel.querySelector('[data-community-total]').textContent, '20');
  assert.equal(h.footerTotal.textContent, '20');
  assert.equal(h.calls.length, 1);
  h.state.offline = true;
  h.doc.hidden = true;
  await h.doc.emit('visibilitychange');
  await h.settle();
  h.doc.hidden = false;
  await h.doc.emit('visibilitychange');
  await h.settle();
  assert.equal(h.footerTotal.textContent, '—');
  assert.equal(h.panel.querySelector('[data-community-total]').textContent, '—');
  h.controller.destroy();
});

test('the persistent default-open phone sidebar does not suppress the feedback journey', async () => {
  const h = await setup();
  h.state.sidebarOpen = true;
  await h.scroll(3800);
  await h.scroll(0);
  assert.equal(h.dialog.open, true);
  assert.equal(h.dialog.opens, 1);
  await h.close.emit('click');
  await h.scroll(3800);
  await h.scroll(0);
  assert.equal(h.dialog.opens, 1);
  h.controller.destroy();
});

test('unsupported client initialization keeps the page usable with explicit unavailable stats', async () => {
  const h = await setup({ constructorFailure: true });
  assert.equal(h.openButton.disabled, true);
  assert.equal(h.footerTotal.textContent, '—');
  assert.equal(
    h.panel.querySelector('[data-community-availability]').textContent,
    'Visitor statistics are temporarily unavailable.',
  );
  assert.equal(h.calls.length, 0);
  await h.scroll(3800);
  await h.scroll(0);
  assert.equal(h.dialog.open, undefined);
  h.controller.destroy();
});
