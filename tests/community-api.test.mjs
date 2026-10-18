import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import { createCommunityClient } from '../site/assets/community-api.js';
import { createCommunityHandler } from '../supabase/functions/portfolio-community/handler.js';

const origin = 'https://robinersd.vercel.app';
const key = 'sb_publishable_test_only';
const backendKey = 'sb_secret_test_fixture_only';
const sessionId = 'af765742-163d-4d12-8ab1-570f69eaa520';
const otherId = 'bf765742-163d-4d12-8ab1-570f69eaa521';
const stats = { totalVisits: 8, liveVisitors: 2, ratingCount: 4, averageRating: 4.5 };
function setup(fetcher = async () => Response.json({ stats })) {
  return createCommunityHandler({
    url: 'https://example.supabase.co',
    backendKey,
    publishableKeys: [key],
    fetcher,
  });
}
function request(body, overrides = {}) {
  const { headers = {}, method = 'POST', ...rest } = overrides;
  return new Request('https://example.supabase.co/functions/v1/portfolio-community', {
    method,
    headers: { origin, apikey: key, 'content-type': 'application/json', ...headers },
    ...(method === 'GET' || method === 'OPTIONS'
      ? {}
      : { body: typeof body === 'string' ? body : JSON.stringify(body) }),
    ...rest,
  });
}

test('public API returns only aggregate statistics and signed session tokens, never comments or backend keys', async () => {
  const calls = [];
  const handler = setup(async (url, options) => {
    calls.push({ url, ...options });
    return Response.json({
      stats: { ...stats, comment: 'PRIVATE COMMENT', session_id: sessionId },
      comments: ['PRIVATE COMMENT'],
      status: 'ok',
    });
  });
  const response = await handler(request({ action: 'start', sessionId, active: true }));
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('Access-Control-Allow-Origin'), origin);
  const result = await response.json();
  assert.deepEqual(result.stats, stats);
  assert.match(result.token, /^[0-9a-f]{64}$/);
  assert.doesNotMatch(JSON.stringify(result), /PRIVATE COMMENT|sb_secret|session_id/);
  assert.equal(calls[0].headers.apikey, backendKey);
  assert.equal(calls[0].headers.Authorization, undefined, 'New secret keys use the apikey header');
  assert.deepEqual(JSON.parse(calls[0].body).p_session_id, sessionId);
  const feedback = await handler(
    request({
      action: 'feedback',
      sessionId,
      token: result.token,
      rating: 5,
      comment: '  Make the headings clearer.  ',
      website: '',
    }),
  );
  assert.equal(feedback.status, 200);
  assert.equal(JSON.parse(calls[1].body).p_comment, 'Make the headings clearer.');
  assert.equal((await feedback.json()).token, undefined);
  assert.match(JSON.parse(calls[0].body).p_rate_key, /^[0-9a-f]{64}$/);
});

test('cross-session tokens, invalid keys/origins and malformed feedback never reach the database', async () => {
  let calls = 0;
  const handler = setup(async () => {
    calls++;
    return Response.json({ stats });
  });
  const start = await (await handler(request({ action: 'start', sessionId }))).json();
  assert.equal(calls, 1);
  for (const [body, options, status] of [
    [{ action: 'stats' }, { headers: { origin: 'https://untrusted.example' } }, 403],
    [{ action: 'stats' }, { headers: { apikey: 'wrong' } }, 401],
    [{ action: 'heartbeat', sessionId, token: 'f'.repeat(64) }, {}, 401],
    [{ action: 'heartbeat', sessionId: otherId, token: start.token }, {}, 401],
    [{ action: 'start', sessionId: 'invalid' }, {}, 400],
    [
      { action: 'feedback', sessionId, token: start.token, rating: 6, comment: '', website: '' },
      {},
      400,
    ],
    [
      {
        action: 'feedback',
        sessionId,
        token: start.token,
        rating: 5,
        comment: 'x'.repeat(1501),
        website: '',
      },
      {},
      400,
    ],
    [
      {
        action: 'feedback',
        sessionId,
        token: start.token,
        rating: 5,
        comment: '',
        website: 'spam',
      },
      {},
      400,
    ],
    [{ action: 'heartbeat', sessionId, token: start.token, active: 'false' }, {}, 400],
    ['{malformed', {}, 400],
    ['x'.repeat(8193), {}, 413],
    ['{}', { headers: { 'content-type': 'text/plain' } }, 415],
  ])
    assert.equal((await handler(request(body, options))).status, status);
  assert.equal(calls, 1);
  assert.equal((await handler(request(null, { method: 'OPTIONS' }))).status, 204);
});

test('database errors are sanitized, rate limiting is retained and inconsistent statistics fail closed', async () => {
  for (const [databaseStatus, expected] of [
    [429, 429],
    [404, 404],
    [500, 503],
    [401, 503],
  ]) {
    const handler = setup(async () =>
      Response.json({ message: 'PRIVATE DATABASE DETAIL' }, { status: databaseStatus }),
    );
    const response = await handler(request({ action: 'stats' }));
    assert.equal(response.status, expected);
    assert.doesNotMatch(await response.text(), /PRIVATE DATABASE DETAIL/);
  }
  const invalid = setup(async () => Response.json({ stats: { ...stats, averageRating: null } }));
  assert.equal((await invalid(request({ action: 'stats' }))).status, 503);
});

test('browser client retains one session across reloads and sends hidden presence without cookies', async () => {
  const values = new Map();
  const storage = {
    getItem: (name) => values.get(name),
    setItem: (name, value) => values.set(name, value),
  };
  const handler = setup();
  const calls = [];
  const fetcher = async (_url, options) => {
    calls.push(options);
    return handler(
      new Request('https://example.supabase.co', {
        ...options,
        headers: { ...options.headers, origin },
      }),
    );
  };
  const config = { enabled: true, projectUrl: 'https://example.supabase.co', publishableKey: key };
  const client = createCommunityClient(config, { fetcher, storage, randomUUID: () => sessionId });
  await Promise.all([client.start(), client.start()]);
  assert.equal(calls.length, 1, 'Concurrent starts share one request');
  await client.heartbeat(false, true);
  assert.equal(JSON.parse(calls[1].body).active, false);
  assert.equal(calls[1].keepalive, true);
  assert.equal(calls[1].credentials, 'omit');
  const reloaded = createCommunityClient(config, { fetcher, storage, randomUUID: () => otherId });
  await reloaded.start();
  assert.equal(reloaded.sessionId, sessionId);
  assert.equal(JSON.parse(calls[2].body).sessionId, sessionId);
  const result = await reloaded.submit(4, 'Private suggestion');
  assert.deepEqual(result.stats, stats);
});

test('expired sessions recover once; throttled feedback is not retried automatically', async () => {
  const bodies = [];
  let rejectHeartbeat = true;
  const client = createCommunityClient(
    { enabled: true, projectUrl: 'https://example.supabase.co', publishableKey: key },
    {
      storage: { getItem() {}, setItem() {} },
      randomUUID: () => sessionId,
      fetcher: async (_url, options) => {
        const body = JSON.parse(options.body);
        bodies.push(body);
        if (body.action === 'start') return Response.json({ token: 'a'.repeat(64), stats });
        if (body.action === 'heartbeat' && rejectHeartbeat) {
          rejectHeartbeat = false;
          return Response.json({ error: 'session_expired' }, { status: 404 });
        }
        if (body.action === 'feedback')
          return Response.json({ error: 'rate_limited' }, { status: 429 });
        return Response.json({ stats });
      },
    },
  );
  await client.start();
  await client.heartbeat();
  assert.deepEqual(
    bodies.map((body) => body.action),
    ['start', 'heartbeat', 'start'],
  );
  await assert.rejects(client.submit(5, ''), (error) => error.status === 429);
  assert.equal(bodies.filter((body) => body.action === 'feedback').length, 1);
});

test('HTTP phone previews without randomUUID can start, track presence, rate and retain their session', async () => {
  const source = (
    await fs.readFile(new URL('../site/assets/community-api.js', import.meta.url), 'utf8')
  ).replace('export function createCommunityClient', 'function createCommunityClient');
  let entropyCalls = 0;
  const context = vm.createContext({
    crypto: {
      getRandomValues(bytes) {
        entropyCalls++;
        return crypto.getRandomValues(bytes);
      },
    },
    Uint8Array,
    URL,
    AbortSignal,
    fetch,
  });
  vm.runInContext(source + '\nglobalThis.makeClient = createCommunityClient;', context);
  const values = new Map();
  const storage = {
    getItem: (name) => values.get(name),
    setItem: (name, value) => values.set(name, value),
  };
  const handler = setup();
  const calls = [];
  const config = { enabled: true, projectUrl: 'https://example.supabase.co', publishableKey: key };
  const options = {
    storage,
    fetcher: async (_url, requestOptions) => {
      calls.push(JSON.parse(requestOptions.body));
      return handler(
        new Request('https://example.supabase.co', {
          ...requestOptions,
          headers: { ...requestOptions.headers, origin: 'http://192.168.100.36:8082' },
        }),
      );
    },
  };
  const phone = context.makeClient(config, options);
  await Promise.all([phone.start(), phone.start()]);
  assert.equal(entropyCalls, 1);
  assert.equal(calls.length, 1);
  await phone.heartbeat();
  assert.deepEqual((await phone.submit(5, 'Phone suggestion')).stats, stats);
  const reloaded = context.makeClient(config, options);
  assert.equal(reloaded.sessionId, phone.sessionId);
  assert.equal(
    entropyCalls,
    1,
    'Reload must reuse the stored session rather than count a new visit',
  );
  const fresh = context.makeClient(config, { ...options, storage: { getItem() {}, setItem() {} } });
  assert.notEqual(fresh.sessionId, phone.sessionId);
  assert.equal(entropyCalls, 2);
});
