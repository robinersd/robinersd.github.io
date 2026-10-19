import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveChatEndpoint, requestChatReply } from '../site/assets/chat-api.js';
import chat from '../site/api/chat.js';

test('GitHub Pages uses the Vercel backend while Vercel and local previews use their own API', () => {
  assert.equal(
    resolveChatEndpoint({ hostname: 'robinersd.github.io' }),
    'https://robinersd.vercel.app/api/chat',
  );
  for (const hostname of [
    'robinersd.vercel.app',
    'localhost',
    '127.0.0.1',
    '192.168.100.36',
    'other.github.io',
  ])
    assert.equal(resolveChatEndpoint({ hostname }), '/api/chat');
});

test('chat transport sends messages to the backend without secrets or credentials', async () => {
  const originalFetch = globalThis.fetch;
  const previousLocation = globalThis.location;
  globalThis.location = { hostname: 'robinersd.github.io' };
  globalThis.fetch = async (url, options) => {
    assert.equal(url, 'https://robinersd.vercel.app/api/chat');
    assert.equal(options.credentials, 'omit');
    assert.equal(options.headers.Authorization, undefined);
    assert.deepEqual(JSON.parse(options.body), {
      messages: [{ role: 'user', content: 'Hello' }],
      attachments: [],
    });
    return Response.json({ reply: 'A helpful answer.' });
  };
  try {
    assert.deepEqual(await requestChatReply([{ role: 'user', content: 'Hello' }], []), {
      reply: 'A helpful answer.',
    });
  } finally {
    globalThis.fetch = originalFetch;
    if (previousLocation === undefined) delete globalThis.location;
    else globalThis.location = previousLocation;
  }
});

test('HTML pages, malformed JSON and network failures never display raw parse errors', async () => {
  const originalFetch = globalThis.fetch;
  try {
    for (const response of [
      new Response('<html>404 Not Found</html>', {
        status: 404,
        headers: { 'content-type': 'text/html' },
      }),
      new Response('<html>Wrong body</html>', { headers: { 'content-type': 'application/json' } }),
      Response.json({ reply: '' }),
    ]) {
      globalThis.fetch = async () => response;
      await assert.rejects(
        () => requestChatReply([], []),
        (error) => {
          assert.match(error.message, /temporarily unavailable/);
          assert.doesNotMatch(error.message, /Unexpected token|<html>|valid JSON/);
          return true;
        },
      );
    }
    globalThis.fetch = async () => {
      throw new TypeError('Failed to fetch');
    };
    await assert.rejects(() => requestChatReply([], []), /temporarily unavailable/);
    globalThis.fetch = async () =>
      Response.json({ error: 'The assistant is busy. Please try again later.' }, { status: 429 });
    await assert.rejects(() => requestChatReply([], []), /assistant is busy/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

async function corsRequest(origin, method = 'POST') {
  const headers = new Map();
  let status, payload;
  const response = {
    setHeader(name, value) {
      headers.set(name, value);
    },
    status(code) {
      status = code;
      return this;
    },
    json(value) {
      payload = value;
      return this;
    },
    end() {
      return this;
    },
  };
  await chat(
    {
      method,
      headers: { origin, host: 'robinersd.vercel.app' },
      body: { messages: [{ role: 'user', content: 'What are Robiner’s skills?' }] },
    },
    response,
  );
  return { headers, status, payload };
}

test('Vercel API accepts GitHub Pages preflight and public questions without exposing backend keys', async () => {
  const previous = process.env.XKIRO_API_KEY;
  delete process.env.XKIRO_API_KEY;
  try {
    const preflight = await corsRequest('https://robinersd.github.io', 'OPTIONS');
    assert.equal(preflight.status, 204);
    assert.equal(
      preflight.headers.get('Access-Control-Allow-Origin'),
      'https://robinersd.github.io',
    );
    assert.equal(preflight.headers.get('Access-Control-Allow-Methods'), 'POST, OPTIONS');
    assert.equal(preflight.headers.get('Access-Control-Allow-Credentials'), undefined);
    const answer = await corsRequest('https://robinersd.github.io');
    assert.equal(answer.status, 200);
    assert.match(answer.payload.reply, /TypeScript.*React/s);
    assert.equal(answer.headers.get('Vary'), 'Origin');
    assert.equal((await corsRequest('https://robinersd.vercel.app')).status, 200);
  } finally {
    if (previous === undefined) delete process.env.XKIRO_API_KEY;
    else process.env.XKIRO_API_KEY = previous;
  }
});

test('untrusted cross-origin requests and preflights are rejected', async () => {
  for (const origin of [
    'https://attacker.example',
    'https://robinersd.github.io.evil.example',
    'null',
    'https://robinersd.github.io/path',
  ]) {
    for (const method of ['POST', 'OPTIONS']) {
      const result = await corsRequest(origin, method);
      assert.equal(result.status, 403, origin);
      assert.equal(result.headers.get('Access-Control-Allow-Origin'), undefined);
    }
  }
});
