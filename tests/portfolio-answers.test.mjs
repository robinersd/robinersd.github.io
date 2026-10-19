import { test } from 'node:test';
import assert from 'node:assert/strict';
import chat from '../site/api/chat.js';
import { getPortfolioAnswer, portfolioUnavailableReply } from '../site/assets/portfolio-answers.js';
import { profile, projects } from '../site/assets/data.js';

test('public resume answers cover the reported skills and AlagaTrack failures without AI', () => {
  for (const question of [
    'What are Robiner’s skills?',
    'Anong skills niya?',
    'What skills are listed in the resume?',
  ]) {
    const reply = getPortfolioAnswer(question);
    for (const fact of ['TypeScript', 'React', 'Basic Circuit Design', 'Technical Documentation'])
      assert.ok(reply.includes(fact), fact);
    assert.doesNotMatch(reply, /not connected|activate the resume/i);
  }
  const project = getPortfolioAnswer('Tell me about AlagaTrack');
  assert.match(project, /Community Health Worker Management System/);
  assert.match(project, /Programmer \/ Full-Stack Developer/);
  assert.match(project, /Aug 2025 – Dec 2026/);
  assert.ok(project.includes(projects[0].url));
});

test('education, roles, strengths, awards and contact remain grounded in public source data', () => {
  assert.match(
    getPortfolioAnswer('Where does Robiner study?'),
    /ICCT Colleges.*Computer Engineering/s,
  );
  assert.match(getPortfolioAnswer('Ano ang soft skills niya?'), /Teamwork.*Critical Thinking/);
  assert.match(getPortfolioAnswer('What is his career interest?'), /Software Development/);
  assert.match(
    getPortfolioAnswer('What awards does he have?'),
    /Top 8 Student.*Object-Oriented Programming/,
  );
  assert.match(
    getPortfolioAnswer('What did he do for Medicare?'),
    /Documentation Lead.*system architecture/s,
  );
  assert.match(getPortfolioAnswer('What did he do for StreetWear?'), /testing, debugging.*Vercel/s);
  assert.ok(getPortfolioAnswer('How can I contact him?').includes(profile.email));
  assert.match(getPortfolioAnswer('Tell me about his resume'), /ICCT Colleges.*AlagaTrack/s);
  assert.match(getPortfolioAnswer('Does he know React?'), /React/);
});

test('follow-up stack and dates refer to the project while global questions stay global', () => {
  const history = [{ role: 'user', content: 'Tell me about AlagaTrack' }];
  assert.match(
    getPortfolioAnswer('What database does it use?', { history }),
    /PostgreSQL via Supabase/,
  );
  assert.match(
    getPortfolioAnswer('When was it finished?', { history }),
    /Exact launch dates and exact completion days have not been provided/,
  );
  const global = getPortfolioAnswer('What projects does Robiner have?', { history });
  for (const project of projects) assert.ok(global.includes(project.name));
  assert.match(global, /not verified employment positions/);
  assert.match(getPortfolioAnswer('What are his skills?', { history }), /Basic Circuit Design/);
});

test('missing details stay missing and normal answers never grant resume access', () => {
  assert.match(getPortfolioAnswer('What is his GPA?'), /isn't included/);
  assert.equal(getPortfolioAnswer('Please give me a recipe for soup'), null);
  assert.equal(getPortfolioAnswer(''), null);
  assert.equal(getPortfolioAnswer('activate the resume'), null);
  assert.equal(getPortfolioAnswer('How do I activate the resume?'), null);
  assert.doesNotMatch(getPortfolioAnswer('What are his skills?'), /activate|unlock/i);
  assert.match(
    getPortfolioAnswer('Where can I visit Medicare live site?'),
    /no public live-site URL/,
  );
});

async function request(content, { attachments = [], method = 'POST', origin } = {}) {
  let status, payload;
  const response = {
    setHeader() {},
    status(code) {
      status = code;
      return this;
    },
    json(value) {
      payload = value;
      return this;
    },
  };
  await chat(
    {
      method,
      headers: { host: 'example.com', ...(origin ? { origin } : {}) },
      body: { messages: [{ role: 'user', content }], attachments },
    },
    response,
  );
  return { status, payload };
}

test('server answers public questions without a provider and keeps validation and media limits', async () => {
  const original = globalThis.fetch;
  const previous = process.env.XKIRO_API_KEY;
  delete process.env.XKIRO_API_KEY;
  globalThis.fetch = async () => {
    throw new Error('The offline FAQ must not call a provider');
  };
  try {
    for (const question of [
      'What are Robiner’s skills?',
      'Tell me about AlagaTrack',
      'What college does he attend?',
    ]) {
      const result = await request(question);
      assert.equal(result.status, 200);
      assert.equal(result.payload.reply, getPortfolioAnswer(question));
      assert.equal(result.payload.resumeActivated, undefined);
    }
    assert.equal(
      (await request('A detail not listed anywhere')).payload.reply,
      portfolioUnavailableReply,
    );
    assert.equal((await request('hello', { method: 'GET' })).status, 405);
    assert.equal((await request('hello', { origin: 'https://other.example' })).status, 403);
    assert.equal((await request('x'.repeat(1501))).status, 400);
    assert.equal(
      (await request('What are his skills?', { attachments: [{ type: 'image', data: 'invalid' }] }))
        .status,
      400,
    );
    assert.equal((await request('activate the resume')).payload.resumeActivated, true);
  } finally {
    globalThis.fetch = original;
    if (previous === undefined) delete process.env.XKIRO_API_KEY;
    else process.env.XKIRO_API_KEY = previous;
  }
});

test('provider outages and rate limits fall back to facts while configured AI still receives resume context', async () => {
  const original = globalThis.fetch;
  const previous = process.env.XKIRO_API_KEY;
  process.env.XKIRO_API_KEY = 'test-placeholder';
  try {
    for (const failure of [429, 401, 500, 'offline', 'empty']) {
      globalThis.fetch = async () => {
        if (failure === 'offline') throw new Error('network unavailable');
        return {
          ok: failure === 'empty',
          status: failure === 'empty' ? 200 : failure,
          json: async () => ({}),
        };
      };
      const response = await request('Tell me about AlagaTrack');
      assert.equal(response.status, 200);
      assert.match(response.payload.reply, /Community Health Worker Management System/);
      assert.doesNotMatch(response.payload.reply, /test-placeholder|network unavailable/);
    }
    globalThis.fetch = async (url, options) => {
      const body = JSON.parse(options.body);
      assert.match(body.messages[0].content, /Basic Circuit Design/);
      assert.match(body.messages[0].content, /system architecture, hardware components/);
      return {
        ok: true,
        status: 200,
        json: async () => ({ choices: [{ message: { content: 'Grounded AI answer.' } }] }),
      };
    };
    assert.equal(
      (await request('Tell me about his portfolio')).payload.reply,
      'Grounded AI answer.',
    );
  } finally {
    globalThis.fetch = original;
    if (previous === undefined) delete process.env.XKIRO_API_KEY;
    else process.env.XKIRO_API_KEY = previous;
  }
});
