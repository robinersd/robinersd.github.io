const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function createSessionId() {
  const source = globalThis.crypto;
  if (typeof source?.randomUUID === 'function') return source.randomUUID();
  // Phone LAN previews use HTTP: getRandomValues remains available there.
  // Preserve a cryptographically random UUID rather than using Math.random.
  if (typeof source?.getRandomValues !== 'function')
    throw new Error('Secure session generation is unavailable');
  const bytes = source.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function createCommunityClient(
  config,
  { fetcher = fetch, storage, randomUUID = createSessionId } = {},
) {
  if (!config.enabled || !config.publishableKey?.startsWith('sb_publishable_')) return null;
  if (!storage) {
    try {
      storage = globalThis.window?.sessionStorage;
    } catch {
      /* Memory only. */
    }
  }
  const endpoint = new URL('/functions/v1/portfolio-community', config.projectUrl);
  if (endpoint.protocol !== 'https:' || !endpoint.hostname.endsWith('.supabase.co'))
    throw new Error('Invalid community endpoint');
  const read = (name) => {
    try {
      return storage.getItem(name);
    } catch {
      return null;
    }
  };
  const write = (name, value) => {
    try {
      storage.setItem(name, value);
    } catch {
      /* Memory session still works. */
    }
  };
  const stored = read('robiner.community.session.v1');
  const sessionId = UUID.test(stored || '') ? stored : randomUUID();
  write('robiner.community.session.v1', sessionId);
  let token = '';
  let starting;
  async function request(body, keepalive = false) {
    const response = await fetcher(endpoint.href, {
      method: 'POST',
      headers: { apikey: config.publishableKey, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      keepalive,
      signal: keepalive ? undefined : AbortSignal.timeout(12000),
      credentials: 'omit',
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(data.error || 'temporarily_unavailable');
      error.status = response.status;
      throw error;
    }
    return data;
  }
  async function start(active = true) {
    if (starting) return starting;
    starting = request({ action: 'start', sessionId, active })
      .then((result) => {
        if (!/^[0-9a-f]{64}$/.test(result.token || '')) throw new Error('Invalid session token');
        token = result.token;
        return result;
      })
      .finally(() => {
        starting = undefined;
      });
    return starting;
  }
  async function heartbeat(active = true, keepalive = false) {
    if (!token) return start(active);
    try {
      return await request({ action: 'heartbeat', sessionId, token, active }, keepalive);
    } catch (error) {
      if (!keepalive && [401, 404].includes(error.status)) {
        token = '';
        return start(active);
      }
      throw error;
    }
  }
  async function submit(rating, comment, website = '') {
    if (!token) await start(true);
    const send = () => request({ action: 'feedback', sessionId, token, rating, comment, website });
    try {
      return await send();
    } catch (error) {
      if (![401, 404].includes(error.status)) throw error;
      token = '';
      await start(true);
      return send();
    }
  }
  return { start, heartbeat, submit, sessionId };
}
