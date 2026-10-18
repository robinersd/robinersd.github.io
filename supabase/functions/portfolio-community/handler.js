const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const allowedOrigins = [
  'https://robinersd.vercel.app',
  'https://robinersd.github.io',
  'http://127.0.0.1:8082',
  'http://localhost:8082',
  'http://127.0.0.1:8081',
  'http://localhost:8081',
  'http://192.168.100.36:8082',
];

function publicStats(value) {
  const safe = {};
  for (const key of ['totalVisits', 'liveVisitors', 'ratingCount']) {
    if (!Number.isSafeInteger(value?.[key]) || value[key] < 0)
      throw new Error('Invalid statistics');
    safe[key] = value[key];
  }
  if (
    (safe.ratingCount > 0 && value.averageRating === null) ||
    (value.averageRating !== null &&
      (!Number.isFinite(value.averageRating) || value.averageRating < 1 || value.averageRating > 5))
  ) {
    throw new Error('Invalid rating');
  }
  safe.averageRating = value.averageRating;
  return safe;
}

async function readJson(request) {
  if (!request.headers.get('content-type')?.includes('application/json')) throw { status: 415 };
  if (Number(request.headers.get('content-length')) > 8192) throw { status: 413 };
  const reader = request.body?.getReader();
  if (!reader) throw { status: 400 };
  const chunks = [];
  let size = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > 8192) {
      await reader.cancel();
      throw { status: 413 };
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  try {
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    throw { status: 400 };
  }
}

// No comments, raw presence records, IP addresses, or backend errors are returned.
export function createCommunityHandler({
  url,
  backendKey,
  publishableKeys,
  origins = allowedOrigins,
  fetcher = fetch,
  cryptoApi = crypto,
  now = Date.now,
}) {
  const encoder = new TextEncoder();
  const signingKey = backendKey
    ? cryptoApi.subtle.importKey(
        'raw',
        encoder.encode(backendKey),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign'],
      )
    : null;
  async function sign(value) {
    const signature = await cryptoApi.subtle.sign('HMAC', await signingKey, encoder.encode(value));
    return [...new Uint8Array(signature)]
      .map((byte) => byte.toString(16).padStart(2, '0'))
      .join('');
  }
  async function validToken(token, id) {
    if (typeof token !== 'string' || !/^[0-9a-f]{64}$/.test(token)) return false;
    const expected = await sign(`portfolio-session-v1:${id}`);
    let difference = 0;
    for (let index = 0; index < expected.length; index++)
      difference |= expected.charCodeAt(index) ^ token.charCodeAt(index);
    return difference === 0;
  }
  return async (request) => {
    const origin = request.headers.get('origin');
    const cors = {
      Vary: 'Origin',
      'Cache-Control': 'no-store',
      'Content-Type': 'application/json; charset=utf-8',
      'X-Content-Type-Options': 'nosniff',
    };
    const respond = (body, status = 200) =>
      new Response(JSON.stringify(body), { status, headers: cors });
    if (!origin || !origins.includes(origin)) return respond({ error: 'origin_not_allowed' }, 403);
    cors['Access-Control-Allow-Origin'] = origin;
    cors['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS';
    cors['Access-Control-Allow-Headers'] = 'apikey, content-type';
    cors['Access-Control-Max-Age'] = '600';
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    if (!['GET', 'POST'].includes(request.method))
      return respond({ error: 'method_not_allowed' }, 405);
    if (!backendKey || !url || !publishableKeys?.length)
      return respond({ error: 'temporarily_unavailable' }, 503);
    if (!publishableKeys.includes(request.headers.get('apikey')))
      return respond({ error: 'invalid_api_key' }, 401);
    try {
      const body = request.method === 'GET' ? { action: 'stats' } : await readJson(request);
      if (!body || !['stats', 'start', 'heartbeat', 'feedback'].includes(body.action))
        return respond({ error: 'invalid_request' }, 400);
      if (body.action !== 'stats' && !UUID.test(body.sessionId || ''))
        return respond({ error: 'invalid_session' }, 400);
      if (
        ['heartbeat', 'feedback'].includes(body.action) &&
        !(await validToken(body.token, body.sessionId))
      )
        return respond({ error: 'invalid_session_token' }, 401);
      if (body.action === 'feedback') {
        if (typeof body.website !== 'string' || body.website !== '')
          return respond({ error: 'invalid_feedback' }, 400);
        if (
          !Number.isInteger(body.rating) ||
          body.rating < 1 ||
          body.rating > 5 ||
          typeof body.comment !== 'string' ||
          body.comment.length > 1500
        )
          return respond({ error: 'invalid_feedback' }, 400);
      }
      if (body.active !== undefined && typeof body.active !== 'boolean')
        return respond({ error: 'invalid_request' }, 400);
      // Network-level throttling uses a daily keyed digest, never a stored raw IP.
      const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
      const rateKey = await sign(
        `portfolio-rate-v1:${new Date(now()).toISOString().slice(0, 10)}:${ip}`,
      );
      const response = await fetcher(`${url}/rest/v1/rpc/portfolio_community`, {
        method: 'POST',
        headers: { apikey: backendKey, 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(10000),
        body: JSON.stringify({
          p_action: body.action,
          p_session_id: body.sessionId || null,
          p_active: body.active ?? true,
          p_rating: body.rating ?? null,
          p_comment: body.comment?.trim() || '',
          p_origin: origin,
          p_rate_key: rateKey,
        }),
      });
      if (!response.ok) {
        const status = [400, 404, 429].includes(response.status) ? response.status : 503;
        return respond(
          {
            error:
              status === 429
                ? 'rate_limited'
                : status === 404
                  ? 'session_expired'
                  : 'temporarily_unavailable',
          },
          status,
        );
      }
      const data = await response.json();
      const result = {
        stats: publicStats(data.stats),
        status: data.status === 'already_submitted' ? 'already_submitted' : 'ok',
      };
      if (body.action === 'start')
        result.token = await sign(`portfolio-session-v1:${body.sessionId}`);
      return respond(result);
    } catch (error) {
      const status = [400, 413, 415].includes(error?.status) ? error.status : 503;
      return respond(
        { error: status === 503 ? 'temporarily_unavailable' : 'invalid_request' },
        status,
      );
    }
  };
}
